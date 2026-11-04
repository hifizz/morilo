package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
)

func TestIntegrationBridgeAuthenticationMethodsAndProfileIsolation(t *testing.T) {
	profiles := []string{}
	s := testIntegrations(t, "fake-key", func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/connected_accounts":
			profileID := r.URL.Query().Get("user_ids")
			profiles = append(profiles, profileID)
			integrationTestResponse(w, map[string]any{"items": []any{integrationTestAccount(profileID+"-account", "github", "ACTIVE")}})
		case "/tools":
			integrationTestResponse(w, map[string]any{"items": []any{integrationTestMetadata("GITHUB_GET_THE_AUTHENTICATED_USER", "github", "v_demo")}})
		case "/tools/execute/GITHUB_GET_THE_AUTHENTICATED_USER":
			body := integrationTestJSON(t, r)
			if body["user_id"] != integrationOtherProfile || body["connected_account_id"] != integrationOtherProfile+"-account" {
				t.Errorf("bridge profile override leaked into execution: %#v", body)
			}
			integrationTestResponse(w, map[string]any{"data": map[string]any{"login": "demo"}, "successful": false, "error": "provider-secret"})
		default:
			t.Errorf("unexpected request: %s", r.URL)
			w.WriteHeader(404)
		}
	})
	first, err := s.bridge(integrationTestProfile)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.bridge(integrationOtherProfile)
	if err != nil {
		t.Fatal(err)
	}
	cached, err := s.bridge(integrationTestProfile)
	if err != nil || cached != first || first.url == second.url || first.token == second.token || len(first.token) != 64 || !strings.HasPrefix(first.url, "http://127.0.0.1:") {
		t.Fatalf("invalid isolated bridge endpoints: %v", err)
	}
	call := func(endpoint integrationEndpoint, method, path, token, body string, wantStatus int) string {
		t.Helper()
		req, err := http.NewRequest(method, endpoint.url+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		result, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != wantStatus {
			t.Fatalf("status=%d want=%d body=%s", resp.StatusCode, wantStatus, result)
		}
		if strings.Contains(string(result), "fake-key") || strings.Contains(string(result), "provider-secret") {
			t.Fatal("bridge exposed secret")
		}
		return string(result)
	}
	call(first, "POST", "/tools", "", `{"app":"github"}`, 401)
	call(first, "POST", "/tools", second.token, `{"app":"github"}`, 401)
	call(first, "GET", "/tools", first.token, "", 405)
	call(first, "POST", "/tools", first.token, `{`, 400)
	call(first, "POST", "/tools", first.token, `{"app":"`+strings.Repeat("x", (2<<20)+1)+`"}`, 400)
	if len(profiles) != 0 {
		t.Fatal("rejected bridge request reached provider")
	}
	body := call(first, "POST", "/tools", first.token, `{"app":"github","profileID":"`+integrationOtherProfile+`"}`, 200)
	var tools []IntegrationTool
	if err := json.Unmarshal([]byte(body), &tools); err != nil || len(tools) != 1 {
		t.Fatalf("invalid tools DTO: %s %v", body, err)
	}
	body = call(second, "POST", "/run", second.token, `{"slug":"GITHUB_GET_THE_AUTHENTICATED_USER","arguments":{},"profileID":"`+integrationTestProfile+`"}`, 200)
	var result IntegrationResult
	if err := json.Unmarshal([]byte(body), &result); err != nil || result.Successful || result.Error == "" {
		t.Fatalf("provider failure was lost: %s %v", body, err)
	}
	if len(profiles) != 2 || profiles[0] != integrationTestProfile || profiles[1] != integrationOtherProfile {
		t.Fatalf("bridge scope mismatch: %v", profiles)
	}
	if _, err := s.bridge("default"); err == nil {
		t.Fatal("unknown bridge profile accepted")
	}
	source, err := os.ReadFile(first.path)
	if err != nil || strings.Contains(string(source), first.token) || strings.Contains(string(source), "fake-key") || !strings.Contains(string(source), "MORILO_APPS_TOKEN") {
		t.Fatalf("unsafe or missing extension: %v", err)
	}
	info, _ := os.Stat(first.path)
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("unsafe extension mode: %v", info.Mode())
	}
	s.close()
	if len(s.servers) != 0 || len(s.bridges) != 0 {
		t.Fatal("bridge servers not cleared")
	}
	if _, err := http.Get(first.url + "/tools"); err == nil {
		t.Fatal("bridge still accepting requests after close")
	}
}

func TestIntegrationBridgeExistsBeforeConfiguration(t *testing.T) {
	s := testIntegrations(t, "", func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected provider request") })
	s.secretGet = func() ([]byte, error) { t.Error("bridge creation read a secret"); return nil, nil }
	if _, err := s.bridge(integrationTestProfile); err != nil {
		t.Fatal(err)
	}
	s.secretGet = func() ([]byte, error) { return nil, nil }
	if _, err := s.Tools(context.Background(), integrationTestProfile, "github"); err == nil {
		t.Fatal("unconfigured service returned tools")
	}
}
