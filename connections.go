package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/egoist/mygo"
	"github.com/hifizz/morilo/computer"
)

// ConnectionSnapshot is the public, non-secret view of connection state.
type ConnectionSnapshot struct {
	Model              ModelConnection  `json:"model"`
	ModelConfigured    bool             `json:"modelConfigured"`
	LegacyModel        bool             `json:"legacyModel"`
	HasModelKey        bool             `json:"hasModelKey"`
	HasInstaboxKey     bool             `json:"hasInstaboxKey"`
	MachineID          string           `json:"machineId"`
	MachineName        string           `json:"machineName"`
	Mode               string           `json:"mode"` // chat | local | remote
	OnboardingComplete bool             `json:"onboardingComplete"`
	PendingCreation    *MachineCreation `json:"pendingCreation,omitempty"`
	ConnectionError    string           `json:"connectionError,omitempty"`
}

type ModelOption struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type MachineCreation struct {
	Name        string `json:"name"`
	OperationID string `json:"operationId"`
	MachineID   string `json:"machineId"`
	State       string `json:"state"` // submitting/queued/running/starting/checking/ready/failed
	Error       string `json:"error,omitempty"`
}

type InstaboxSetup struct {
	Machines          []computer.Info `json:"machines"`
	Account           string          `json:"account"`
	TemplateAvailable bool            `json:"templateAvailable"`
	VCPUs             int             `json:"vcpus"`
	MemoryMiB         int             `json:"memoryMiB"`
	DiskGiB           int             `json:"diskGiB"`
}

// connectionsMeta is the private persisted record: non-secret config plus
// opaque credential-account references. Account names never reach the DTOs.
type connectionsMeta struct {
	Model              *ModelConnection `json:"model,omitempty"`
	ModelAccount       string           `json:"modelAccount,omitempty"`
	InstaboxAccount    string           `json:"instaboxAccount,omitempty"`
	Machine            *machineRef      `json:"machine,omitempty"`
	Mode               string           `json:"mode,omitempty"`
	OnboardingComplete bool             `json:"onboardingComplete,omitempty"`
	Pending            *pendingCreation `json:"pendingCreation,omitempty"`
}

type machineRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type pendingCreation struct {
	Name           string `json:"name"`
	OperationID    string `json:"operationId,omitempty"`
	MachineID      string `json:"machineId,omitempty"`
	IdempotencyKey string `json:"idempotencyKey"`
	KeyAccount     string `json:"keyAccount"`
	State          string `json:"state"`
	Error          string `json:"error,omitempty"`
}

const (
	connectionsServiceProd = "dev.morilo.app.connections"
	connectionsServiceDev  = "dev.morilo.app.connections.dev"
	maxConnectionsMeta     = 64 << 10
)

// instaboxAPI is what Connections needs from an Instabox client.
// *computer.Instabox implements it; tests substitute a fake.
type instaboxAPI interface {
	computer.Backend
	Machines(context.Context) ([]computer.Info, error)
	Me(context.Context) (string, error)
	AgentTemplate(context.Context) (computer.Spec, bool, error)
	CreateMachine(context.Context, string, string) (computer.Operation, error)
	Operation(context.Context, string) (computer.Operation, error)
}

type secretFuncs struct {
	read   func(service, account string) ([]byte, error)
	write  func(service, account string, value []byte) error
	delete func(service, account string) error
}

type Connections struct {
	dir      string
	metaPath string
	computer *Computer

	// cfgMu gates configuration: Chat.Send holds RLock for a run's lifetime;
	// mutating methods take the write lock.
	cfgMu sync.RWMutex

	mu         sync.Mutex // guards meta/legacy/startupErr
	meta       connectionsMeta
	legacy     bool
	legacyCfg  ModelConnection
	startupErr string

	secrets  secretFuncs
	service  string
	probe    func(ctx context.Context, config ModelConnection, key []byte) error
	newBox   func(baseURL, key, machineID string) instaboxAPI
	baseURL  string
	now      func() string
	onCommit func() // resets cached pi sessions, set in main
}

func NewConnections(comp *Computer) (*Connections, error) {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return nil, err
	}
	c, err := newConnectionsAt(dir, comp)
	if err != nil {
		return nil, err
	}
	service := connectionsServiceProd
	if runtime.GOOS == "darwin" && mygo.IsDev() {
		service = connectionsServiceDev
	}
	c.service = service
	module := mygo.Secrets.Service(service)
	c.secrets = secretFuncs{
		read:   func(_, account string) ([]byte, error) { return module.Get(account) },
		write:  func(_, account string, value []byte) error { return module.Set(account, value) },
		delete: func(_, account string) error { return module.Delete(account) },
	}
	if runtime.GOOS == "darwin" && mygo.IsDev() {
		// Same keychain-partition workaround as the Composio integration.
		c.secrets = secretFuncs{
			read: func(_, account string) ([]byte, error) {
				out, err := runDevelopmentCredentialCommand([]string{
					"find-generic-password", "-s", service, "-a", account, "-g"}, "")
				if err != nil {
					return nil, err
				}
				return decodeDevelopmentCredential(out)
			},
			write: func(_, account string, value []byte) error {
				input := "add-generic-password -U -s " + service + " -a " + account +
					" -X " + hex.EncodeToString(value) + "\n"
				_, err := runDevelopmentCredentialCommand([]string{"-i"}, input)
				return err
			},
			delete: func(_, account string) error {
				_, err := runDevelopmentCredentialCommand([]string{
					"delete-generic-password", "-s", service, "-a", account}, "")
				if errors.Is(err, mygo.ErrSecretNotFound) {
					return nil
				}
				return err
			},
		}
	}
	c.applySavedBackend()
	return c, nil
}

func newConnectionsAt(dir string, comp *Computer) (*Connections, error) {
	if comp == nil {
		return nil, errors.New("connections require a computer service")
	}
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	c := &Connections{
		dir:      dir,
		metaPath: filepath.Join(dir, "connections.json"),
		computer: comp,
		probe:    probeModelWithPi,
		newBox: func(baseURL, key, machineID string) instaboxAPI {
			return computer.NewInstabox(baseURL, key, machineID)
		},
		baseURL: os.Getenv("INSTABOX_API_URL"),
	}
	data, err := os.ReadFile(c.metaPath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, errors.New("cannot read connection configuration")
	}
	if len(data) > 0 {
		if len(data) > maxConnectionsMeta {
			return nil, errors.New("connection configuration is too large")
		}
		if err := json.Unmarshal(data, &c.meta); err != nil {
			return nil, errors.New("cannot parse connection configuration")
		}
		if err := c.validateMeta(); err != nil {
			return nil, err
		}
	}
	c.detectLegacy()
	// Centralized initial mode: explicit saved mode wins; legacy env machine
	// keeps remote; a valid legacy model or existing UI state keeps local;
	// a fresh install starts in chat.
	switch {
	case c.meta.Mode != "":
	case c.meta.Machine != nil || (os.Getenv("INSTABOX_API_KEY") != "" && os.Getenv("INSTABOX_MACHINE_ID") != ""):
		c.meta.Mode = "remote"
	case c.legacy || fileExists(filepath.Join(dir, "state.json")):
		c.meta.Mode = "local"
	default:
		c.meta.Mode = "chat"
	}
	return c, nil
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.Mode().IsRegular()
}

// validateMeta rejects persisted references that cannot be honored instead
// of silently falling back to a different configuration.
func (c *Connections) validateMeta() error {
	for _, ref := range []struct{ account, prefix string }{
		{c.meta.ModelAccount, "model-"}, {c.meta.InstaboxAccount, "instabox-"},
	} {
		if ref.account != "" && !validCredentialAccount(ref.account, ref.prefix) {
			return errors.New("invalid persisted credential reference")
		}
	}
	if p := c.meta.Pending; p != nil {
		if !machineNameRe.MatchString(p.Name) || len(p.IdempotencyKey) != 32 {
			return errors.New("invalid persisted creation request")
		}
		if _, err := hex.DecodeString(p.IdempotencyKey); err != nil {
			return errors.New("invalid persisted creation request")
		}
		if p.KeyAccount != "" && !validCredentialAccount(p.KeyAccount, "instabox-") {
			return errors.New("invalid persisted creation credential")
		}
	}
	switch c.meta.Mode {
	case "", "chat", "local", "remote":
	default:
		return fmt.Errorf("invalid persisted mode %q", c.meta.Mode)
	}
	if c.meta.Model != nil {
		if _, err := normalizeModelConnection(*c.meta.Model); err != nil {
			return fmt.Errorf("invalid persisted model configuration: %w", err)
		}
		if !c.meta.Model.NoAPIKey && c.meta.ModelAccount == "" {
			return errors.New("persisted model configuration is missing its credential reference")
		}
	}
	if c.meta.Machine != nil && c.meta.InstaboxAccount == "" && os.Getenv("INSTABOX_API_KEY") == "" {
		return errors.New("persisted machine selection has no credential reference")
	}
	return nil
}

func validCredentialAccount(account, prefix string) bool {
	if !strings.HasPrefix(account, prefix) || len(account) != len(prefix)+16 {
		return false
	}
	_, err := hex.DecodeString(strings.TrimPrefix(account, prefix))
	return err == nil
}

// detectLegacy checks whether the pre-connections pi-agent configuration has
// a usable default model; existing installs keep working as before.
func (c *Connections) detectLegacy() {
	root := filepath.Join(c.dir, "pi-agent")
	models, err := os.ReadFile(filepath.Join(root, "models.json"))
	if err != nil {
		return
	}
	settings, err := os.ReadFile(filepath.Join(root, "settings.json"))
	if err != nil {
		return
	}
	var ms struct {
		Providers map[string]struct {
			BaseURL string `json:"baseUrl"`
			API     string `json:"api"`
			Models  []struct {
				ID            string   `json:"id"`
				Reasoning     bool     `json:"reasoning"`
				Input         []string `json:"input"`
				ContextWindow int      `json:"contextWindow"`
				MaxTokens     int      `json:"maxTokens"`
			} `json:"models"`
		} `json:"providers"`
	}
	var st struct {
		DefaultProvider string `json:"defaultProvider"`
		DefaultModel    string `json:"defaultModel"`
	}
	if json.Unmarshal(models, &ms) != nil || json.Unmarshal(settings, &st) != nil {
		return
	}
	p, ok := ms.Providers[st.DefaultProvider]
	if !ok || st.DefaultModel == "" {
		return
	}
	cfg := ModelConnection{API: p.API, BaseURL: p.BaseURL, ModelID: st.DefaultModel}
	matched := false
	for _, m := range p.Models {
		if m.ID == st.DefaultModel {
			matched = true
			cfg.Reasoning = m.Reasoning
			cfg.ContextWindow = m.ContextWindow
			cfg.MaxTokens = m.MaxTokens
			for _, i := range m.Input {
				if i == "image" {
					cfg.SupportsImages = true
				}
			}
		}
	}
	if !matched {
		return // default model has no provider entry: not a usable config
	}
	if cfg.ContextWindow == 0 {
		cfg.ContextWindow = 128000
	}
	if cfg.MaxTokens == 0 {
		cfg.MaxTokens = 16384
	}
	if _, err := normalizeModelConnection(cfg); err != nil {
		return // invalid legacy endpoint: not usable
	}
	c.legacy = true
	c.legacyCfg = cfg
}

// applySavedBackend restores the saved remote machine on startup. Failures
// degrade to an actionable snapshot error; the app stays open.
func (c *Connections) applySavedBackend() {
	c.mu.Lock()
	machine, account := c.meta.Machine, c.meta.InstaboxAccount
	c.mu.Unlock()
	if machine == nil {
		return // environment fallback stays as-is
	}
	key, err := c.instaboxKey(account)
	if err != nil {
		c.setStartupError("saved remote computer credentials are unavailable; enter the Instabox key again to reconnect")
		return
	}
	c.computer.replaceBackend(c.newBox(c.baseURL, string(key), machine.ID))
}

func (c *Connections) setStartupError(msg string) {
	c.mu.Lock()
	c.startupErr = msg
	c.mu.Unlock()
}

func (c *Connections) instaboxKey(account string) ([]byte, error) {
	if account != "" {
		return c.secrets.read(c.service, account)
	}
	if env := os.Getenv("INSTABOX_API_KEY"); env != "" {
		return []byte(env), nil
	}
	return nil, errors.New("no Instabox API key configured")
}

var errRunActive = errors.New("a chat run is active; stop it before changing connections")

func cleanSecret(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if !utf8.ValidString(value) || strings.IndexFunc(value, unicode.IsControl) >= 0 {
		return nil, errors.New("the key contains invalid characters")
	}
	if len(value) > mygo.MaxSecretSize {
		return nil, errors.New("the key is too long")
	}
	return []byte(value), nil
}

func (c *Connections) snapshot() ConnectionSnapshot {
	c.mu.Lock()
	defer c.mu.Unlock()
	snap := ConnectionSnapshot{
		Mode:            c.meta.Mode,
		HasInstaboxKey:  c.meta.InstaboxAccount != "" || os.Getenv("INSTABOX_API_KEY") != "",
		ConnectionError: c.startupErr,
	}
	if snap.Mode == "" {
		snap.Mode = "chat"
	}
	switch {
	case c.meta.Model != nil:
		snap.Model = *c.meta.Model
		snap.ModelConfigured = true
		snap.HasModelKey = c.meta.ModelAccount != ""
	case c.legacy:
		snap.Model = c.legacyCfg
		snap.ModelConfigured = true
		snap.LegacyModel = true
		snap.HasModelKey = fileExists(filepath.Join(c.dir, "pi-agent", "auth.json"))
	}
	if c.meta.Machine != nil {
		snap.MachineID = c.meta.Machine.ID
		snap.MachineName = c.meta.Machine.Name
	}
	snap.OnboardingComplete = c.meta.OnboardingComplete || c.legacy
	if c.meta.Pending != nil {
		p := c.meta.Pending
		snap.PendingCreation = &MachineCreation{
			Name: p.Name, OperationID: p.OperationID, MachineID: p.MachineID,
			State: p.State, Error: p.Error,
		}
	}
	return snap
}

// launchPlan describes the pi launch the current configuration needs.
// Called while the configuration read gate is held.
type launchPlan struct {
	mode    string
	managed *ModelConnection
	key     string
}

func (c *Connections) launchPlan() (launchPlan, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	plan := launchPlan{mode: c.meta.Mode}
	if plan.mode == "" {
		plan.mode = "chat"
	}
	if plan.mode == "remote" && c.computer.getBackend() == nil {
		return plan, errors.New("remote computer is not connected; open Settings → Computer to reconnect")
	}
	if c.meta.Model == nil && !c.legacy {
		return plan, errors.New("no model is configured; connect a model in Settings to chat")
	}
	if c.meta.Model != nil {
		plan.managed = c.meta.Model
		if !c.meta.Model.NoAPIKey {
			if c.meta.ModelAccount == "" {
				return plan, errors.New("model API key is not configured; open Settings to connect a model")
			}
			key, err := c.secrets.read(c.service, c.meta.ModelAccount)
			if err != nil {
				return plan, errors.New("the saved model key is unavailable; enter it again in Settings")
			}
			plan.key = string(key)
		}
	}
	return plan, nil
}

func (c *Connections) Get() (ConnectionSnapshot, error) {
	c.cfgMu.RLock()
	defer c.cfgMu.RUnlock()
	return c.snapshot(), nil
}

var modelValidationPrompt = "Reply with exactly: OK"

// ListModels is optional discovery only; saving never requires it.
func (c *Connections) ListModels(ctx context.Context, config ModelConnection, apiKey string) ([]ModelOption, error) {
	c.cfgMu.RLock()
	defer c.cfgMu.RUnlock()
	if err := lightEndpointCheck(config); err != nil {
		return nil, err
	}
	config.BaseURL = strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	var key []byte
	if !config.NoAPIKey {
		var err error
		key, err = cleanSecret(apiKey)
		if err != nil && apiKey != "" {
			return nil, err
		}
		if len(key) == 0 {
			var kerr error
			key, kerr = c.savedModelKeyFor(config)
			if kerr != nil {
				key = nil // try unauthenticated anyway
			}
		}
	}
	return discoverModels(ctx, config, key)
}

func lightEndpointCheck(config ModelConnection) error {
	switch config.API {
	case "openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai":
	default:
		return errors.New("choose a supported model API protocol")
	}
	config.BaseURL = strings.TrimSpace(config.BaseURL)
	u, err := url.Parse(config.BaseURL)
	if err != nil || u.Hostname() == "" ||
		(u.Scheme != "https" && u.Scheme != "http") ||
		u.User != nil || u.RawQuery != "" || u.Fragment != "" ||
		strings.ContainsAny(config.BaseURL, "\r\n\t ") {
		return errors.New("use an HTTP or HTTPS base URL without credentials, query parameters, or a fragment")
	}
	return nil
}

func (c *Connections) savedModelKeyFor(config ModelConnection) ([]byte, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.meta.Model == nil || c.meta.ModelAccount == "" ||
		c.meta.Model.API != config.API || c.meta.Model.BaseURL != config.BaseURL {
		return nil, errors.New("no saved key for this connection")
	}
	return c.secrets.read(c.service, c.meta.ModelAccount)
}

var errModelListUnsupported = errors.New("model list is not supported by this endpoint; enter the model ID manually")

func discoverModels(ctx context.Context, config ModelConnection, key []byte) ([]ModelOption, error) {
	base := strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "", nil)
	if err != nil {
		return nil, err
	}
	var googleNames bool
	switch config.API {
	case "openai-completions", "openai-responses":
		req.URL, _ = url.Parse(base + "/models")
		if len(key) > 0 {
			req.Header.Set("Authorization", "Bearer "+string(key))
		}
	case "anthropic-messages":
		root := strings.TrimSuffix(base, "/v1")
		req.URL, _ = url.Parse(root + "/v1/models")
		if len(key) > 0 {
			req.Header.Set("x-api-key", string(key))
		}
		req.Header.Set("anthropic-version", "2023-06-01")
	case "google-generative-ai":
		req.URL, _ = url.Parse(base + "/models")
		if len(key) > 0 {
			req.Header.Set("x-goog-api-key", string(key))
		}
		googleNames = true
	}
	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, errors.New("model list request failed; check the connection or enter the model ID manually")
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusMethodNotAllowed {
		return nil, errModelListUnsupported
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return nil, errors.New("the key was rejected; check it or enter the model ID manually")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("model list request failed (HTTP %d); enter the model ID manually", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, errModelListUnsupported
	}
	var list []ModelOption
	if googleNames {
		var body struct {
			Models []struct {
				Name        string `json:"name"`
				DisplayName string `json:"displayName"`
			} `json:"models"`
		}
		if json.Unmarshal(data, &body) != nil {
			return nil, errModelListUnsupported
		}
		for _, m := range body.Models {
			id := strings.TrimPrefix(m.Name, "models/")
			list = append(list, ModelOption{ID: id, Name: firstNonEmpty(m.DisplayName, id)})
		}
		return list, nil
	}
	var body struct {
		Data []struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
		} `json:"data"`
	}
	if json.Unmarshal(data, &body) != nil {
		return nil, errModelListUnsupported
	}
	for _, m := range body.Data {
		list = append(list, ModelOption{ID: m.ID, Name: firstNonEmpty(m.DisplayName, m.ID)})
	}
	return list, nil
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func randomAccount(prefix string) (string, error) {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return prefix + "-" + hex.EncodeToString(b), nil
}

// saveMetaLocked atomically persists the candidate metadata. Caller holds
// c.mu and must never mutate nested structs shared with c.meta. On any
// failure c.meta is left completely unchanged.
func (c *Connections) saveMetaLocked(next connectionsMeta) error {
	data, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return err
	}
	if len(data) > maxConnectionsMeta {
		return errors.New("connection configuration is too large")
	}
	tmp := c.metaPath + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, c.metaPath); err != nil {
		os.Remove(tmp)
		return err
	}
	c.meta = next
	return nil
}

// SaveModel validates the connection with a real probe before committing.
func (c *Connections) SaveModel(ctx context.Context, config ModelConnection, apiKey string) (ConnectionSnapshot, error) {
	config, err := normalizeModelConnection(config)
	if err != nil {
		return ConnectionSnapshot{}, err
	}
	if !c.cfgMu.TryLock() {
		return ConnectionSnapshot{}, errRunActive
	}
	defer c.cfgMu.Unlock()

	var key []byte
	newAccount := ""
	c.mu.Lock()
	oldAccount := c.meta.ModelAccount
	c.mu.Unlock()
	switch {
	case config.NoAPIKey:
		// local-style provider: no key needed or stored
	case strings.TrimSpace(apiKey) != "":
		key, err = cleanSecret(apiKey)
		if err != nil {
			return ConnectionSnapshot{}, err
		}
	case c.sameEndpoint(config) && oldAccount != "":
		if key, err = c.secrets.read(c.service, oldAccount); err != nil {
			return ConnectionSnapshot{}, errors.New("the saved key is unavailable; enter the API key again")
		}
	default:
		return ConnectionSnapshot{}, errors.New("enter an API key for this connection")
	}
	if err := c.probe(ctx, config, key); err != nil {
		return ConnectionSnapshot{}, err
	}
	if len(key) > 0 {
		if newAccount, err = randomAccount("model"); err != nil {
			return ConnectionSnapshot{}, err
		}
		if err = c.secrets.write(c.service, newAccount, key); err != nil {
			return ConnectionSnapshot{}, errors.New("cannot save the key in the system credential store")
		}
	}
	cfg := config
	c.mu.Lock()
	next := c.meta
	next.Model = &cfg
	next.ModelAccount = newAccount
	if config.NoAPIKey {
		next.ModelAccount = ""
	} else if newAccount == "" {
		next.ModelAccount = oldAccount // reused saved key
	}
	err = c.saveMetaLocked(next)
	c.mu.Unlock()
	if err != nil {
		if newAccount != "" {
			c.secrets.delete(c.service, newAccount)
		}
		return ConnectionSnapshot{}, errors.New("cannot save the model configuration")
	}
	if c.onCommit != nil {
		c.onCommit()
	}
	if oldAccount != "" && oldAccount != next.ModelAccount {
		c.secrets.delete(c.service, oldAccount)
	}
	return c.snapshot(), nil
}

func (c *Connections) sameEndpoint(config ModelConnection) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.meta.Model != nil &&
		c.meta.Model.API == config.API && c.meta.Model.BaseURL == config.BaseURL
}

// ConfigureInstabox validates a fresh key (list + account + template), then
// stores it. On any failure the previous configuration is untouched.
func (c *Connections) ConfigureInstabox(ctx context.Context, apiKey string) (InstaboxSetup, error) {
	key, err := cleanSecret(apiKey)
	if err != nil {
		return InstaboxSetup{}, err
	}
	if len(key) == 0 {
		return InstaboxSetup{}, errors.New("enter an Instabox API key")
	}
	if !c.cfgMu.TryLock() {
		return InstaboxSetup{}, errRunActive
	}
	defer c.cfgMu.Unlock()
	c.mu.Lock()
	hasPending := c.meta.Pending != nil
	savedMachine := c.meta.Machine
	c.mu.Unlock()
	if hasPending {
		return InstaboxSetup{}, errors.New("a machine creation is pending; dismiss or finish it before changing the Instabox key")
	}

	setupCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	box := c.newBox(c.baseURL, string(key), "")
	setup, err := c.querySetup(setupCtx, box)
	cancel()
	if err != nil {
		return InstaboxSetup{}, err
	}
	// A retained selection must still be usable under the new key.
	var newBackend instaboxAPI
	keepMachine := savedMachine
	if keepMachine != nil {
		if !machineListed(setup.Machines, keepMachine.ID) {
			keepMachine = nil // the new account cannot see the old selection
		} else {
			mbox := c.newBox(c.baseURL, string(key), keepMachine.ID)
			wCtx, wCancel := context.WithTimeout(ctx, 2*time.Minute)
			defer wCancel()
			err = mbox.Wake(wCtx)
			var info computer.Info
			if err == nil {
				info, err = mbox.Info(wCtx)
			}
			if err != nil || info.ID != keepMachine.ID || info.State != "running" || !info.Runtime.Ready {
				return InstaboxSetup{}, errors.New("the selected machine is not reachable with this key; check it in Settings")
			}
			if _, err := mbox.DesktopURL(wCtx, true); err != nil {
				return InstaboxSetup{}, errors.New("desktop access needs the personal Instabox key of the account that created the machine")
			}
			newBackend = mbox
		}
	}
	account, err := randomAccount("instabox")
	if err != nil {
		return InstaboxSetup{}, err
	}
	if err = c.secrets.write(c.service, account, key); err != nil {
		return InstaboxSetup{}, errors.New("cannot save the key in the system credential store")
	}
	c.mu.Lock()
	oldAccount := c.meta.InstaboxAccount
	next := c.meta
	next.InstaboxAccount = account
	next.Machine = keepMachine
	if keepMachine == nil && next.Mode == "remote" {
		next.Mode = "chat"
	}
	err = c.saveMetaLocked(next)
	c.mu.Unlock()
	if err != nil {
		c.secrets.delete(c.service, account)
		return InstaboxSetup{}, errors.New("cannot save the Instabox configuration")
	}
	if oldAccount != "" && oldAccount != account {
		c.secrets.delete(c.service, oldAccount)
	}
	c.computer.replaceBackend(newBackend) // nil clears a vanished machine
	c.setStartupError("")
	if c.onCommit != nil {
		c.onCommit()
	}
	return setup, nil
}

func (c *Connections) querySetup(ctx context.Context, box instaboxAPI) (InstaboxSetup, error) {
	machines, err := box.Machines(ctx)
	if err != nil {
		return InstaboxSetup{}, errors.New("cannot list Instabox machines; check the key and network")
	}
	login, err := box.Me(ctx)
	if err != nil {
		return InstaboxSetup{}, errors.New("cannot read the Instabox account; check the key")
	}
	spec, ok, err := box.AgentTemplate(ctx)
	if err != nil {
		return InstaboxSetup{}, errors.New("cannot list Instabox templates")
	}
	if machines == nil {
		machines = []computer.Info{}
	}
	setup := InstaboxSetup{Machines: machines, Account: login, TemplateAvailable: ok}
	if ok {
		setup.VCPUs = spec.VCPUs
		setup.MemoryMiB = spec.MemMiB
		setup.DiskGiB = spec.PersistentDiskGiB
	}
	return setup, nil
}

func machineListed(machines []computer.Info, id string) bool {
	for _, m := range machines {
		if m.ID == id {
			return true
		}
	}
	return false
}

// InstaboxMachines lists machines for the saved key (or the legacy env key).
func (c *Connections) InstaboxMachines(ctx context.Context) (InstaboxSetup, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	c.cfgMu.RLock()
	defer c.cfgMu.RUnlock()
	c.mu.Lock()
	account := c.meta.InstaboxAccount
	c.mu.Unlock()
	key, err := c.instaboxKey(account)
	if err != nil {
		return InstaboxSetup{}, errors.New("enter an Instabox API key to list machines")
	}
	box := c.newBox(c.baseURL, string(key), "")
	return c.querySetup(ctx, box)
}

func (c *Connections) SelectMachine(ctx context.Context, machineID string) (ConnectionSnapshot, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if !c.cfgMu.TryLock() {
		return ConnectionSnapshot{}, errRunActive
	}
	defer c.cfgMu.Unlock()
	c.mu.Lock()
	account := c.meta.InstaboxAccount
	c.mu.Unlock()
	key, err := c.instaboxKey(account)
	if err != nil {
		return ConnectionSnapshot{}, errors.New("enter an Instabox API key first")
	}
	box := c.newBox(c.baseURL, string(key), machineID)
	machines, err := box.Machines(ctx)
	if err != nil {
		return ConnectionSnapshot{}, errors.New("cannot list Instabox machines")
	}
	var chosen *computer.Info
	for i := range machines {
		if machines[i].ID == machineID {
			chosen = &machines[i]
		}
	}
	if chosen == nil {
		return ConnectionSnapshot{}, errors.New("that machine is not in this account's list")
	}
	err = box.Wake(ctx)
	if err != nil {
		return ConnectionSnapshot{}, errors.New("cannot wake the machine: " + sanitizeAPIError(err))
	}
	info, err := box.Info(ctx)
	if err != nil || info.ID != machineID {
		return ConnectionSnapshot{}, errors.New("cannot read the machine status")
	}
	if info.State != "running" || !info.Runtime.Ready {
		return ConnectionSnapshot{}, errors.New("the machine is not ready yet; try again shortly")
	}
	if _, err := box.DesktopURL(ctx, true); err != nil {
		return ConnectionSnapshot{}, errors.New("desktop access needs the personal Instabox key of the account that created the machine")
	}
	ref := machineRef{ID: info.ID, Name: info.Name}
	c.mu.Lock()
	next := c.meta
	next.Machine = &ref
	next.Mode = "remote"
	err = c.saveMetaLocked(next)
	c.mu.Unlock()
	if err != nil {
		return ConnectionSnapshot{}, errors.New("cannot save the machine selection")
	}
	c.computer.replaceBackend(box)
	c.setStartupError("")
	if c.onCommit != nil {
		c.onCommit()
	}
	return c.snapshot(), nil
}

var machineNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

func (c *Connections) CreateMachine(ctx context.Context, name string) (MachineCreation, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	name = strings.TrimSpace(name)
	if !machineNameRe.MatchString(name) {
		return MachineCreation{}, errors.New("machine name must be 1–63 lowercase letters, digits or hyphens, starting with a letter or digit")
	}
	if !c.cfgMu.TryLock() {
		return MachineCreation{}, errRunActive
	}
	defer c.cfgMu.Unlock()

	c.mu.Lock()
	pending := c.meta.Pending
	c.mu.Unlock()
	if pending != nil {
		if pending.Name != name {
			return MachineCreation{}, fmt.Errorf("a creation for %q is already pending; dismiss or finish it first", pending.Name)
		}
		return c.refreshCreationLocked(ctx)
	}

	c.mu.Lock()
	account := c.meta.InstaboxAccount
	c.mu.Unlock()
	key, err := c.instaboxKey(account)
	if err != nil {
		return MachineCreation{}, errors.New("enter an Instabox API key first")
	}
	idem, err := randomID()
	if err != nil {
		return MachineCreation{}, err
	}
	// The template must be creatable before the first POST is promised.
	box := c.newBox(c.baseURL, string(key), "")
	if _, ok, err := box.AgentTemplate(ctx); err != nil || !ok {
		return MachineCreation{}, errors.New("the agent-browser template is not available on this account")
	}
	// A creation must remain recoverable after an env-based legacy launch.
	// Copy that key to our credential store before recording/submitting it.
	newAccount := ""
	if account == "" {
		newAccount, err = randomAccount("instabox")
		if err != nil {
			return MachineCreation{}, err
		}
		if err := c.secrets.write(c.service, newAccount, key); err != nil {
			return MachineCreation{}, errors.New("cannot save the creation credential in the system credential store")
		}
		account = newAccount
	}
	p := &pendingCreation{Name: name, IdempotencyKey: idem, KeyAccount: account, State: "submitting"}
	c.mu.Lock()
	next := c.meta
	next.Pending = p
	if newAccount != "" {
		next.InstaboxAccount = newAccount
	}
	if err = c.saveMetaLocked(next); err != nil {
		c.mu.Unlock()
		if newAccount != "" {
			c.secrets.delete(c.service, newAccount)
		}
		return MachineCreation{}, errors.New("cannot record the creation request")
	}
	c.mu.Unlock()
	return c.submitCreation(ctx, *p, string(key))
}

func randomID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// submitCreation performs the POST; failures keep the pending record so a
// refresh retries with the identical body and idempotency key.
func (c *Connections) submitCreation(ctx context.Context, p pendingCreation, key string) (MachineCreation, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	box := c.newBox(c.baseURL, key, "")
	op, err := box.CreateMachine(ctx, p.Name, p.IdempotencyKey)
	if err != nil {
		p.Error = createError(err)
		p.State = "submitting"
		var apiErr *computer.APIError
		if errors.As(err, &apiErr) && apiErr.StatusCode >= 400 && apiErr.StatusCode < 500 &&
			apiErr.StatusCode != http.StatusRequestTimeout && apiErr.StatusCode != http.StatusTooManyRequests {
			p.State = "failed"
		}
		return c.recordCreation(p)
	}
	p.OperationID = op.ID
	if op.MachineID != "" {
		p.MachineID = op.MachineID
	}
	p.State = opState(op.State)
	p.Error = ""
	if p.State == "failed" {
		p.Error = "machine creation failed; check your account's limits and availability"
	}
	return c.recordCreation(p)
}

func (c *Connections) recordCreation(p pendingCreation) (MachineCreation, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	next := c.meta
	next.Pending = &p
	if err := c.saveMetaLocked(next); err != nil {
		return MachineCreation{}, errors.New("cannot save creation progress; the original request is retained for a safe retry")
	}
	return MachineCreation{
		Name: p.Name, OperationID: p.OperationID, MachineID: p.MachineID,
		State: p.State, Error: p.Error,
	}, nil
}

// createError maps an API failure to an actionable, sanitized message.
func createError(err error) string {
	var apiErr *computer.APIError
	if errors.As(err, &apiErr) {
		switch apiErr.StatusCode {
		case http.StatusUnauthorized, http.StatusForbidden:
			return "the Instabox key lacks machines:write permission"
		case http.StatusConflict:
			return "a machine with this name already exists"
		case http.StatusTooManyRequests:
			return "Instabox is limiting requests; wait before retrying"
		case http.StatusBadRequest, http.StatusPaymentRequired:
			return "Instabox refused the request; check your plan, limits, and machine name"
		}
	}
	return "creation request failed; it can be retried safely"
}

func opState(state string) string {
	switch state {
	case "queued":
		return "queued"
	case "running":
		return "starting"
	case "succeeded":
		return "checking"
	case "failed":
		return "failed"
	}
	return "queued"
}

// RefreshCreation advances a pending creation by exactly one step.
func (c *Connections) RefreshCreation(ctx context.Context) (MachineCreation, error) {
	if !c.cfgMu.TryLock() {
		return MachineCreation{}, errRunActive
	}
	defer c.cfgMu.Unlock()
	return c.refreshCreationLocked(ctx)
}

func (c *Connections) refreshCreationLocked(ctx context.Context) (MachineCreation, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	c.mu.Lock()
	saved := c.meta.Pending
	c.mu.Unlock()
	if saved == nil {
		return MachineCreation{}, errors.New("no machine creation is pending")
	}
	p := *saved // never mutate the persisted record in place
	key, err := c.instaboxKey(p.KeyAccount)
	if err != nil {
		return MachineCreation{}, errors.New("the Instabox key for this creation is unavailable; enter it again")
	}
	if p.OperationID == "" {
		return c.submitCreation(ctx, p, string(key))
	}
	box := c.newBox(c.baseURL, string(key), p.MachineID)
	op, err := box.Operation(ctx, p.OperationID)
	if err != nil {
		p.Error = "status check failed; try again"
		return c.recordCreation(p)
	}
	if op.MachineID != "" {
		p.MachineID = op.MachineID
	}
	switch op.State {
	case "queued", "running":
		p.State = opState(op.State)
		p.Error = ""
		return c.recordCreation(p)
	case "failed":
		p.State = "failed"
		p.Error = "machine creation failed"
		return c.recordCreation(p)
	case "succeeded":
	default:
		p.Error = "unexpected operation state"
		return c.recordCreation(p)
	}
	if p.MachineID == "" {
		p.Error = "the operation did not report a machine ID yet"
		return c.recordCreation(p)
	}
	// Succeeded: verify the machine is actually running and reachable.
	mbox := c.newBox(c.baseURL, string(key), p.MachineID)
	info, err := mbox.Info(ctx)
	if err != nil || info.ID != p.MachineID || info.State != "running" || !info.Runtime.Ready {
		p.State = "checking"
		p.Error = ""
		return c.recordCreation(p)
	}
	if _, err := mbox.DesktopURL(ctx, true); err != nil {
		p.State = "checking"
		p.Error = "desktop is not ready yet; retry the connection"
		var apiErr *computer.APIError
		if errors.As(err, &apiErr) && (apiErr.StatusCode == 401 || apiErr.StatusCode == 403) {
			p.State = "failed"
			p.Error = "desktop access needs the personal Instabox key of the account that created the machine"
		}
		return c.recordCreation(p)
	}
	ref := machineRef{ID: info.ID, Name: info.Name}
	c.mu.Lock()
	next := c.meta
	next.Machine = &ref
	next.Mode = "remote"
	next.Pending = nil
	err = c.saveMetaLocked(next)
	c.mu.Unlock()
	if err != nil {
		// The pending record stays: a later refresh retries the commit.
		return MachineCreation{Name: p.Name, OperationID: p.OperationID, MachineID: p.MachineID, State: "checking", Error: "cannot save the new machine yet"}, nil
	}
	c.computer.replaceBackend(mbox)
	c.setStartupError("")
	if c.onCommit != nil {
		c.onCommit()
	}
	return MachineCreation{Name: p.Name, OperationID: p.OperationID, MachineID: p.MachineID, State: "ready"}, nil
}

// DismissCreation clears the pending record only; it never deletes a machine.
func (c *Connections) DismissCreation() (ConnectionSnapshot, error) {
	if !c.cfgMu.TryLock() {
		return ConnectionSnapshot{}, errRunActive
	}
	defer c.cfgMu.Unlock()
	c.mu.Lock()
	next := c.meta
	next.Pending = nil
	err := c.saveMetaLocked(next)
	c.mu.Unlock()
	if err != nil {
		return ConnectionSnapshot{}, errors.New("cannot clear the pending creation")
	}
	return c.snapshot(), nil
}

func (c *Connections) SetMode(mode string) (ConnectionSnapshot, error) {
	switch mode {
	case "chat", "local", "remote":
	default:
		return ConnectionSnapshot{}, errors.New("mode must be chat, local or remote")
	}
	if !c.cfgMu.TryLock() {
		return ConnectionSnapshot{}, errRunActive
	}
	defer c.cfgMu.Unlock()
	var recovered computer.Backend
	if mode == "remote" && c.computer.getBackend() == nil {
		// Recover a usable backend from the saved selection or refuse.
		c.mu.Lock()
		machine, account := c.meta.Machine, c.meta.InstaboxAccount
		c.mu.Unlock()
		if machine == nil {
			return ConnectionSnapshot{}, errors.New("select a remote machine in Settings → Computer first")
		}
		key, err := c.instaboxKey(account)
		if err != nil {
			return ConnectionSnapshot{}, errors.New("saved remote computer credentials are unavailable; re-enter the Instabox key")
		}
		recovered = c.newBox(c.baseURL, string(key), machine.ID)
	}
	c.mu.Lock()
	next := c.meta
	next.Mode = mode
	err := c.saveMetaLocked(next)
	c.mu.Unlock()
	if err != nil {
		return ConnectionSnapshot{}, errors.New("cannot save the mode")
	}
	if recovered != nil {
		c.computer.replaceBackend(recovered)
		c.setStartupError("")
	}
	if c.onCommit != nil {
		c.onCommit()
	}
	return c.snapshot(), nil
}

func (c *Connections) FinishOnboarding() (ConnectionSnapshot, error) {
	if !c.cfgMu.TryLock() {
		return ConnectionSnapshot{}, errRunActive
	}
	defer c.cfgMu.Unlock()
	c.mu.Lock()
	configured := c.meta.Model != nil || c.legacy
	remoteOK := c.meta.Mode != "remote" || c.computer.getBackend() != nil
	c.mu.Unlock()
	if !configured {
		return ConnectionSnapshot{}, errors.New("connect a model before finishing setup")
	}
	if !remoteOK {
		return ConnectionSnapshot{}, errors.New("remote mode needs a selected machine before finishing setup")
	}
	c.mu.Lock()
	next := c.meta
	next.OnboardingComplete = true
	err := c.saveMetaLocked(next)
	c.mu.Unlock()
	if err != nil {
		return ConnectionSnapshot{}, errors.New("cannot save onboarding state")
	}
	return c.snapshot(), nil
}

func sanitizeAPIError(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if i := strings.Index(msg, ":"); i > 0 && len(msg) > i+1 {
		return strings.TrimSpace(msg[i+1:])
	}
	return msg
}
