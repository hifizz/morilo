package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testDiagnostics(t *testing.T, handler http.HandlerFunc) devDiagnostics {
	t.Helper()
	settings, _ := settingsAt(t)
	integrations := testIntegrations(t, "fake-key", handler)
	integrations.validateProfile = func(id string) error { _, err := settings.profile(id); return err }
	return devDiagnostics{settings: settings, integrations: integrations}
}

func TestDevDiagnosticsStatus(t *testing.T) {
	settings, _ := settingsAt(t)
	snap, err := settings.Get()
	if err != nil {
		t.Fatal(err)
	}
	profileID := snap.ActiveProfileID
	integrations := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if r.Method != http.MethodGet || r.URL.Path != "/connected_accounts" ||
			q.Get("user_ids") != profileID || q.Get("toolkit_slugs") != "github,vercel" ||
			q.Get("account_type") != "PRIVATE" {
			t.Errorf("unexpected status request %s?%s", r.URL, r.URL.RawQuery)
		}
		w.Write([]byte(`{"items":[]}`))
	})
	integrations.validateProfile = func(id string) error { _, err := settings.profile(id); return err }
	d := devDiagnostics{settings: settings, integrations: integrations}
	value, err := d.run(context.Background(), devDiagnosticRequest{ID: "t1", Action: "status"})
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	body := string(data)
	if !strings.Contains(body, `"configured":true`) || !strings.Contains(body, `"keychainStored":true`) ||
		!strings.Contains(body, `"profileId":"`+profileID+`"`) || !strings.Contains(body, `"connections":[]`) {
		t.Fatalf("unexpected status payload: %s", body)
	}
	if strings.Contains(body, "fake-key") {
		t.Fatalf("key material exposed: %s", body)
	}
}

func TestDevDiagnosticsRejectsUnknownAction(t *testing.T) {
	d := devDiagnostics{}
	for _, action := range []string{"eval", "shell", "configure-key"} {
		if _, err := d.run(context.Background(), devDiagnosticRequest{ID: "t2", Action: action, Arguments: map[string]any{"code": "anything"}}); err == nil || !strings.Contains(err.Error(), "unknown development diagnostic action") {
			t.Fatalf("action %q accepted: %v", action, err)
		}
	}
}

func TestDevDiagnosticsKeychainError(t *testing.T) {
	d := testDiagnostics(t, func(w http.ResponseWriter, r *http.Request) { t.Fatal("provider called on keychain failure") })
	d.integrations.secretGet = func() ([]byte, error) { return nil, errors.New("sensitive-value (OSStatus -25308)") }
	_, err := d.run(context.Background(), devDiagnosticRequest{ID: "t3", Action: "status"})
	if err == nil {
		t.Fatal("keychain read failure hidden")
	}
	if !strings.Contains(err.Error(), "(macOS OSStatus -25308)") || strings.Contains(err.Error(), "sensitive-value") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestWriteDevDiagnostic(t *testing.T) {
	path := filepath.Join(t.TempDir(), "out.json")
	payload := []byte(`{"ok":true}`)
	if err := writeDevDiagnostic(path, payload); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil || string(data) != string(payload) {
		t.Fatalf("file contents %q: %v", data, err)
	}
	info, err := os.Stat(path)
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("file mode %v: %v", info.Mode().Perm(), err)
	}
	if _, err := os.Stat(path + ".tmp"); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("temporary file left behind")
	}
}
