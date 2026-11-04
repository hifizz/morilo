package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/egoist/mygo"
)

const integrationTestProfile = "6b483089-0a14-4c1f-8c15-2c7f39917bdd"
const integrationOtherProfile = "4ce82b39-c9bb-475e-a965-250395908aea"

func testIntegrations(t *testing.T, key string, handler http.HandlerFunc) *Integrations {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != key {
			t.Errorf("unexpected API key header")
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("missing JSON content type")
		}
		handler(w, r)
	}))
	t.Cleanup(server.Close)
	s, err := newIntegrationsAt(t.TempDir(), func(id string) error {
		if id != integrationTestProfile && id != integrationOtherProfile {
			return errors.New("unknown local profile")
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	s.baseURL = server.URL
	s.client.Transport = server.Client().Transport
	s.secretGet = func() ([]byte, error) {
		if key == "" {
			return nil, mygo.ErrSecretNotFound
		}
		return []byte(key), nil
	}
	s.secretSet = func([]byte) error { return nil }
	s.envKey = func() string { return "" }
	s.extensionDir = func() (string, error) { return filepath.Dir(s.configPath), nil }
	t.Cleanup(s.close)
	return s
}

func integrationTestJSON(t *testing.T, r *http.Request) map[string]any {
	t.Helper()
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	return body
}

func integrationTestResponse(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(value)
}

func integrationTestAccount(id, app, status string) map[string]any {
	return map[string]any{"id": id, "toolkit": map[string]any{"slug": app}, "status": status, "alias": "Demo account"}
}

func integrationTestMetadata(slug, app, version string) map[string]any {
	return map[string]any{
		"slug": slug, "toolkit": map[string]any{"slug": app}, "version": version,
		"name": "Read data", "description": "Read data", "input_parameters": map[string]any{"type": "object"},
	}
}

func TestIntegrationsUnconfiguredAndSecretErrors(t *testing.T) {
	s := testIntegrations(t, "", func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected provider request") })
	state, err := s.Status(context.Background(), integrationTestProfile)
	if err != nil || state.Configured || state.Connections == nil || len(state.Connections) != 0 {
		t.Fatalf("unexpected unconfigured state: %+v, %v", state, err)
	}
	s.keyLoaded = false
	s.secretGet = func() ([]byte, error) { return nil, errors.New("keychain locked fake-secret") }
	if _, err := s.Status(context.Background(), integrationTestProfile); err == nil || strings.Contains(err.Error(), "fake-secret") {
		t.Fatalf("keychain failure must be safe and visible: %v", err)
	}
	if _, err := s.Status(context.Background(), "default"); err == nil {
		t.Fatal("unknown profile accepted")
	}
}

func TestIntegrationsMissingKeyCanBeProvisionedExternally(t *testing.T) {
	requests, reads := 0, 0
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		requests++
		q := r.URL.Query()
		if r.Method != http.MethodGet || r.URL.Path != "/connected_accounts" || len(q) != 4 ||
			q.Get("user_ids") != integrationTestProfile || q.Get("toolkit_slugs") != "github,vercel" ||
			q.Get("account_type") != "PRIVATE" || q.Get("limit") != "100" {
			t.Errorf("unexpected scoped account request: %s %s", r.Method, r.URL)
		}
		integrationTestResponse(w, map[string]any{"items": []any{}})
	})
	provisioned := false
	s.secretGet = func() ([]byte, error) {
		reads++
		if !provisioned {
			return nil, mygo.ErrSecretNotFound
		}
		return []byte("fake-key"), nil
	}
	ctx := context.Background()
	state, err := s.Status(ctx, integrationTestProfile)
	if err != nil || state.Configured || len(state.Connections) != 0 || requests != 0 || reads != 1 {
		t.Fatalf("missing key should remain unconfigured without HTTP: %+v err=%v requests=%d reads=%d", state, err, requests, reads)
	}
	provisioned = true
	state, err = s.Status(ctx, integrationTestProfile)
	if err != nil || !state.Configured || requests != 1 || reads != 2 {
		t.Fatalf("externally provisioned key was not loaded: %+v err=%v requests=%d reads=%d", state, err, requests, reads)
	}
	state, err = s.Status(ctx, integrationTestProfile)
	if err != nil || !state.Configured || requests != 2 || reads != 2 {
		t.Fatalf("configured key should remain cached: %+v err=%v requests=%d reads=%d", state, err, requests, reads)
	}
}

func TestIntegrationsConfigureKeyValidationAndRotation(t *testing.T) {
	calls := 0
	s := testIntegrations(t, "new-key", func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "GET" || r.URL.Path != "/toolkits/github" {
			t.Errorf("unexpected validation request: %s %s", r.Method, r.URL)
		}
		if calls == 1 {
			w.Header().Set("x-request-id", "safe-request-123")
			w.WriteHeader(401)
			w.Write([]byte(`{"error":"new-key secret-body"}`))
			return
		}
		integrationTestResponse(w, map[string]any{"slug": "github"})
	})
	s.secretGet = func() ([]byte, error) { return []byte("old-key"), nil }
	s.envKey = func() string { return "ignored-env-key" }
	s.authConfigs["github"] = "old-config"
	s.toolCache["github"] = []IntegrationTool{{Slug: "old"}}
	var saved []byte
	s.secretSet = func(value []byte) error { saved = value; return nil }
	for _, key := range []string{"", " \n ", strings.Repeat("x", mygo.MaxSecretSize+1)} {
		if err := s.ConfigureKey(context.Background(), key); err == nil {
			t.Fatal("invalid input accepted")
		}
	}
	if calls != 0 || saved != nil {
		t.Fatal("invalid input reached provider or keychain")
	}
	err := s.ConfigureKey(context.Background(), "new-key")
	if err == nil || strings.Contains(err.Error(), "new-key") || strings.Contains(err.Error(), "secret-body") || !strings.Contains(err.Error(), "401") || !strings.Contains(err.Error(), "safe-request-123") {
		t.Fatalf("unsafe or missing provider error: %v", err)
	}
	if saved != nil || s.key != "old-key" || s.authConfigs["github"] != "old-config" {
		t.Fatal("failed validation destroyed previous configuration")
	}
	if err := s.ConfigureKey(context.Background(), " new-key \n"); err != nil {
		t.Fatal(err)
	}
	if string(saved) != "new-key" || s.key != "new-key" || len(s.authConfigs) != 0 || len(s.toolCache) != 0 {
		t.Fatal("key rotation did not reset project caches")
	}
	data, err := os.ReadFile(s.configPath)
	if err != nil || strings.Contains(string(data), "key") || string(data) != "{}" {
		t.Fatalf("unsafe persisted configuration: %q, %v", data, err)
	}
}

func TestIntegrationsStatusFiltersPaginationAndSafeDTO(t *testing.T) {
	calls := 0
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		calls++
		q := r.URL.Query()
		if r.Method != "GET" || r.URL.Path != "/connected_accounts" || q.Get("user_ids") != integrationTestProfile || q.Get("toolkit_slugs") != "github,vercel" || q.Get("limit") != "100" || q.Get("account_type") != "PRIVATE" {
			t.Errorf("wrong scoped list request: %s %s", r.Method, r.URL)
		}
		if calls == 1 {
			active := integrationTestAccount("active", "github", "ACTIVE")
			active["state"] = map[string]any{"access_token": "secret-token"}
			active["data"] = "credentials"
			foreign := integrationTestAccount("foreign", "github", "ACTIVE")
			foreign["user_id"] = integrationOtherProfile
			disabled := integrationTestAccount("disabled", "vercel", "ACTIVE")
			disabled["auth_config"] = map[string]any{"is_disabled": true}
			integrationTestResponse(w, map[string]any{
				"items":       []any{active, foreign, disabled, integrationTestAccount("other", "slack", "ACTIVE")},
				"next_cursor": "next & page",
			})
			return
		}
		if q.Get("cursor") != "next & page" {
			t.Errorf("missing encoded cursor: %s", r.URL)
		}
		integrationTestResponse(w, map[string]any{"items": []any{integrationTestAccount("pending", "vercel", "INITIATED")}})
	})
	state, err := s.Status(context.Background(), integrationTestProfile)
	if err != nil || !state.Configured || len(state.Connections) != 3 || calls != 2 {
		t.Fatalf("unexpected state: %+v %v", state, err)
	}
	if state.Connections[0].Status != "ACTIVE" || state.Connections[1].Status != "DISABLED" || state.Connections[2].Status != "INITIATED" {
		t.Fatalf("statuses altered incorrectly: %+v", state.Connections)
	}
	data, _ := json.Marshal(state)
	for _, secret := range []string{"secret-token", "credentials", "access_token", "fake-key", "foreign"} {
		if strings.Contains(string(data), secret) {
			t.Fatalf("unsafe state DTO contains %q", secret)
		}
	}
}

func TestIntegrationsCredentialErrorsExposeOnlyOSStatus(t *testing.T) {
	cases := []struct {
		name    string
		saveErr error
		want    string
	}{
		{"unsafe", errors.New("unsafe keychain error: new-key old-key"), "cannot save Composio key in the system credential store"},
		{"osstatus", errors.New("mygo: secrets: keychain: add: new-key old-key (OSStatus -25308)"), "cannot save Composio key in the system credential store (macOS OSStatus -25308)"},
		{"malformed", errors.New("keychain: add (OSStatus new-key)"), "cannot save Composio key in the system credential store"},
		{"generic", errors.New("unsupported backend"), "cannot save Composio key in the system credential store"},
	}
	for _, tc := range cases {
		s := testIntegrations(t, "new-key", func(w http.ResponseWriter, r *http.Request) {
			integrationTestResponse(w, map[string]any{"slug": "github"})
		})
		s.secretGet = func() ([]byte, error) { return []byte("old-key"), nil }
		s.secretSet = func(value []byte) error { return tc.saveErr }
		s.authConfigs["github"] = "old-config"
		s.toolCache["github"] = []IntegrationTool{{Slug: "old-tool"}}
		if err := s.saveConfigs(s.authConfigs); err != nil {
			t.Fatal(err)
		}
		err := s.ConfigureKey(context.Background(), "new-key")
		if err == nil || err.Error() != tc.want {
			t.Fatalf("%s: got %v want %q", tc.name, err, tc.want)
		}
		if s.key != "old-key" || s.authConfigs["github"] != "old-config" || len(s.toolCache["github"]) != 1 {
			t.Fatalf("%s: failed key save replaced the existing configuration", tc.name)
		}
	}
	s := testIntegrations(t, "old-key", func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected provider request") })
	s.secretGet = func() ([]byte, error) {
		return nil, errors.New("mygo: secrets: keychain: read: secret-value (OSStatus -25293)")
	}
	_, err := s.Status(context.Background(), integrationTestProfile)
	want := "cannot read Composio key in the system credential store (macOS OSStatus -25293)"
	if err == nil || err.Error() != want {
		t.Fatalf("read: got %v want %q", err, want)
	}
}

func TestIntegrationsFailedSecretSaveKeepsPreviousConfiguration(t *testing.T) {
	s := testIntegrations(t, "new-key", func(w http.ResponseWriter, r *http.Request) {
		integrationTestResponse(w, map[string]any{"slug": "github"})
	})
	s.secretGet = func() ([]byte, error) { return []byte("old-key"), nil }
	s.secretSet = func(value []byte) error { return errors.New("unsafe keychain error: new-key") }
	s.authConfigs["github"] = "old-config"
	s.toolCache["github"] = []IntegrationTool{{Slug: "old-tool"}}
	if err := s.saveConfigs(s.authConfigs); err != nil {
		t.Fatal(err)
	}
	if err := s.ConfigureKey(context.Background(), "new-key"); err == nil || strings.Contains(err.Error(), "new-key") {
		t.Fatalf("unsafe keychain save failure: %v", err)
	}
	if s.key != "old-key" || s.authConfigs["github"] != "old-config" || len(s.toolCache["github"]) != 1 {
		t.Fatal("failed key save replaced the existing configuration")
	}
	data, err := os.ReadFile(s.configPath)
	if err != nil || string(data) != `{"github":"old-config"}` {
		t.Fatalf("existing configuration was not restored: %s %v", data, err)
	}
}

func TestIntegrationsConnectAuthConfigsAndPersistence(t *testing.T) {
	for _, app := range []string{"github", "vercel"} {
		t.Run(app, func(t *testing.T) {
			configs, links := 0, 0
			s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
				switch r.URL.Path {
				case "/auth_configs":
					configs++
					if r.Method != "POST" {
						t.Errorf("wrong auth config method: %s", r.Method)
					}
					auth := map[string]any{"type": "use_composio_managed_auth", "name": "Grokbot GitHub read-only demo", "credentials": map[string]any{"scopes": "read:user"}}
					if app == "vercel" {
						auth = map[string]any{"type": "use_custom_auth", "authScheme": "API_KEY", "name": "Grokbot Vercel", "credentials": map[string]any{}}
					}
					want := map[string]any{"toolkit": map[string]any{"slug": app}, "auth_config": auth}
					if body := integrationTestJSON(t, r); !reflect.DeepEqual(body, want) {
						t.Errorf("wrong config body: %#v", body)
					}
					w.WriteHeader(201)
					integrationTestResponse(w, map[string]any{"auth_config": map[string]any{"id": "ac_" + app}, "toolkit": map[string]any{"slug": app}})
				case "/connected_accounts/link":
					links++
					if r.Method != "POST" {
						t.Errorf("wrong link method: %s", r.Method)
					}
					want := map[string]any{"auth_config_id": "ac_" + app, "user_id": integrationTestProfile}
					if body := integrationTestJSON(t, r); !reflect.DeepEqual(body, want) {
						t.Errorf("wrong link body: %#v", body)
					}
					w.WriteHeader(201)
					integrationTestResponse(w, map[string]any{
						"redirect_url":         "https://connect.composio.dev/link/session",
						"connected_account_id": "ca_pending", "link_token": "never-return-this",
					})
				default:
					t.Errorf("unexpected or retired endpoint: %s", r.URL)
					w.WriteHeader(404)
				}
			})
			s.openURL = func(value string) error {
				if value != "https://connect.composio.dev/link/session" {
					t.Errorf("wrong opened URL")
				}
				return nil
			}
			link, err := s.OpenConnect(context.Background(), integrationTestProfile, app)
			if err != nil || link.ConnectionID != "ca_pending" {
				t.Fatalf("connect: %+v %v", link, err)
			}
			if _, err := s.Connect(context.Background(), integrationTestProfile, app); err != nil {
				t.Fatal(err)
			}
			if configs != 1 || links != 2 {
				t.Fatalf("configs=%d links=%d", configs, links)
			}
			data, err := os.ReadFile(s.configPath)
			if err != nil || string(data) != `{"`+app+`":"ac_`+app+`"}` {
				t.Fatalf("unexpected persistence: %s %v", data, err)
			}
			info, _ := os.Stat(s.configPath)
			if info.Mode().Perm() != 0o600 {
				t.Fatalf("unsafe file mode: %v", info.Mode())
			}
			reloaded, err := newIntegrationsAt(filepath.Dir(s.configPath), s.validateProfile)
			if err != nil || reloaded.authConfigs[app] != "ac_"+app {
				t.Fatalf("auth config reload failed: %v", err)
			}
			serialized, _ := json.Marshal(link)
			if strings.Contains(string(serialized), "never-return-this") {
				t.Fatal("link token leaked")
			}
		})
	}
}

func TestIntegrationsRejectUnsafeLinksAndUnknownApps(t *testing.T) {
	badURL := ""
	calls := 0
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(201)
		integrationTestResponse(w, map[string]any{"redirect_url": badURL, "connected_account_id": "pending"})
	})
	s.authConfigs["github"] = "ac_github"
	if _, err := s.Connect(context.Background(), integrationTestProfile, "slack"); err == nil || calls != 0 {
		t.Fatal("unsupported app reached provider")
	}
	for _, value := range []string{"http://connect.composio.dev/a", "https://composio.dev.evil.test/a", "https://evil.test/a", "https://user:secret@connect.composio.dev/a", "https://connect.composio.dev:123/a"} {
		badURL = value
		if _, err := s.Connect(context.Background(), integrationTestProfile, "github"); err == nil || strings.Contains(err.Error(), value) {
			t.Fatalf("unsafe URL accepted or echoed: %v", err)
		}
	}
}

func TestIntegrationsDisconnectProfileScope(t *testing.T) {
	deletes := 0
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "DELETE" {
			deletes++
			if r.URL.EscapedPath() != "/connected_accounts/own%2Fid" || r.URL.RawQuery != "" {
				t.Errorf("unsafe delete path or revoke option: %s", r.URL)
			}
			w.WriteHeader(204)
			return
		}
		if r.URL.Query().Get("user_ids") != integrationTestProfile {
			t.Error("missing profile filter")
		}
		integrationTestResponse(w, map[string]any{"items": []any{integrationTestAccount("own/id", "github", "ACTIVE")}})
	})
	if err := s.Disconnect(context.Background(), integrationTestProfile, "foreign"); err == nil || deletes != 0 {
		t.Fatal("cross-profile disconnect allowed")
	}
	if err := s.Disconnect(context.Background(), integrationTestProfile, "own/id"); err != nil || deletes != 1 {
		t.Fatalf("scoped disconnect failed: %v", err)
	}
}

func TestIntegrationsReadToolAllowlistExecutionAndRedaction(t *testing.T) {
	const slug = "VERCEL_GET_PROJECTS"
	calls, metadataCalls := 0, 0
	successful := true
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		calls++
		switch r.URL.Path {
		case "/connected_accounts":
			if r.Method != "GET" || r.URL.Query().Get("user_ids") != integrationTestProfile {
				t.Errorf("wrong profile scope: %s %s", r.Method, r.URL)
			}
			integrationTestResponse(w, map[string]any{"items": []any{
				integrationTestAccount("pending", "vercel", "INITIATED"),
				integrationTestAccount("scoped-first", "vercel", "ACTIVE"),
				integrationTestAccount("scoped-second", "vercel", "ACTIVE"),
			}})
		case "/tools":
			metadataCalls++
			q := r.URL.Query()
			if r.Method != "GET" || q.Get("tool_slugs") != "VERCEL_GET_PROJECTS,VERCEL_GET_DEPLOYMENTS" || q.Get("include_deprecated") != "false" || q.Get("limit") != "100" {
				t.Errorf("wrong metadata request: %s", r.URL)
			}
			deprecated := integrationTestMetadata("VERCEL_GET_DEPLOYMENTS", "vercel", "deprecated_version")
			deprecated["is_deprecated"] = true
			integrationTestResponse(w, map[string]any{"items": []any{
				integrationTestMetadata(slug, "vercel", "20261101_01"),
				integrationTestMetadata("VERCEL_CREATE_AUTH_TOKEN", "vercel", "latest"),
				deprecated,
				integrationTestMetadata("VERCEL_GET_DEPLOYMENTS", "vercel", ""),
				integrationTestMetadata("GITHUB_GET_THE_AUTHENTICATED_USER", "github", "v1"),
			}})
		case "/tools/execute/" + slug:
			if r.Method != "POST" {
				t.Errorf("wrong execute method: %s", r.Method)
			}
			want := map[string]any{
				"connected_account_id": "scoped-first", "user_id": integrationTestProfile,
				"version": "20261101_01", "arguments": map[string]any{"limit": float64(5), "teamId": "team_demo"},
			}
			if body := integrationTestJSON(t, r); !reflect.DeepEqual(body, want) {
				t.Errorf("wrong execute body: %#v", body)
			}
			integrationTestResponse(w, map[string]any{
				"successful": successful, "error": "fake-key provider-secret",
				"data": map[string]any{"projects": []any{map[string]any{
					"name": "demo", "env": []any{"hidden"}, "ENVs": "hidden", "environmentVariables": "hidden",
					"nested": `{"access_token":"hidden","count":2,"items":[{"token":"hidden","name":"ok"}]}`,
				}}},
			})
		default:
			t.Errorf("unexpected endpoint: %s", r.URL)
			w.WriteHeader(404)
		}
	})
	for _, rejected := range []string{"VERCEL_CREATE_AUTH_TOKEN", "GITHUB_CREATE_AN_ISSUE", "VERCEL_LIST_PROJECTS", "../../proxy"} {
		if _, err := s.Run(context.Background(), integrationTestProfile, rejected, nil); err == nil || calls != 0 {
			t.Fatal("non-whitelisted execution reached provider")
		}
	}
	tools, err := s.Tools(context.Background(), integrationTestProfile, "vercel")
	if err != nil || len(tools) != 1 || tools[0].Slug != slug || tools[0].Version != "20261101_01" {
		t.Fatalf("metadata filtering failed: %+v %v", tools, err)
	}
	if _, err := s.Run(context.Background(), integrationTestProfile, "VERCEL_GET_DEPLOYMENTS", nil); err == nil {
		t.Fatal("unavailable or deprecated metadata executed")
	}
	args := map[string]any{"limit": 5, "teamId": "team_demo"}
	result, err := s.Run(context.Background(), integrationTestProfile, slug, args)
	if err != nil || !result.Successful || result.Error != "" || metadataCalls != 1 {
		t.Fatalf("run failed: %+v %v", result, err)
	}
	data, _ := json.Marshal(result)
	if strings.Contains(string(data), "hidden") || strings.Contains(string(data), "provider-secret") || !strings.Contains(string(data), `\"count\":2`) || !strings.Contains(string(data), "[redacted]") {
		t.Fatalf("unsafe or transformed read result: %s", data)
	}
	successful = false
	result, err = s.Run(context.Background(), integrationTestProfile, slug, args)
	if err != nil || result.Successful || result.Error == "" || strings.Contains(result.Error, "provider-secret") {
		t.Fatalf("provider failure not surfaced safely: %+v %v", result, err)
	}
}

func TestIntegrationsSavedKeyPrecedesEnvironmentAndCachesPrivately(t *testing.T) {
	s := testIntegrations(t, "saved-key", func(w http.ResponseWriter, r *http.Request) {
		integrationTestResponse(w, map[string]any{"items": []any{}})
	})
	reads := 0
	s.secretGet = func() ([]byte, error) {
		reads++
		return []byte("saved-key"), nil
	}
	s.envKey = func() string { return "ignored-environment-key" }
	for range 2 {
		state, err := s.Status(context.Background(), integrationTestProfile)
		if err != nil || !state.Configured {
			t.Fatalf("saved key not used: %v", err)
		}
	}
	if reads != 1 {
		t.Fatalf("keychain read %d times instead of caching", reads)
	}
	fallback := testIntegrations(t, "environment-key", func(w http.ResponseWriter, r *http.Request) {
		integrationTestResponse(w, map[string]any{"items": []any{}})
	})
	fallback.secretGet = func() ([]byte, error) { return nil, mygo.ErrSecretNotFound }
	fallback.envKey = func() string { return "environment-key" }
	if state, err := fallback.Status(context.Background(), integrationTestProfile); err != nil || !state.Configured {
		t.Fatalf("backend environment fallback failed: %v", err)
	}
}

func TestIntegrationsHTTPFailuresAreSafeAndDoNotFollowRedirects(t *testing.T) {
	for _, code := range []int{302, 401, 500} {
		t.Run(http.StatusText(code), func(t *testing.T) {
			redirected := false
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				redirected = true
				w.WriteHeader(500)
			}))
			defer target.Close()
			s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Location", target.URL)
				w.Header().Set("x-request-id", "request-fake-key")
				w.WriteHeader(code)
				w.Write([]byte(`{"error":"fake-key hidden-link-token"}`))
			})
			_, err := s.Status(context.Background(), integrationTestProfile)
			if err == nil || strings.Contains(err.Error(), "fake-key") || strings.Contains(err.Error(), "hidden-link-token") || redirected {
				t.Fatalf("unsafe provider failure: %v redirected=%v", err, redirected)
			}
		})
	}
}

func TestIntegrationsPublicDataRedactsOnlySensitiveFields(t *testing.T) {
	source := map[string]any{"count": float64(17), "items": []any{map[string]any{"name": "demo", "token": "hidden"}}}
	for _, key := range []string{"env", "envs", "environmentVariables", "credentials", "access_token", "refresh_token", "api_key", "token", "authorization", "password", "client_secret"} {
		source[key] = "hidden"
	}
	sanitized := integrationPublicData(source).(map[string]any)
	if sanitized["count"] != float64(17) || source["token"] != "hidden" {
		t.Fatal("sanitizer changed counts or mutated source")
	}
	data, _ := json.Marshal(sanitized)
	if strings.Contains(string(data), "hidden") || !strings.Contains(string(data), `"name":"demo"`) {
		t.Fatalf("unsafe public data: %s", data)
	}
	for _, value := range []any{nil, true, float64(3), "plain text"} {
		if !reflect.DeepEqual(integrationPublicData(value), value) {
			t.Errorf("noncredential value changed: %v", value)
		}
	}
}

func TestIntegrationsPublicDataPreservesTypesAndLargeIntegers(t *testing.T) {
	source := `{"id":9007199254740993,"count":"17","enabled":"true","notes":"null","env":["hidden"],"nested":"{\"id\":9007199254740993,\"token\":\"hidden\"}"}`
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(source))
	})
	var result any
	if err := s.request(context.Background(), "fake-key", http.MethodGet, "/test", nil, nil, &result, http.StatusOK); err != nil {
		t.Fatal(err)
	}
	result = integrationPublicData(result)
	data, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{`"id":9007199254740993`, `"count":"17"`, `"enabled":"true"`, `"notes":"null"`, `\"id\":9007199254740993`} {
		if !strings.Contains(string(data), expected) {
			t.Fatalf("changed read result: missing %s in %s", expected, data)
		}
	}
	if strings.Contains(string(data), "hidden") {
		t.Fatal("sensitive values were retained")
	}
	for _, value := range []string{"17", "true", "null", `"quoted"`, "  9007199254740993  "} {
		if got := integrationPublicData(value); got != value {
			t.Fatalf("string %q changed to %#v", value, got)
		}
	}
	text, ok := integrationPublicData(source).(string)
	if !ok || !strings.Contains(text, `"id":9007199254740993`) || strings.Contains(text, "hidden") {
		t.Fatalf("JSON-string type, precision, or redaction changed: %T %s", integrationPublicData(source), text)
	}
}

func TestIntegrationsPendingIsNotConnectedAndAllProfilesValidated(t *testing.T) {
	calls := 0
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/connected_accounts" {
			t.Error("pending account fetched tools or executed")
		}
		integrationTestResponse(w, map[string]any{"items": []any{integrationTestAccount("pending", "github", "INITIATED")}})
	})
	ctx := context.Background()
	if _, err := s.Tools(ctx, integrationTestProfile, "github"); err == nil {
		t.Fatal("pending account counted as connected")
	}
	if _, err := s.Run(ctx, integrationTestProfile, "GITHUB_GET_THE_AUTHENTICATED_USER", nil); err == nil {
		t.Fatal("pending account executed a tool")
	}
	before := calls
	_, statusErr := s.Status(ctx, "unknown")
	_, connectErr := s.Connect(ctx, "unknown", "github")
	_, openErr := s.OpenConnect(ctx, "unknown", "github")
	disconnectErr := s.Disconnect(ctx, "unknown", "any")
	_, toolsErr := s.Tools(ctx, "unknown", "github")
	_, runErr := s.Run(ctx, "unknown", "GITHUB_GET_THE_AUTHENTICATED_USER", nil)
	for _, err := range []error{statusErr, connectErr, openErr, disconnectErr, toolsErr, runErr} {
		if err == nil {
			t.Fatal("unknown profile accepted")
		}
	}
	if calls != before {
		t.Fatal("unknown profile reached provider")
	}
}

func TestDecodeDevelopmentCredential(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
		fail  bool
	}{
		{name: "quoted ascii", input: "password: \"0123456789abcdef\"\n", want: "0123456789abcdef"},
		{name: "quoted empty", input: "password: \"\"\n", want: ""},
		{name: "hex with escapes", input: "password: 0x71756F746522206261636B736C6173685C2061706F7374726F70686527  \"ignored rendering\"\n", want: "quote\" backslash\\ apostrophe'"},
		{name: "hex unicode", input: "password: 0xE4B8ADE696872DE298832DCF80  \"ignored rendering\"\n", want: "中文-☃-π"},
		{name: "bad hex", input: "password: 0xZZ sensitive-value", fail: true},
		{name: "hex no payload", input: "password: 0x", fail: true},
		{name: "unexpected", input: "unexpected sensitive-value", fail: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, err := decodeDevelopmentCredential([]byte(tt.input))
			if tt.fail {
				if err == nil || err.Error() != "unexpected macOS credential response" {
					t.Fatalf("error = %v, want exact 'unexpected macOS credential response'", err)
				}
				if value != nil {
					t.Fatalf("value = %q, want nil", value)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if string(value) != tt.want {
				t.Fatalf("value = %q, want %q", value, tt.want)
			}
		})
	}
}
