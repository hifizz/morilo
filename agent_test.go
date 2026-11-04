package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/egoist/mygo"
)

// TestPiSessionRoundTrip drives one real prompt through a pi subprocess and
// expects streamed text followed by settlement.
func TestPiSessionRoundTrip(t *testing.T) {
	if os.Getenv("MORILO_LIVE_TEST") != "1" {
		t.Skip("set MORILO_LIVE_TEST=1 for a configured real provider")
	}
	sess, err := startPi("test", nil)
	if err != nil {
		t.Fatalf("startPi: %v", err)
	}
	defer sess.kill()

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	got := make(chan ChatEvent, 1024)
	done := make(chan error, 1)
	go func() {
		done <- sess.prompt(ctx, "Reply with exactly: OK", func(e ChatEvent) bool {
			got <- e
			return true
		})
	}()

	var text string
	var sawDone bool
	for !sawDone {
		select {
		case e := <-got:
			if e.Type == "text" {
				text += e.Delta
			}
			if e.Type == "done" {
				sawDone = true
			}
			if e.Type == "error" {
				t.Fatalf("stream error: %s", e.Detail)
			}
		case err := <-done:
			if err != nil {
				t.Fatalf("prompt: %v", err)
			}
			sawDone = true
		case <-ctx.Done():
			t.Fatal("timed out waiting for the run to settle")
		}
	}
	if text == "" {
		t.Fatal("no text streamed")
	}
	t.Logf("streamed: %q", text)
}

func writeExecutable(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
}

func TestResolvePiCommand(t *testing.T) {
	t.Run("production missing bundle fails", func(t *testing.T) {
		if _, err := resolvePiCommand(t.TempDir(), false, "--mode", "rpc"); err == nil {
			t.Fatal("production without a bundle must fail")
		}
	})
	t.Run("production uses absolute bundled node and cli", func(t *testing.T) {
		dir := t.TempDir()
		writeExecutable(t, filepath.Join(dir, "runtime/bin/node"))
		cli := filepath.Join(dir, "runtime/node_modules/@earendil-works/pi-coding-agent/dist/cli.js")
		if err := os.MkdirAll(filepath.Dir(cli), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(cli, []byte("//cli"), 0o644); err != nil {
			t.Fatal(err)
		}
		cmd, err := resolvePiCommand(dir, false, "--mode", "rpc")
		if err != nil {
			t.Fatal(err)
		}
		if cmd.Path != filepath.Join(dir, "runtime/bin/node") {
			t.Fatalf("Path = %q", cmd.Path)
		}
		if len(cmd.Args) != 4 || cmd.Args[1] != cli || cmd.Args[3] != "rpc" {
			t.Fatalf("Args = %v", cmd.Args)
		}
	})
	t.Run("partial bundle fails in production", func(t *testing.T) {
		dir := t.TempDir()
		writeExecutable(t, filepath.Join(dir, "runtime/bin/node"))
		if _, err := resolvePiCommand(dir, false, "--mode", "rpc"); err == nil {
			t.Fatal("missing cli.js must fail in production")
		}
	})
	t.Run("development falls back to PATH pi", func(t *testing.T) {
		dir := t.TempDir()
		bin := filepath.Join(dir, "bin")
		writeExecutable(t, filepath.Join(bin, "pi"))
		t.Setenv("PATH", bin)
		cmd, err := resolvePiCommand(t.TempDir(), true, "--mode", "rpc")
		if err != nil {
			t.Fatal(err)
		}
		if cmd.Path != filepath.Join(bin, "pi") && cmd.Args[0] != filepath.Join(bin, "pi") {
			t.Fatalf("expected PATH pi, got %v %v", cmd.Path, cmd.Args)
		}
	})
}

// TestPackagedModelConnection runs the bundled Node+Pi against a local SSE
// fixture: real packaged runtime round-trip and credential rejection, not a
// paid provider. Skipped unless MORILO_PACKAGED_RESOURCES points at a
// prepared resources/darwin-<arch> directory.
func TestPackagedModelConnection(t *testing.T) {
	resources := os.Getenv("MORILO_PACKAGED_RESOURCES")
	if resources == "" {
		t.Skip("set MORILO_PACKAGED_RESOURCES to a prepared resources dir")
	}
	old, _ := mygo.App.Path(mygo.PathResources)
	mygo.App.SetPath(mygo.PathResources, resources)
	t.Cleanup(func() { mygo.App.SetPath(mygo.PathResources, old) })
	t.Setenv("PATH", "/usr/bin:/bin")

	chunks := []map[string]any{
		{"id": "smoke", "object": "chat.completion.chunk", "created": 1, "model": "runtime-smoke",
			"choices": []map[string]any{{"index": 0, "delta": map[string]any{"role": "assistant", "content": "OK"}, "finish_reason": nil}}},
		{"id": "smoke", "object": "chat.completion.chunk", "created": 1, "model": "runtime-smoke",
			"choices": []map[string]any{{"index": 0, "delta": map[string]any{}, "finish_reason": "stop"}},
			"usage":   map[string]any{"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}},
	}
	var sawOK, sawBad atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/chat/completions" {
			http.Error(w, "unexpected", http.StatusNotFound)
			return
		}
		if r.Header.Get("Authorization") != "Bearer runtime-test-key" {
			sawBad.Store(true)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req struct {
			Model string `json:"model"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Model != "runtime-smoke" {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		sawOK.Store(true)
		w.Header().Set("Content-Type", "text/event-stream")
		for _, chunk := range chunks {
			data, _ := json.Marshal(chunk)
			fmt.Fprintf(w, "data: %s\n\n", data)
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}))
	defer srv.Close()

	config := ModelConnection{API: "openai-completions", BaseURL: srv.URL + "/v1",
		ModelID: "runtime-smoke", ContextWindow: 128000, MaxTokens: 128}
	if err := probeModelWithPi(context.Background(), config, []byte("runtime-test-key")); err != nil {
		t.Fatalf("packaged probe failed: %v", err)
	}
	if !sawOK.Load() {
		t.Fatal("fixture server never saw a valid chat completion request")
	}
	if err := probeModelWithPi(context.Background(), config, []byte("invalid-key")); err == nil {
		t.Fatal("wrong key must fail validation")
	}
	if !sawBad.Load() {
		t.Fatal("fixture server never received the invalid-key request")
	}
}
