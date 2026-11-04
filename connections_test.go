package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/egoist/mygo"
	"github.com/hifizz/morilo/computer"
)

type fakeSecrets struct {
	data    map[string][]byte
	failSet bool
}

func newFakeSecrets() *fakeSecrets {
	f := &fakeSecrets{data: map[string][]byte{}}
	return f
}
func (f *fakeSecrets) read(_, a string) ([]byte, error) {
	v, ok := f.data[a]
	if !ok {
		return nil, errors.New("not found")
	}
	return v, nil
}
func (f *fakeSecrets) write(_, a string, v []byte) error {
	if f.failSet {
		return errors.New("denied")
	}
	f.data[a] = v
	return nil
}
func (f *fakeSecrets) delete(_, a string) error { delete(f.data, a); return nil }

func (f *fakeSecrets) funcs() secretFuncs {
	return secretFuncs{read: f.read, write: f.write, delete: f.delete}
}

type fakeBox struct {
	machines  []computer.Info
	info      computer.Info
	spec      computer.Spec
	hasSpec   bool
	login     string
	wakeErr   error
	deskErr   error
	deskCalls int
	posts     int
	ops       []computer.Operation
	created   []string
	idemKeys  []string
	createErr error
}

func (b *fakeBox) Info(context.Context) (computer.Info, error) { return b.info, nil }
func (b *fakeBox) Wake(context.Context) error                  { return b.wakeErr }
func (b *fakeBox) Exec(context.Context, computer.Command) (computer.Result, error) {
	return computer.Result{}, nil
}
func (b *fakeBox) ReadFile(context.Context, string) ([]byte, error) { return nil, nil }
func (b *fakeBox) WriteFile(context.Context, string, []byte) error  { return nil }
func (b *fakeBox) Screenshot(context.Context) ([]byte, error)       { return nil, nil }
func (b *fakeBox) Act(context.Context, computer.Action) error       { return nil }
func (b *fakeBox) DesktopURL(context.Context, bool) (string, error) {
	b.deskCalls++
	if b.deskErr != nil {
		return "", b.deskErr
	}
	return "https://desk.example/s", nil
}
func (b *fakeBox) Machines(context.Context) ([]computer.Info, error) { return b.machines, nil }
func (b *fakeBox) Me(context.Context) (string, error)                { return b.login, nil }
func (b *fakeBox) AgentTemplate(context.Context) (computer.Spec, bool, error) {
	return b.spec, b.hasSpec, nil
}
func (b *fakeBox) CreateMachine(_ context.Context, name, idempotencyKey string) (computer.Operation, error) {
	b.posts++
	b.created = append(b.created, name)
	b.idemKeys = append(b.idemKeys, idempotencyKey)
	if b.createErr != nil {
		return computer.Operation{}, b.createErr
	}
	return computer.Operation{ID: "op1", MachineID: "m-new", State: "queued"}, nil
}
func (b *fakeBox) Operation(context.Context, string) (computer.Operation, error) {
	if len(b.ops) == 0 {
		return computer.Operation{ID: "op1", State: "queued"}, nil
	}
	op := b.ops[0]
	b.ops = b.ops[1:]
	return op, nil
}

func TestConnectionsCreationSurvivesRestart(t *testing.T) {
	box := &fakeBox{hasSpec: true, createErr: errors.New("connection lost after submission")}
	c, secrets := newTestConnections(t, box)
	if _, err := c.ConfigureInstabox(context.Background(), "private-instabox-key"); err != nil {
		t.Fatal(err)
	}
	result, err := c.CreateMachine(context.Background(), "my-computer")
	if err != nil || result.State != "submitting" {
		t.Fatalf("uncertain creation must remain pending: %+v, %v", result, err)
	}
	restarted, err := newConnectionsAt(c.dir, NewComputer(nil))
	if err != nil {
		t.Fatal(err)
	}
	restarted.secrets, restarted.service = secrets.funcs(), c.service
	restarted.newBox = c.newBox
	box.createErr = nil
	result, err = restarted.RefreshCreation(context.Background())
	if err != nil || result.OperationID != "op1" {
		t.Fatalf("resumed creation: %+v, %v", result, err)
	}
	if len(box.idemKeys) != 2 || box.idemKeys[0] == "" || box.idemKeys[0] != box.idemKeys[1] ||
		box.created[0] != box.created[1] {
		t.Fatal("restart must reuse the persisted request name and idempotency key")
	}
	raw, err := os.ReadFile(c.metaPath)
	if err != nil || strings.Contains(string(raw), "private-instabox-key") {
		t.Fatal("metadata must not contain the raw API key")
	}
}

func TestConnectionsCreationReadinessAndWriteFailures(t *testing.T) {
	for _, scenario := range []string{"starting", "desktop forbidden", "desktop starting", "progress write fails", "final write fails", "missing response machine ID"} {
		t.Run(scenario, func(t *testing.T) {
			box := &fakeBox{hasSpec: true, info: computer.Info{
				ID: "m-new", Name: "my-computer", State: "running", Runtime: computer.Runtime{Ready: true},
			}}
			c, _ := newTestConnections(t, box)
			if _, err := c.ConfigureInstabox(context.Background(), "private-key"); err != nil {
				t.Fatal(err)
			}
			if _, err := c.CreateMachine(context.Background(), "my-computer"); err != nil {
				t.Fatal(err)
			}
			op := computer.Operation{ID: "op1", State: "succeeded"} // existing machine ID must survive omission
			switch scenario {
			case "starting":
				box.info.Runtime.Ready = false
			case "desktop forbidden":
				box.deskErr = &computer.APIError{StatusCode: 403, Status: "403 Forbidden"}
			case "desktop starting":
				box.deskErr = &computer.APIError{StatusCode: 503, Status: "503 Unavailable"}
			case "progress write fails":
				op.State = "running"
				c.metaPath = filepath.Join(t.TempDir(), "absent", "connections.json")
			case "final write fails":
				c.metaPath = filepath.Join(t.TempDir(), "absent", "connections.json")
			}
			box.ops = []computer.Operation{op}
			result, err := c.RefreshCreation(context.Background())
			if scenario == "progress write fails" {
				if err == nil {
					t.Fatal("progress persistence error must be surfaced")
				}
			} else if err != nil {
				t.Fatal(err)
			}
			snap, _ := c.Get()
			if scenario == "missing response machine ID" {
				if result.State != "ready" || snap.MachineID != "m-new" || snap.PendingCreation != nil {
					t.Fatalf("known machine ID should survive missing field: %+v %+v", result, snap)
				}
			} else if result.State == "ready" || snap.MachineID != "" || snap.PendingCreation == nil || c.computer.getBackend() != nil {
				t.Fatalf("unverified/unsaved machine became connected: %+v %+v", result, snap)
			}
			if scenario == "desktop forbidden" && result.State != "failed" {
				t.Fatal("permanent desktop denial must stop automatic polling")
			}
			if scenario == "desktop starting" && result.State != "checking" {
				t.Fatal("temporary desktop failure must remain retryable")
			}
		})
	}
}

func newTestConnections(t *testing.T, box instaboxAPI) (*Connections, *fakeSecrets) {
	t.Helper()
	dir := t.TempDir()
	secrets := newFakeSecrets()
	c, err := newConnectionsAt(dir, NewComputer(nil))
	if err != nil {
		t.Fatal(err)
	}
	c.secrets = secrets.funcs()
	c.service = "test.svc"
	c.probe = func(context.Context, ModelConnection, []byte) error { return nil }
	c.newBox = func(_, _, _ string) instaboxAPI { return box }
	return c, secrets
}

var goodConfig = ModelConnection{
	API: "openai-completions", BaseURL: "https://api.example.com/v1",
	ModelID: "m-1", ContextWindow: 128000, MaxTokens: 4096,
}

func TestConnectionsNewInstall(t *testing.T) {
	c, _ := newTestConnections(t, &fakeBox{})
	snap, err := c.Get()
	if err != nil {
		t.Fatal(err)
	}
	if snap.ModelConfigured || snap.LegacyModel || snap.OnboardingComplete {
		t.Fatalf("fresh install should be unconfigured: %+v", snap)
	}
	if snap.Mode != "chat" {
		t.Fatalf("new install mode = %q, want chat", snap.Mode)
	}
	if snap.HasModelKey || snap.MachineID != "" {
		t.Fatal("fresh install must not carry key or machine")
	}
}

func TestConnectionsSaveModelRollback(t *testing.T) {
	c, secrets := newTestConnections(t, &fakeBox{})
	secrets.failSet = true
	if _, err := c.SaveModel(context.Background(), goodConfig, "sk-test"); err == nil {
		t.Fatal("expected save failure")
	}
	snap, _ := c.Get()
	if snap.ModelConfigured {
		t.Fatal("failed save must not commit config")
	}
	if len(secrets.data) != 0 {
		t.Fatal("no secret should remain after failure")
	}
}

func TestConnectionsSaveModelAndEndpointChange(t *testing.T) {
	c, secrets := newTestConnections(t, &fakeBox{})
	if _, err := c.SaveModel(context.Background(), goodConfig, "sk-test"); err != nil {
		t.Fatal(err)
	}
	if len(secrets.data) != 1 {
		t.Fatalf("want one saved key, got %d", len(secrets.data))
	}
	snap, _ := c.Get()
	if !snap.ModelConfigured || snap.LegacyModel || !snap.HasModelKey {
		t.Fatalf("snapshot after save: %+v", snap)
	}
	// Blank key retains the saved key for the same endpoint.
	if _, err := c.SaveModel(context.Background(), goodConfig, ""); err != nil {
		t.Fatal(err)
	}
	// A changed endpoint must require a key.
	changed := goodConfig
	changed.BaseURL = "https://other.example.com/v1"
	if _, err := c.SaveModel(context.Background(), changed, ""); err == nil {
		t.Fatal("changed endpoint must not reuse the saved key")
	}
}

func TestConnectionsProbeFailureKeepsConfig(t *testing.T) {
	c, secrets := newTestConnections(t, &fakeBox{})
	c.probe = func(context.Context, ModelConnection, []byte) error {
		return errors.New("validation failed")
	}
	if _, err := c.SaveModel(context.Background(), goodConfig, "sk-test"); err == nil {
		t.Fatal("probe failure must stop the save")
	}
	snap, _ := c.Get()
	if snap.ModelConfigured || len(secrets.data) != 0 {
		t.Fatal("nothing should be committed after a failed probe")
	}
}

func TestConnectionsMetadataWriteRollback(t *testing.T) {
	c, secrets := newTestConnections(t, &fakeBox{})
	if _, err := c.SaveModel(context.Background(), goodConfig, "sk-test"); err != nil {
		t.Fatal(err)
	}
	// Make the metadata path unwritable; the working config must survive.
	os.Chmod(c.dir, 0o500)
	defer os.Chmod(c.dir, 0o700)
	changed := goodConfig
	changed.ModelID = "m-2"
	if _, err := c.SaveModel(context.Background(), changed, "sk-new"); err == nil {
		t.Fatal("metadata failure must surface")
	}
	os.Chmod(c.dir, 0o700)
	snap, _ := c.Get()
	if snap.Model.ModelID != "m-1" {
		t.Fatalf("old config must remain after failed write, got %q", snap.Model.ModelID)
	}
	// The failed rotation must not delete the still-selected key.
	found := false
	for _, v := range secrets.data {
		if string(v) == "sk-test" {
			found = true
		}
	}
	if !found {
		t.Fatal("previous key was deleted by a failed rotation")
	}
}

func TestConnectionsFreshSaveKeepsChatAndOnboarding(t *testing.T) {
	c, _ := newTestConnections(t, &fakeBox{})
	snap, err := c.SaveModel(context.Background(), goodConfig, "sk-test")
	if err != nil {
		t.Fatal(err)
	}
	if snap.Mode != "chat" || snap.OnboardingComplete {
		t.Fatalf("fresh save must not change mode or finish onboarding: %+v", snap)
	}
	if _, err := c.FinishOnboarding(); err != nil {
		t.Fatal(err)
	}
	snap, _ = c.Get()
	if !snap.OnboardingComplete {
		t.Fatal("finish should persist")
	}
}

func TestConnectionsFinishRejectsNoModel(t *testing.T) {
	c, _ := newTestConnections(t, &fakeBox{})
	if _, err := c.FinishOnboarding(); err == nil {
		t.Fatal("finish without a model must fail")
	}
}

func TestConnectionsPendingBlocksKeyRotation(t *testing.T) {
	c, _ := newTestConnections(t, &fakeBox{hasSpec: true,
		spec: computer.Spec{VCPUs: 4}, machines: []computer.Info{}})
	if _, err := c.ConfigureInstabox(context.Background(), "ib-key"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.CreateMachine(context.Background(), "n1"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.ConfigureInstabox(context.Background(), "ib-new"); err == nil {
		t.Fatal("key rotation must be rejected while a creation is pending")
	}
}

func TestConnectionsMutationsRejectedDuringRun(t *testing.T) {
	c, _ := newTestConnections(t, &fakeBox{})
	c.cfgMu.RLock() // simulates an active chat run
	defer c.cfgMu.RUnlock()
	if _, err := c.SaveModel(context.Background(), goodConfig, "sk-test"); err == nil {
		t.Fatal("mutation must be rejected while a run holds the gate")
	}
	if _, err := c.SetMode("local"); err == nil {
		t.Fatal("SetMode must be rejected while a run holds the gate")
	}
}

func TestConnectionsConfigureInstaboxAndSelect(t *testing.T) {
	machine := computer.Info{ID: "m-1", Name: "box", State: "running",
		Runtime: computer.Runtime{Ready: true}}
	box := &fakeBox{machines: []computer.Info{machine}, info: machine,
		spec:    computer.Spec{VCPUs: 4, MemMiB: 8192, PersistentDiskGiB: 20},
		hasSpec: true, login: "octocat"}
	c, secrets := newTestConnections(t, box)
	setup, err := c.ConfigureInstabox(context.Background(), "ib-key")
	if err != nil {
		t.Fatal(err)
	}
	if setup.Account != "octocat" || !setup.TemplateAvailable || setup.VCPUs != 4 {
		t.Fatalf("setup: %+v", setup)
	}
	if len(secrets.data) != 1 {
		t.Fatal("instabox key must be stored")
	}
	snap, err := c.SelectMachine(context.Background(), "m-1")
	if err != nil {
		t.Fatal(err)
	}
	if snap.MachineID != "m-1" || snap.Mode != "remote" {
		t.Fatalf("after select: %+v", snap)
	}
	if c.computer.getBackend() == nil {
		t.Fatal("backend must be installed after select")
	}
}

func TestConnectionsDesktop403KeepsSelection(t *testing.T) {
	machine := computer.Info{ID: "m-1", Name: "box", State: "running",
		Runtime: computer.Runtime{Ready: true}}
	box := &fakeBox{machines: []computer.Info{machine}, info: machine,
		deskErr: errors.New("instabox: POST /v1/machines/m-1/desktop/stream: 403 Forbidden")}
	c, _ := newTestConnections(t, box)
	if _, err := c.ConfigureInstabox(context.Background(), "ib-key"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.SelectMachine(context.Background(), "m-1"); err == nil {
		t.Fatal("expected desktop failure")
	}
	snap, _ := c.Get()
	if snap.MachineID == "m-1" && snap.Mode == "remote" {
		t.Fatal("failed selection must not persist")
	}
}

func TestConnectionsCreateAndRefresh(t *testing.T) {
	machine := computer.Info{ID: "m-new", Name: "n1", State: "running",
		Runtime: computer.Runtime{Ready: true}}
	box := &fakeBox{machines: []computer.Info{machine}, info: machine,
		hasSpec: true, spec: computer.Spec{VCPUs: 4},
		ops: []computer.Operation{{ID: "op1", State: "succeeded"}}}
	c, _ := newTestConnections(t, box)
	if _, err := c.ConfigureInstabox(context.Background(), "ib-key"); err != nil {
		t.Fatal(err)
	}
	if _, err := c.CreateMachine(context.Background(), "BAD NAME"); err == nil {
		t.Fatal("name rules must be enforced")
	}
	mc, err := c.CreateMachine(context.Background(), "n1")
	if err != nil || mc.State != "queued" {
		t.Fatalf("create: %+v %v", mc, err)
	}
	if box.posts != 1 {
		t.Fatal("exactly one POST expected")
	}
	// A repeat submission resumes the pending record instead of re-posting.
	mc, err = c.CreateMachine(context.Background(), "n1")
	if err != nil || mc.State != "ready" {
		t.Fatalf("resume: %+v %v", mc, err)
	}
	snap, _ := c.Get()
	if snap.MachineID != "m-new" || snap.Mode != "remote" || snap.PendingCreation != nil {
		t.Fatalf("after ready: %+v", snap)
	}
}

func TestManagedPiFilesShape(t *testing.T) {
	files, err := managedPiFiles(goodConfig)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"models.json", "settings.json", "auth.json"} {
		if len(files[name]) == 0 {
			t.Fatalf("missing %s", name)
		}
	}
	var models struct {
		Providers map[string]struct {
			BaseURL string `json:"baseUrl"`
			API     string `json:"api"`
			APIKey  string `json:"apiKey"`
		} `json:"providers"`
	}
	if err := json.Unmarshal(files["models.json"], &models); err != nil {
		t.Fatal(err)
	}
	p := models.Providers["morilo-user"]
	if p.BaseURL != goodConfig.BaseURL || p.API != goodConfig.API {
		t.Fatalf("provider: %+v", p)
	}
	if p.APIKey != "${MORILO_MODEL_API_KEY}" {
		t.Fatalf("key must be an env reference, got %q", p.APIKey)
	}
	var auth map[string]any
	if err := json.Unmarshal(files["auth.json"], &auth); err != nil || len(auth) != 0 {
		t.Fatal("managed auth.json must be empty")
	}
	for name, data := range files {
		if strings.Contains(string(data), "sk-") || strings.Contains(string(data), "relay.zilin") {
			t.Fatalf("%s leaks secret or legacy provider", name)
		}
	}
}

func TestNewInstallWritesNoPersonalDefaults(t *testing.T) {
	dir := t.TempDir()
	old, _ := mygo.App.Path(mygo.PathUserData)
	mygo.App.SetPath(mygo.PathUserData, dir)
	t.Cleanup(func() { mygo.App.SetPath(mygo.PathUserData, old) })
	got, err := piAgentDir()
	if err != nil {
		t.Fatal(err)
	}
	if got != filepath.Join(dir, "pi-agent") {
		t.Fatalf("piAgentDir = %q", got)
	}
	entries, err := os.ReadDir(got)
	if err != nil || len(entries) != 0 {
		t.Fatal("piAgentDir must create an empty directory only")
	}
}

func TestPiEnvFiltersPrivateVars(t *testing.T) {
	t.Setenv("MORILO_MODEL_API_KEY", "leak-me")
	t.Setenv("MORILO_COMPUTER_URL", "http://leak")
	t.Setenv("MORILO_COMPUTER_TOKEN", "leak-tok")
	t.Setenv("PI_CODING_AGENT_DIR", "/tmp/foreign")
	env := piEnv("/tmp/agent", computerEndpoint{})
	for _, e := range env {
		if strings.Contains(e, "leak") || e == "PI_CODING_AGENT_DIR=/tmp/foreign" {
			t.Fatalf("private env leaked to pi child: %q", e)
		}
	}
	if !hasEnv(env, "PI_CODING_AGENT_DIR=/tmp/agent") {
		t.Fatal("agent dir override missing")
	}
}

func hasEnv(env []string, want string) bool {
	for _, e := range env {
		if e == want {
			return true
		}
	}
	return false
}

func TestListModelsDiscovery(t *testing.T) {
	var gotAuth, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"id":"m-1","display_name":"Model One"},{"id":"m-2"}]}`))
	}))
	defer srv.Close()
	c, _ := newTestConnections(t, &fakeBox{})
	opts, err := c.ListModels(context.Background(), ModelConnection{
		API: "openai-completions", BaseURL: srv.URL}, "sk-test")
	if err != nil {
		t.Fatal(err)
	}
	if len(opts) != 2 || opts[0].Name != "Model One" {
		t.Fatalf("options: %+v", opts)
	}
	if gotAuth != "Bearer sk-test" || gotPath != "/models" {
		t.Fatalf("request: %q %q", gotAuth, gotPath)
	}
}
