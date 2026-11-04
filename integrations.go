package main

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"
)

type IntegrationConnection struct {
	ID     string `json:"id"`
	AppID  string `json:"appId"`
	Status string `json:"status"`
	Label  string `json:"label"`
}

type IntegrationState struct {
	Configured  bool                    `json:"configured"`
	Connections []IntegrationConnection `json:"connections"`
}

type IntegrationAuthLink struct {
	URL          string `json:"url"`
	ConnectionID string `json:"connectionId"`
}

type IntegrationTool struct {
	Slug        string         `json:"slug"`
	AppID       string         `json:"appId"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Version     string         `json:"version"`
	Parameters  map[string]any `json:"parameters"`
}

type IntegrationResult struct {
	Data       any    `json:"data"`
	Successful bool   `json:"successful"`
	Error      string `json:"error,omitempty"`
}

var integrationReadTools = map[string][]string{
	"github": {"GITHUB_GET_THE_AUTHENTICATED_USER", "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", "GITHUB_GET_A_REPOSITORY", "GITHUB_LIST_REPOSITORY_ISSUES"},
	"vercel": {"VERCEL_GET_PROJECTS", "VERCEL_GET_DEPLOYMENTS"},
}

type Integrations struct {
	mu              sync.Mutex
	validateProfile func(string) error
	configPath      string
	authConfigs     map[string]string
	toolCache       map[string][]IntegrationTool
	key             string
	keyLoaded       bool
	secretGet       func() ([]byte, error)
	secretSet       func([]byte) error
	envKey          func() string
	openURL         func(string) error
	baseURL         string
	client          *http.Client
	bridgeMu        sync.Mutex
	bridges         map[string]integrationEndpoint
	servers         map[string]*http.Server
	extensionDir    func() (string, error)
	extensionPath   string
}

func NewIntegrations(validateProfile func(string) error) (*Integrations, error) {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return nil, err
	}
	return newIntegrationsAt(dir, validateProfile)
}

func newIntegrationsAt(dir string, validateProfile func(string) error) (*Integrations, error) {
	if validateProfile == nil {
		return nil, errors.New("integrations require local profile validation")
	}
	secrets := mygo.Secrets.Service("dev.morilo.app.integrations")
	s := &Integrations{
		validateProfile: validateProfile,
		configPath:      filepath.Join(dir, "integrations.json"),
		authConfigs:     make(map[string]string),
		toolCache:       make(map[string][]IntegrationTool),
		secretGet:       func() ([]byte, error) { return secrets.Get("composio-api-key") },
		secretSet:       func(value []byte) error { return secrets.Set("composio-api-key", value) },
		envKey:          func() string { return os.Getenv("COMPOSIO_API_KEY") },
		openURL:         mygo.Shell.OpenExternal,
		baseURL:         "https://backend.composio.dev/api/v3.1",
		client: &http.Client{
			Timeout: 30 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		bridges:      make(map[string]integrationEndpoint),
		servers:      make(map[string]*http.Server),
		extensionDir: piAgentDir,
	}
	// macOS also checks keychain partition IDs, which bind self-signed apps
	// to each build's CDHash. Use Apple's stable client during development.
	if runtime.GOOS == "darwin" && mygo.IsDev() {
		s.secretGet = func() ([]byte, error) {
			value, err := runDevelopmentCredentialCommand([]string{
				"find-generic-password", "-s", "dev.morilo.app.integrations",
				"-a", "composio-api-key", "-g",
			}, "")
			if err != nil {
				return nil, err
			}
			return decodeDevelopmentCredential(value)
		}
		s.secretSet = func(value []byte) error {
			// Hex on stdin avoids both command injection and secrets in argv.
			input := "add-generic-password -U -s dev.morilo.app.integrations -a composio-api-key -X " + hex.EncodeToString(value) + "\n"
			_, err := runDevelopmentCredentialCommand([]string{"-i"}, input)
			return err
		}
	}
	data, err := os.ReadFile(s.configPath)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, errors.New("cannot read integration configuration")
	}
	var saved map[string]string
	if json.Unmarshal(data, &saved) != nil {
		return nil, errors.New("invalid integration configuration")
	}
	for app, id := range saved {
		if _, allowed := integrationReadTools[app]; allowed && id != "" {
			s.authConfigs[app] = id
		}
	}
	return s, nil
}

func runDevelopmentCredentialCommand(args []string, input string) ([]byte, error) {
	cmd := exec.Command("/usr/bin/security", args...)
	cmd.Stdin = strings.NewReader(input)
	cmd.Stdout = io.Discard
	var output bytes.Buffer
	cmd.Stderr = &output
	err := cmd.Run()
	var exit *exec.ExitError
	if errors.As(err, &exit) && exit.ExitCode() == 44 {
		return nil, mygo.ErrSecretNotFound
	}
	if err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}

func decodeDevelopmentCredential(output []byte) ([]byte, error) {
	text := strings.TrimSpace(string(output))
	if quoted, ok := strings.CutPrefix(text, `password: "`); ok && strings.HasSuffix(quoted, `"`) {
		return []byte(strings.TrimSuffix(quoted, `"`)), nil
	}
	if encoded, ok := strings.CutPrefix(text, "password: 0x"); ok {
		fields := strings.Fields(encoded)
		if len(fields) > 0 {
			if value, err := hex.DecodeString(fields[0]); err == nil {
				return value, nil
			}
		}
	}
	return nil, errors.New("unexpected macOS credential response")
}

func integrationCredentialError(action string, err error) error {
	message := "cannot " + action + " Composio key in the system credential store"
	if _, status, ok := strings.Cut(err.Error(), "(OSStatus "); ok {
		if code, parseErr := strconv.Atoi(strings.TrimSuffix(status, ")")); parseErr == nil {
			message += fmt.Sprintf(" (macOS OSStatus %d)", code)
		}
	}
	return errors.New(message)
}

func (s *Integrations) loadKey() (string, error) {
	if s.keyLoaded {
		return s.key, nil
	}
	value, err := s.secretGet()
	if err != nil && !errors.Is(err, mygo.ErrSecretNotFound) {
		return "", integrationCredentialError("read", err)
	}
	key := strings.TrimSpace(string(value))
	if errors.Is(err, mygo.ErrSecretNotFound) || key == "" {
		key = strings.TrimSpace(s.envKey())
	}
	s.key, s.keyLoaded = key, key != ""
	return key, nil
}

func (s *Integrations) saveConfigs(configs map[string]string) error {
	if err := os.MkdirAll(filepath.Dir(s.configPath), 0o700); err != nil {
		return errors.New("cannot save integration configuration")
	}
	data, err := json.Marshal(configs)
	if err != nil {
		return errors.New("cannot encode integration configuration")
	}
	file, err := os.CreateTemp(filepath.Dir(s.configPath), ".integrations-*.tmp")
	if err != nil {
		return errors.New("cannot save integration configuration")
	}
	defer os.Remove(file.Name())
	if _, err := file.Write(data); err != nil {
		file.Close()
		return errors.New("cannot write integration configuration")
	}
	if err := file.Close(); err != nil {
		return errors.New("cannot close integration configuration")
	}
	if err := os.Rename(file.Name(), s.configPath); err != nil {
		return errors.New("cannot replace integration configuration")
	}
	return nil
}

func (s *Integrations) request(ctx context.Context, key, method, path string, query url.Values, body, result any, expected int) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return errors.New("invalid integration request")
		}
		reader = bytes.NewReader(data)
	}
	target := s.baseURL + path
	if len(query) != 0 {
		target += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return errors.New("cannot create integration request")
	}
	req.Header.Set("x-api-key", key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return errors.New("Composio request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != expected && !(method == http.MethodDelete && resp.StatusCode == http.StatusOK) {
		requestID := resp.Header.Get("x-request-id")
		safeID := requestID != "" && len(requestID) <= 128 && !strings.Contains(requestID, key)
		for _, char := range requestID {
			if !(char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '-' || char == '_') {
				safeID = false
			}
		}
		if safeID {
			return fmt.Errorf("Composio HTTP %d (request %s)", resp.StatusCode, requestID)
		}
		return fmt.Errorf("Composio HTTP %d", resp.StatusCode)
	}
	if result != nil {
		decoder := json.NewDecoder(io.LimitReader(resp.Body, 16<<20))
		decoder.UseNumber()
		if err := decoder.Decode(result); err != nil {
			return errors.New("invalid Composio response")
		}
	}
	return nil
}

func (s *Integrations) ConfigureKey(ctx context.Context, apiKey string) error {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" || len(apiKey) > mygo.MaxSecretSize || strings.ContainsAny(apiKey, "\r\n\x00") {
		return errors.New("a valid Composio project API key is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	previous, err := s.loadKey()
	if err != nil {
		return err
	}
	if err := s.request(ctx, apiKey, http.MethodGet, "/toolkits/github", nil, nil, nil, http.StatusOK); err != nil {
		return err
	}
	if previous != apiKey {
		if err := s.saveConfigs(map[string]string{}); err != nil {
			return err
		}
	}
	if err := s.secretSet([]byte(apiKey)); err != nil {
		if previous != apiKey {
			if err := s.saveConfigs(s.authConfigs); err != nil {
				return errors.New("cannot save Composio key or restore integration configuration")
			}
		}
		return integrationCredentialError("save", err)
	}
	if previous != apiKey {
		s.authConfigs = make(map[string]string)
		s.toolCache = make(map[string][]IntegrationTool)
	}
	s.key, s.keyLoaded = apiKey, true
	return nil
}

func (s *Integrations) Status(ctx context.Context, profileID string) (IntegrationState, error) {
	if err := s.validateProfile(profileID); err != nil {
		return IntegrationState{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status(ctx, profileID)
}

func (s *Integrations) status(ctx context.Context, profileID string) (IntegrationState, error) {
	state := IntegrationState{Connections: []IntegrationConnection{}}
	key, err := s.loadKey()
	if err != nil {
		return state, err
	}
	if key == "" {
		return state, nil
	}
	state.Configured = true
	query := url.Values{
		"user_ids": {profileID}, "toolkit_slugs": {"github,vercel"}, "limit": {"100"}, "account_type": {"PRIVATE"},
	}
	cursors := make(map[string]bool)
	for {
		var response struct {
			Items []struct {
				ID         string `json:"id"`
				Status     string `json:"status"`
				Alias      string `json:"alias"`
				UserID     string `json:"user_id"`
				IsDisabled bool   `json:"is_disabled"`
				Toolkit    struct {
					Slug string `json:"slug"`
				} `json:"toolkit"`
				AuthConfig struct {
					IsDisabled bool `json:"is_disabled"`
				} `json:"auth_config"`
			} `json:"items"`
			NextCursor string `json:"next_cursor"`
		}
		if err := s.request(ctx, key, http.MethodGet, "/connected_accounts", query, nil, &response, http.StatusOK); err != nil {
			return state, err
		}
		for _, item := range response.Items {
			if _, allowed := integrationReadTools[item.Toolkit.Slug]; !allowed || item.ID == "" || item.UserID != "" && item.UserID != profileID {
				continue
			}
			status := item.Status
			if item.IsDisabled || item.AuthConfig.IsDisabled {
				status = "DISABLED"
			}
			state.Connections = append(state.Connections, IntegrationConnection{
				ID: item.ID, AppID: item.Toolkit.Slug, Status: status, Label: item.Alias,
			})
		}
		if response.NextCursor == "" {
			return state, nil
		}
		if cursors[response.NextCursor] {
			return state, errors.New("invalid Composio pagination")
		}
		cursors[response.NextCursor] = true
		query.Set("cursor", response.NextCursor)
	}
}

func (s *Integrations) Connect(ctx context.Context, profileID, appID string) (IntegrationAuthLink, error) {
	if err := s.validateProfile(profileID); err != nil {
		return IntegrationAuthLink{}, err
	}
	if _, allowed := integrationReadTools[appID]; !allowed {
		return IntegrationAuthLink{}, errors.New("app is not available")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key, err := s.loadKey()
	if err != nil {
		return IntegrationAuthLink{}, err
	}
	if key == "" {
		return IntegrationAuthLink{}, errors.New("Composio is not configured")
	}
	id := s.authConfigs[appID]
	if id == "" {
		auth := map[string]any{
			"type": "use_composio_managed_auth", "name": "Morilo GitHub read-only demo",
			"credentials": map[string]any{"scopes": "read:user"},
		}
		if appID == "vercel" {
			auth = map[string]any{
				"type": "use_custom_auth", "authScheme": "API_KEY", "name": "Morilo Vercel", "credentials": map[string]any{},
			}
		}
		body := map[string]any{"toolkit": map[string]any{"slug": appID}, "auth_config": auth}
		var response struct {
			AuthConfig struct {
				ID string `json:"id"`
			} `json:"auth_config"`
			Toolkit struct {
				Slug string `json:"slug"`
			} `json:"toolkit"`
		}
		if err := s.request(ctx, key, http.MethodPost, "/auth_configs", nil, body, &response, http.StatusCreated); err != nil {
			return IntegrationAuthLink{}, err
		}
		if response.AuthConfig.ID == "" || response.Toolkit.Slug != appID {
			return IntegrationAuthLink{}, errors.New("invalid Composio auth configuration")
		}
		id = response.AuthConfig.ID
		configs := make(map[string]string, len(s.authConfigs)+1)
		for app, config := range s.authConfigs {
			configs[app] = config
		}
		configs[appID] = id
		if err := s.saveConfigs(configs); err != nil {
			return IntegrationAuthLink{}, err
		}
		s.authConfigs = configs
	}
	var response struct {
		RedirectURL        string `json:"redirect_url"`
		ConnectedAccountID string `json:"connected_account_id"`
	}
	body := map[string]any{"auth_config_id": id, "user_id": profileID}
	if err := s.request(ctx, key, http.MethodPost, "/connected_accounts/link", nil, body, &response, http.StatusCreated); err != nil {
		return IntegrationAuthLink{}, err
	}
	link, err := url.Parse(response.RedirectURL)
	if err != nil || link.Scheme != "https" || link.User != nil || link.Port() != "" ||
		!slices.Contains([]string{"connect.composio.dev", "app.composio.dev", "backend.composio.dev"}, link.Host) {
		return IntegrationAuthLink{}, errors.New("invalid Composio authorization URL")
	}
	if response.ConnectedAccountID == "" {
		return IntegrationAuthLink{}, errors.New("missing Composio connection identifier")
	}
	return IntegrationAuthLink{URL: response.RedirectURL, ConnectionID: response.ConnectedAccountID}, nil
}

func (s *Integrations) OpenConnect(ctx context.Context, profileID, appID string) (IntegrationAuthLink, error) {
	link, err := s.Connect(ctx, profileID, appID)
	if err != nil {
		return IntegrationAuthLink{}, err
	}
	if err := s.openURL(link.URL); err != nil {
		return IntegrationAuthLink{}, errors.New("cannot open the system browser")
	}
	return link, nil
}

func (s *Integrations) Disconnect(ctx context.Context, profileID, connectionID string) error {
	if err := s.validateProfile(profileID); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.status(ctx, profileID)
	if err != nil {
		return err
	}
	for _, connection := range state.Connections {
		if connection.ID == connectionID {
			return s.request(ctx, s.key, http.MethodDelete, "/connected_accounts/"+url.PathEscape(connectionID), nil, nil, nil, http.StatusNoContent)
		}
	}
	return errors.New("connection does not belong to this local profile")
}

func (s *Integrations) activeConnection(ctx context.Context, profileID, appID string) (IntegrationConnection, error) {
	state, err := s.status(ctx, profileID)
	if err != nil {
		return IntegrationConnection{}, err
	}
	if !state.Configured {
		return IntegrationConnection{}, errors.New("Composio is not configured")
	}
	for _, connection := range state.Connections {
		if connection.AppID == appID && connection.Status == "ACTIVE" {
			return connection, nil
		}
	}
	return IntegrationConnection{}, errors.New("app is not connected for this local profile")
}

func (s *Integrations) Tools(ctx context.Context, profileID, appID string) ([]IntegrationTool, error) {
	if err := s.validateProfile(profileID); err != nil {
		return nil, err
	}
	if _, allowed := integrationReadTools[appID]; !allowed {
		return nil, errors.New("app is not available")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.activeConnection(ctx, profileID, appID); err != nil {
		return nil, err
	}
	return s.tools(ctx, appID)
}

func (s *Integrations) tools(ctx context.Context, appID string) ([]IntegrationTool, error) {
	if cached, exists := s.toolCache[appID]; exists {
		return cached, nil
	}
	allowed := integrationReadTools[appID]
	query := url.Values{"tool_slugs": {strings.Join(allowed, ",")}, "include_deprecated": {"false"}, "limit": {"100"}}
	var response struct {
		Items []struct {
			Slug            string         `json:"slug"`
			Name            string         `json:"name"`
			Description     string         `json:"description"`
			Version         string         `json:"version"`
			InputParameters map[string]any `json:"input_parameters"`
			IsDeprecated    bool           `json:"is_deprecated"`
			Toolkit         struct {
				Slug string `json:"slug"`
			} `json:"toolkit"`
		} `json:"items"`
	}
	if err := s.request(ctx, s.key, http.MethodGet, "/tools", query, nil, &response, http.StatusOK); err != nil {
		return nil, err
	}
	tools := []IntegrationTool{}
	seen := make(map[string]bool)
	for _, item := range response.Items {
		if !slices.Contains(allowed, item.Slug) || item.Toolkit.Slug != appID || item.IsDeprecated || strings.TrimSpace(item.Version) == "" || seen[item.Slug] {
			continue
		}
		seen[item.Slug] = true
		tools = append(tools, IntegrationTool{
			Slug: item.Slug, AppID: appID, Name: item.Name, Description: item.Description,
			Version: item.Version, Parameters: item.InputParameters,
		})
	}
	s.toolCache[appID] = tools
	return tools, nil
}

func (s *Integrations) Run(ctx context.Context, profileID, slug string, arguments map[string]any) (IntegrationResult, error) {
	if err := s.validateProfile(profileID); err != nil {
		return IntegrationResult{}, err
	}
	appID := ""
	for app, slugs := range integrationReadTools {
		if slices.Contains(slugs, slug) {
			appID = app
			break
		}
	}
	if appID == "" {
		return IntegrationResult{}, errors.New("tool is not in the read-only allowlist")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	connection, err := s.activeConnection(ctx, profileID, appID)
	if err != nil {
		return IntegrationResult{}, err
	}
	tools, err := s.tools(ctx, appID)
	if err != nil {
		return IntegrationResult{}, err
	}
	for _, tool := range tools {
		if tool.Slug != slug {
			continue
		}
		if arguments == nil {
			arguments = map[string]any{}
		}
		body := map[string]any{
			"connected_account_id": connection.ID, "user_id": profileID, "version": tool.Version, "arguments": arguments,
		}
		var result IntegrationResult
		if err := s.request(ctx, s.key, http.MethodPost, "/tools/execute/"+slug, nil, body, &result, http.StatusOK); err != nil {
			return IntegrationResult{}, err
		}
		result.Data = integrationPublicData(result.Data)
		result.Error = ""
		if !result.Successful {
			result.Error = "Composio could not complete the read-only request"
		}
		return result, nil
	}
	return IntegrationResult{}, errors.New("read-only tool metadata is not available")
}

func integrationPublicData(value any) any {
	switch v := value.(type) {
	case string:
		trimmed := strings.TrimSpace(v)
		if !(strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[")) || !json.Valid([]byte(v)) {
			return v
		}
		var decoded any
		decoder := json.NewDecoder(strings.NewReader(v))
		decoder.UseNumber()
		if decoder.Decode(&decoded) != nil {
			return v
		}
		redacted, err := json.Marshal(integrationPublicData(decoded))
		if err != nil {
			return v
		}
		return string(redacted)
	case []any:
		result := make([]any, len(v))
		for i, item := range v {
			result[i] = integrationPublicData(item)
		}
		return result
	case map[string]any:
		result := make(map[string]any, len(v))
		for key, item := range v {
			switch strings.ToLower(key) {
			case "env", "envs", "environmentvariables", "credentials", "access_token", "refresh_token", "api_key", "token", "authorization", "password", "client_secret":
				result[key] = "[redacted]"
			default:
				result[key] = integrationPublicData(item)
			}
		}
		return result
	default:
		return value
	}
}
