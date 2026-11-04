package computer

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const defaultAPIURL = "https://api.instabox.sh"

type Instabox struct {
	apiURL    string
	key       string
	machineID string
	client    *http.Client

	wakeMu sync.Mutex
	shotMu sync.Mutex
}

func NewInstabox(apiURL, key, machineID string) *Instabox {
	if apiURL == "" {
		apiURL = defaultAPIURL
	}
	return &Instabox{
		apiURL:    strings.TrimSuffix(apiURL, "/"),
		key:       key,
		machineID: machineID,
		client: &http.Client{
			Timeout: 10 * time.Minute,
			// Never follow redirects: X-API-Key must not leak to another host.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
	}
}

func (m *Instabox) Info(ctx context.Context) (Info, error) {
	data, err := m.do(ctx, http.MethodGet, m.machinePath(), nil, nil, nil)
	if err != nil {
		return Info{}, err
	}
	var info Info
	return info, json.Unmarshal(data, &info)
}

func (m *Instabox) Wake(ctx context.Context) error {
	m.wakeMu.Lock()
	defer m.wakeMu.Unlock()
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	info, err := m.Info(ctx)
	if err != nil {
		return err
	}
	if info.State == "running" {
		return nil
	}
	key := make([]byte, 16)
	if _, err := rand.Read(key); err != nil {
		return err
	}
	data, err := m.do(ctx, http.MethodPost, m.machinePath()+"/start", nil, struct{}{},
		http.Header{"Idempotency-Key": []string{hex.EncodeToString(key)}})
	if err != nil {
		return err
	}
	var op Operation
	if err := json.Unmarshal(data, &op); err != nil {
		return err
	}
	for !op.done() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(500 * time.Millisecond):
		}
		data, err := m.do(ctx, http.MethodGet, "/v1/operations/"+url.PathEscape(op.ID), nil, nil, nil)
		if err != nil {
			return err
		}
		if err := json.Unmarshal(data, &op); err != nil {
			return err
		}
	}
	if op.State == "failed" {
		return fmt.Errorf("instabox: start failed: %s", op.Error.Message)
	}
	return nil
}

type Operation struct {
	ID        string `json:"id"`
	MachineID string `json:"machineId"`
	Type      string `json:"type"`
	State     string `json:"state"`
	Error     struct {
		Message string `json:"message"`
	} `json:"error"`
}

// Machines lists every machine on the account, following nextCursor pages.
func (m *Instabox) Machines(ctx context.Context) ([]Info, error) {
	var all []Info
	seen := map[string]bool{}
	cursor := ""
	for {
		q := url.Values{}
		if cursor != "" {
			q.Set("cursor", cursor)
		}
		data, err := m.do(ctx, http.MethodGet, "/v1/machines", q, nil, nil)
		if err != nil {
			return nil, err
		}
		var page struct {
			Machines   []Info  `json:"machines"`
			NextCursor *string `json:"nextCursor"`
		}
		if err := json.Unmarshal(data, &page); err != nil {
			return nil, err
		}
		all = append(all, page.Machines...)
		if page.NextCursor == nil || *page.NextCursor == "" {
			return all, nil
		}
		if seen[*page.NextCursor] {
			return nil, errors.New("instabox: repeated pagination cursor")
		}
		seen[*page.NextCursor] = true
		cursor = *page.NextCursor
	}
}

// Me returns the account login only; other user fields are discarded.
func (m *Instabox) Me(ctx context.Context) (string, error) {
	data, err := m.do(ctx, http.MethodGet, "/v1/me", nil, nil, nil)
	if err != nil {
		return "", err
	}
	var me struct {
		Login string `json:"login"`
	}
	if err := json.Unmarshal(data, &me); err != nil {
		return "", err
	}
	return me.Login, nil
}

// AgentTemplate returns the default spec of the latest creatable
// agent-browser template. ok is false when no such template exists.
func (m *Instabox) AgentTemplate(ctx context.Context) (Spec, bool, error) {
	data, err := m.do(ctx, http.MethodGet, "/v1/templates", nil, nil, nil)
	if err != nil {
		return Spec{}, false, err
	}
	var templates struct {
		Templates []struct {
			ID          string `json:"id"`
			Latest      bool   `json:"latest"`
			Creatable   bool   `json:"creatable"`
			DefaultSpec Spec   `json:"defaultSpec"`
		} `json:"templates"`
	}
	if err := json.Unmarshal(data, &templates); err != nil {
		return Spec{}, false, err
	}
	for _, t := range templates.Templates {
		if t.ID == "agent-browser" && t.Latest && t.Creatable {
			return t.DefaultSpec, true, nil
		}
	}
	return Spec{}, false, nil
}

var machineNamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,62}$`)

// CreateMachine submits a creation request. idempotencyKey is generated and
// persisted by the caller so retries reuse the exact same body and key.
func (m *Instabox) CreateMachine(ctx context.Context, name, idempotencyKey string) (Operation, error) {
	if !machineNamePattern.MatchString(name) {
		return Operation{}, fmt.Errorf("instabox: invalid machine name %q", name)
	}
	if idempotencyKey == "" {
		return Operation{}, errors.New("instabox: creation requires an idempotency key")
	}
	body := map[string]any{"name": name, "templateId": "agent-browser", "vault": false, "secrets": []string{}, "envSecrets": []string{}}
	data, err := m.do(ctx, http.MethodPost, "/v1/machines", nil, body,
		http.Header{"Idempotency-Key": []string{idempotencyKey}})
	if err != nil {
		return Operation{}, err
	}
	return decodeOperation(data)
}

// Operation fetches one Operation's state.
func (m *Instabox) Operation(ctx context.Context, id string) (Operation, error) {
	data, err := m.do(ctx, http.MethodGet, "/v1/operations/"+url.PathEscape(id), nil, nil, nil)
	if err != nil {
		return Operation{}, err
	}
	return decodeOperation(data)
}

func decodeOperation(data []byte) (Operation, error) {
	var op Operation
	if err := json.Unmarshal(data, &op); err != nil {
		return op, errors.New("instabox: invalid operation response")
	}
	if op.ID == "" {
		return op, errors.New("instabox: operation response is missing its ID")
	}
	switch op.State {
	case "queued", "running", "succeeded", "failed":
		return op, nil
	default:
		return op, errors.New("instabox: unknown operation state")
	}
}

func (o Operation) done() bool {
	return o.State == "succeeded" || o.State == "failed"
}

func (m *Instabox) Exec(ctx context.Context, c Command) (Result, error) {
	if c.Command == "" {
		return Result{}, errors.New("computer: empty command")
	}
	if c.TimeoutSeconds != 0 && (c.TimeoutSeconds < 1 || c.TimeoutSeconds > 600) {
		return Result{}, fmt.Errorf("computer: timeoutSeconds %d out of range 1..600", c.TimeoutSeconds)
	}
	cwd := c.Cwd
	if cwd == "" {
		cwd = "/data/home"
	}
	timeout := c.TimeoutSeconds
	if timeout == 0 {
		timeout = 60
	}
	return m.exec(ctx, execRequest{Cmd: c.Command, Cwd: cwd, TimeoutSeconds: timeout})
}

type execRequest struct {
	Cmd            string            `json:"cmd,omitempty"`
	Argv           []string          `json:"argv,omitempty"`
	Cwd            string            `json:"cwd,omitempty"`
	Envs           map[string]string `json:"envs,omitempty"`
	Stdin          string            `json:"stdin,omitempty"`
	TimeoutSeconds int               `json:"timeoutSeconds,omitempty"`
}

func (m *Instabox) exec(ctx context.Context, req execRequest) (Result, error) {
	data, err := m.do(ctx, http.MethodPost, m.machinePath()+"/exec", nil, req, nil)
	if err != nil {
		return Result{}, err
	}
	var res Result
	return res, json.Unmarshal(data, &res)
}

func (m *Instabox) execArgv(ctx context.Context, argv []string, stdin string) (Result, error) {
	return m.exec(ctx, execRequest{Argv: argv, Envs: map[string]string{"DISPLAY": ":1"}, Stdin: stdin, TimeoutSeconds: 60})
}

func (m *Instabox) ReadFile(ctx context.Context, name string) ([]byte, error) {
	if name == "" {
		return nil, errors.New("computer: empty path")
	}
	q := url.Values{"path": {remotePath(name)}}
	return m.do(ctx, http.MethodGet, m.machinePath()+"/files/content", q, nil, nil)
}

func (m *Instabox) WriteFile(ctx context.Context, name string, content []byte) error {
	if name == "" {
		return errors.New("computer: empty path")
	}
	q := url.Values{"path": {remotePath(name)}, "parents": {"true"}}
	_, err := m.do(ctx, http.MethodPut, m.machinePath()+"/files", q, content, nil)
	return err
}

func remotePath(name string) string {
	if path.IsAbs(name) {
		return name
	}
	return path.Join("/data/home", name)
}

func (m *Instabox) DesktopURL(ctx context.Context, viewOnly bool) (string, error) {
	if err := m.startDesktop(ctx); err != nil {
		return "", err
	}
	data, err := m.do(ctx, http.MethodPost, m.machinePath()+"/desktop/stream", nil,
		struct {
			ViewOnly bool `json:"viewOnly"`
			TTL      int  `json:"ttlSeconds"`
		}{ViewOnly: viewOnly, TTL: 3600}, nil)
	if err != nil {
		return "", err
	}
	var stream struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(data, &stream); err != nil {
		return "", err
	}
	return stream.URL, nil
}

func (m *Instabox) startDesktop(ctx context.Context) error {
	data, err := m.do(ctx, http.MethodPost, m.machinePath()+"/desktop", nil,
		struct {
			Action string `json:"action"`
			Width  int    `json:"width"`
			Height int    `json:"height"`
		}{Action: "start", Width: 1280, Height: 800}, nil)
	if err != nil {
		return err
	}
	var desktop struct {
		Running bool `json:"running"`
	}
	if err := json.Unmarshal(data, &desktop); err != nil {
		return err
	}
	if !desktop.Running {
		return errors.New("instabox: desktop did not start")
	}
	return nil
}

const screenshotPath = "/tmp/morilo-screen.png"

func (m *Instabox) Screenshot(ctx context.Context) ([]byte, error) {
	m.shotMu.Lock()
	defer m.shotMu.Unlock()
	if err := m.startDesktop(ctx); err != nil {
		return nil, err
	}
	res, err := m.execArgv(ctx, []string{"scrot", "-o", screenshotPath}, "")
	if err != nil {
		return nil, err
	}
	if res.ExitCode != 0 {
		return nil, fmt.Errorf("instabox: scrot exited %d: %s", res.ExitCode, res.Stderr)
	}
	return m.ReadFile(ctx, screenshotPath)
}

func (m *Instabox) Act(ctx context.Context, a Action) error {
	argv, stdin, err := actionArgv(a)
	if err != nil {
		return err
	}
	if err := m.startDesktop(ctx); err != nil {
		return err
	}
	res, err := m.execArgv(ctx, argv, stdin)
	if err != nil {
		return err
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("instabox: %s exited %d: %s", a.Action, res.ExitCode, res.Stderr)
	}
	return nil
}

func actionArgv(a Action) ([]string, string, error) {
	switch a.Action {
	case "click":
		if a.X < 0 || a.Y < 0 {
			return nil, "", fmt.Errorf("computer: negative coordinates %d,%d", a.X, a.Y)
		}
		return []string{"xdotool", "mousemove", strconv.Itoa(a.X), strconv.Itoa(a.Y), "click", "1"}, "", nil
	case "type":
		return []string{"xdotool", "type", "--clearmodifiers", "--delay", "0", "--file", "-"}, a.Text, nil
	case "press":
		if a.Keys == "" {
			return nil, "", errors.New("computer: press needs keys")
		}
		return []string{"xdotool", "key", "--clearmodifiers", "--", a.Keys}, "", nil
	case "scroll":
		button := map[string]string{"up": "4", "down": "5", "left": "6", "right": "7"}[a.Direction]
		if button == "" {
			return nil, "", fmt.Errorf("computer: unknown scroll direction %q", a.Direction)
		}
		amount := a.Amount
		if amount == 0 {
			amount = 3
		}
		if amount < 1 || amount > 100 {
			return nil, "", fmt.Errorf("computer: scroll amount %d out of range 1..100", amount)
		}
		return []string{"xdotool", "click", "--repeat", strconv.Itoa(amount), "--delay", "30", button}, "", nil
	}
	return nil, "", fmt.Errorf("computer: unknown action %q", a.Action)
}

func (m *Instabox) machinePath() string {
	return "/v1/machines/" + url.PathEscape(m.machineID)
}

func (m *Instabox) do(ctx context.Context, method, path string, q url.Values, body any, header http.Header) ([]byte, error) {
	var reader io.Reader
	switch b := body.(type) {
	case nil:
	case []byte:
		reader = bytes.NewReader(b)
		if header == nil {
			header = http.Header{}
		}
		header.Set("Content-Type", "application/octet-stream")
	default:
		data, err := json.Marshal(b)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(data)
		if header == nil {
			header = http.Header{}
		}
		header.Set("Content-Type", "application/json")
	}
	u := m.apiURL + path
	if len(q) > 0 {
		u += "?" + q.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, u, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", m.key)
	for name, values := range header {
		req.Header[name] = values
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var bodyReader io.Reader = resp.Body
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyReader = io.LimitReader(resp.Body, 64<<10)
	}
	data, err := io.ReadAll(bodyReader)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &APIError{StatusCode: resp.StatusCode, Status: resp.Status,
			Path: path, Message: m.redact(data)}
	}
	return data, nil
}

// APIError is a non-2xx Instabox response. Message is bounded and has the
// credential redacted; it never contains the request key.
type APIError struct {
	StatusCode int
	Status     string
	Path       string
	Message    string
}

func (e *APIError) Error() string {
	msg := e.Message
	if len(msg) > 200 {
		msg = msg[:200]
	}
	return fmt.Sprintf("instabox: %s: %s: %s", e.Path, e.Status, msg)
}

func (m *Instabox) redact(data []byte) string {
	body := string(data)
	if m.key != "" {
		body = strings.ReplaceAll(body, m.key, "***")
	}
	return body
}
