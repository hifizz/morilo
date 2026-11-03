package main

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

//go:embed integrations/extension.ts
var integrationExtensionSource []byte

type integrationEndpoint struct {
	url   string
	token string
	path  string
}

func (s *Integrations) bridge(profileID string) (integrationEndpoint, error) {
	if err := s.validateProfile(profileID); err != nil {
		return integrationEndpoint{}, err
	}
	s.bridgeMu.Lock()
	defer s.bridgeMu.Unlock()
	if endpoint, exists := s.bridges[profileID]; exists {
		return endpoint, nil
	}
	if s.extensionPath == "" {
		dir, err := s.extensionDir()
		if err != nil {
			return integrationEndpoint{}, err
		}
		path := filepath.Join(dir, "integration-extension.ts")
		if err := os.WriteFile(path, integrationExtensionSource, 0o600); err != nil {
			return integrationEndpoint{}, err
		}
		if err := os.Chmod(path, 0o600); err != nil {
			return integrationEndpoint{}, err
		}
		s.extensionPath = path
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return integrationEndpoint{}, err
	}
	token := hex.EncodeToString(key)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /tools", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			App string `json:"app"`
		}
		if !decode(w, r, &req) {
			return
		}
		tools, err := s.Tools(r.Context(), profileID, req.App)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			writeJSON(w, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, tools)
	})
	mux.HandleFunc("POST /run", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Slug      string         `json:"slug"`
			Arguments map[string]any `json:"arguments"`
		}
		if !decode(w, r, &req) {
			return
		}
		result, err := s.Run(r.Context(), profileID, req.Slug, req.Arguments)
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadGateway)
			writeJSON(w, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, result)
	})
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return integrationEndpoint{}, err
	}
	server := &http.Server{Handler: requireToken(token, mux), ReadHeaderTimeout: 5 * time.Second}
	endpoint := integrationEndpoint{url: "http://" + listener.Addr().String(), token: token, path: s.extensionPath}
	s.bridges[profileID], s.servers[profileID] = endpoint, server
	go server.Serve(listener)
	return endpoint, nil
}

func (s *Integrations) close() {
	s.bridgeMu.Lock()
	defer s.bridgeMu.Unlock()
	for profileID, server := range s.servers {
		server.Close()
		delete(s.servers, profileID)
		delete(s.bridges, profileID)
	}
}
