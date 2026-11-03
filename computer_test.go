package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"grokbot/computer"
)

type fakeBackend struct {
	mu    sync.Mutex
	calls []string
	exec  computer.Command
	read  string
	write string
	act   computer.Action

	entered       chan struct{}
	cancelled     chan struct{}
	blockOnCancel bool
	viewOnly      bool
}

func (f *fakeBackend) record(name string) {
	f.mu.Lock()
	f.calls = append(f.calls, name)
	f.mu.Unlock()
}

func (f *fakeBackend) called(name string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.calls {
		if c == name {
			return true
		}
	}
	return false
}

func (f *fakeBackend) Info(context.Context) (computer.Info, error) {
	f.record("info")
	return computer.Info{ID: "m1", Name: "box", State: "running"}, nil
}

func (f *fakeBackend) Wake(context.Context) error {
	f.record("wake")
	return nil
}

func (f *fakeBackend) Exec(ctx context.Context, c computer.Command) (computer.Result, error) {
	f.mu.Lock()
	f.calls = append(f.calls, "exec")
	f.exec = c
	block := f.blockOnCancel
	f.mu.Unlock()
	if block {
		close(f.entered)
		<-ctx.Done()
		close(f.cancelled)
		return computer.Result{}, ctx.Err()
	}
	return computer.Result{Stdout: "hi", ExitCode: 0}, nil
}

func (f *fakeBackend) ReadFile(_ context.Context, p string) ([]byte, error) {
	f.mu.Lock()
	f.calls = append(f.calls, "read")
	f.read = p
	f.mu.Unlock()
	return []byte("file body"), nil
}

func (f *fakeBackend) WriteFile(_ context.Context, p string, b []byte) error {
	f.mu.Lock()
	f.calls = append(f.calls, "write")
	f.write = p + "=" + string(b)
	f.mu.Unlock()
	return nil
}

func (f *fakeBackend) Screenshot(context.Context) ([]byte, error) {
	f.record("screenshot")
	return []byte("pngbytes"), nil
}

func (f *fakeBackend) Act(_ context.Context, a computer.Action) error {
	f.mu.Lock()
	f.calls = append(f.calls, "act")
	f.act = a
	f.mu.Unlock()
	return nil
}

func (f *fakeBackend) DesktopURL(_ context.Context, viewOnly bool) (string, error) {
	f.mu.Lock()
	f.calls = append(f.calls, "desktop-url")
	f.viewOnly = viewOnly
	f.mu.Unlock()
	return "https://vnc.example/s1", nil
}

func startTestBridge(t *testing.T, f *fakeBackend) computerEndpoint {
	t.Helper()
	c := NewComputer(f)
	ep, err := c.bridge()
	if err != nil {
		t.Fatalf("bridge: %v", err)
	}
	t.Cleanup(c.close)
	return ep
}

func bridgePost(t *testing.T, ep computerEndpoint, path string, body any, authed bool) *http.Response {
	t.Helper()
	data, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, ep.url+path, bytes.NewReader(data))
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	if authed {
		req.Header.Set("Authorization", "Bearer "+ep.token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("post %s: %v", path, err)
	}
	return resp
}

func TestComputerBridgeAuth(t *testing.T) {
	f := &fakeBackend{}
	ep := startTestBridge(t, f)

	for _, tc := range []struct{ name, auth string }{
		{"none", ""},
		{"wrong", "Bearer nope"},
	} {
		req, _ := http.NewRequest(http.MethodPost, ep.url+"/exec", strings.NewReader(`{"command":"x"}`))
		if tc.auth != "" {
			req.Header.Set("Authorization", tc.auth)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("%s: status %d, want 401", tc.name, resp.StatusCode)
		}
	}
	req, _ := http.NewRequest(http.MethodGet, ep.url+"/exec", nil)
	req.Header.Set("Authorization", "Bearer "+ep.token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("GET /exec: status %d, want 405", resp.StatusCode)
	}
	resp = bridgePost(t, ep, "/nope", map[string]any{}, true)
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("unknown route: status %d, want 404", resp.StatusCode)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if len(f.calls) != 0 {
		t.Fatalf("backend called on rejected requests: %v", f.calls)
	}
}

func TestComputerBridgeDispatch(t *testing.T) {
	f := &fakeBackend{}
	ep := startTestBridge(t, f)

	resp := bridgePost(t, ep, "/exec", map[string]any{"command": "echo hi"}, true)
	var res computer.Result
	json.NewDecoder(resp.Body).Decode(&res)
	resp.Body.Close()
	if res.Stdout != "hi" || f.exec.Command != "echo hi" {
		t.Fatalf("exec: res=%+v cmd=%+v", res, f.exec)
	}

	resp = bridgePost(t, ep, "/read", map[string]any{"path": "a.txt"}, true)
	body, _ := io.ReadAll(resp.Body)
	ct := resp.Header.Get("Content-Type")
	resp.Body.Close()
	if string(body) != "file body" || !strings.HasPrefix(ct, "text/plain") || f.read != "a.txt" {
		t.Fatalf("read: body=%q ct=%q path=%q", body, ct, f.read)
	}

	resp = bridgePost(t, ep, "/write", map[string]any{"path": "a.txt", "content": "v"}, true)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK || f.write != "a.txt=v" {
		t.Fatalf("write: status=%d path=%q", resp.StatusCode, f.write)
	}

	resp = bridgePost(t, ep, "/desktop", map[string]any{"action": "click", "x": 1, "y": 2}, true)
	resp.Body.Close()
	if f.act.Action != "click" || f.act.X != 1 || f.act.Y != 2 {
		t.Fatalf("act: %+v", f.act)
	}

	for _, name := range []string{"exec", "read", "write", "act"} {
		if !f.called(name) {
			t.Fatalf("backend never saw %s (calls: %v)", name, f.calls)
		}
	}
	if !f.called("wake") {
		t.Fatal("bridge did not wake before delegating")
	}
}

func TestComputerBridgeScreenshot(t *testing.T) {
	f := &fakeBackend{}
	ep := startTestBridge(t, f)

	resp := bridgePost(t, ep, "/desktop", map[string]any{"action": "screenshot"}, true)
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "image/png" {
		t.Fatalf("content-type %q, want image/png", ct)
	}
	if string(body) != "pngbytes" {
		t.Fatalf("body %q", body)
	}
}

func TestComputerBridgeCancel(t *testing.T) {
	f := &fakeBackend{
		entered:       make(chan struct{}),
		cancelled:     make(chan struct{}),
		blockOnCancel: true,
	}
	ep := startTestBridge(t, f)

	ctx, cancel := context.WithCancel(context.Background())
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, ep.url+"/exec", strings.NewReader(`{"command":"sleep"}`))
	req.Header.Set("Authorization", "Bearer "+ep.token)
	go func() {
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
	<-f.entered
	cancel()
	select {
	case <-f.cancelled:
	case <-time.After(5 * time.Second):
		t.Fatal("client cancel did not reach the backend")
	}
}

func TestComputerConnect(t *testing.T) {
	for _, takeControl := range []bool{false, true} {
		t.Run(fmt.Sprintf("takeControl=%v", takeControl), func(t *testing.T) {
			f := &fakeBackend{}
			c := NewComputer(f)
			view, err := c.Connect(context.Background(), takeControl)
			if err != nil {
				t.Fatal(err)
			}
			if view.ID != "m1" || view.Name != "box" || view.State != "running" || view.URL != "https://vnc.example/s1" {
				t.Fatalf("view: %+v", view)
			}
			if view.ViewOnly == takeControl || f.viewOnly == takeControl {
				t.Fatalf("viewOnly mismatch: view=%+v fake=%v", view, f.viewOnly)
			}
			if !slices.Equal(f.calls, []string{"wake", "info", "desktop-url"}) {
				t.Fatalf("calls: %v", f.calls)
			}
		})
	}
}

func TestComputerStatusUnconfigured(t *testing.T) {
	c := NewComputer(nil)
	st, err := c.Status(context.Background())
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if st.Configured || st.State != "unconfigured" {
		t.Fatalf("status: %+v", st)
	}
	if _, err := c.Connect(context.Background(), false); err == nil {
		t.Fatal("Connect on unconfigured computer succeeded")
	}
}

func TestPiEnvStripsProviderKey(t *testing.T) {
	t.Setenv("INSTABOX_API_KEY", "sekret")
	t.Setenv("COMPOSIO_API_KEY", "csekret")
	t.Setenv("GROKBOT_APPS_URL", "http://stale")
	t.Setenv("GROKBOT_APPS_TOKEN", "stale")
	env := piEnv("/tmp/agent", computerEndpoint{url: "http://x", token: "tok"})
	seen := map[string]bool{}
	for _, e := range env {
		k, _, _ := strings.Cut(e, "=")
		seen[k] = true
		for _, p := range []string{"INSTABOX_API_KEY=", "COMPOSIO_API_KEY=", "GROKBOT_APPS_URL=", "GROKBOT_APPS_TOKEN="} {
			if strings.HasPrefix(e, p) {
				t.Fatalf("secret or stale bridge env leaked: %s", e)
			}
		}
	}
	for _, k := range []string{"PI_CODING_AGENT_DIR", "GROKBOT_COMPUTER_URL", "GROKBOT_COMPUTER_TOKEN"} {
		if !seen[k] {
			t.Fatalf("missing %s in pi environment", k)
		}
	}
	for _, e := range piEnv("/tmp/agent", computerEndpoint{}) {
		if strings.HasPrefix(e, "GROKBOT_COMPUTER_") || strings.HasPrefix(e, "INSTABOX_API_KEY=") {
			t.Fatalf("unconfigured env leaked: %s", e)
		}
	}
}
