package main

import (
	"crypto/rand"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"path/filepath"

	"grokbot/computer"
)

//go:embed computer/extension.ts
var computerExtensionSource []byte

type computerEndpoint struct {
	url   string
	token string
	path  string
}

func (c *Computer) bridge() (computerEndpoint, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.server != nil {
		return computerEndpoint{c.url, c.token, c.extensionPath}, nil
	}
	dir, err := piAgentDir()
	if err != nil {
		return computerEndpoint{}, err
	}
	ext := filepath.Join(dir, "computer-extension.ts")
	if err := os.WriteFile(ext, computerExtensionSource, 0o600); err != nil {
		return computerEndpoint{}, err
	}
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return computerEndpoint{}, err
	}
	token := hex.EncodeToString(key)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /exec", c.execHandler)
	mux.HandleFunc("POST /read", c.readHandler)
	mux.HandleFunc("POST /write", c.writeHandler)
	mux.HandleFunc("POST /desktop", c.desktopHandler)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return computerEndpoint{}, err
	}
	c.server = &http.Server{Handler: requireToken(token, mux)}
	go c.server.Serve(ln)
	c.url = "http://" + ln.Addr().String()
	c.token = token
	c.extensionPath = ext
	return computerEndpoint{c.url, token, ext}, nil
}

func (c *Computer) close() {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.server != nil {
		c.server.Close()
		c.server = nil
	}
}

func requireToken(token string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2<<20)).Decode(v); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func (c *Computer) execHandler(w http.ResponseWriter, r *http.Request) {
	var cmd computer.Command
	if !decode(w, r, &cmd) {
		return
	}
	if err := c.backend.Wake(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	res, err := c.backend.Exec(r.Context(), cmd)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, res)
}

func (c *Computer) readHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if !decode(w, r, &req) {
		return
	}
	if err := c.backend.Wake(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	data, err := c.backend.ReadFile(r.Context(), req.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write(data)
}

func (c *Computer) writeHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if !decode(w, r, &req) {
		return
	}
	if err := c.backend.Wake(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	if err := c.backend.WriteFile(r.Context(), req.Path, []byte(req.Content)); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}

func (c *Computer) desktopHandler(w http.ResponseWriter, r *http.Request) {
	var action computer.Action
	if !decode(w, r, &action) {
		return
	}
	if err := c.backend.Wake(r.Context()); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	if action.Action == "screenshot" {
		png, err := c.backend.Screenshot(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Write(png)
		return
	}
	if err := c.backend.Act(r.Context(), action); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	writeJSON(w, map[string]bool{"ok": true})
}
