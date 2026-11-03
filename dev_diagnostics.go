package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/egoist/mygo"
)

type devDiagnosticRequest struct {
	ID        string         `json:"id"`
	PID       int            `json:"pid"`
	Action    string         `json:"action"`
	AppID     string         `json:"appId,omitempty"`
	Slug      string         `json:"slug,omitempty"`
	Arguments map[string]any `json:"arguments,omitempty"`
}

type devDiagnosticResponse struct {
	ID    string `json:"id"`
	PID   int    `json:"pid"`
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

type devDiagnostics struct {
	dir          string
	window       *mygo.Window
	settings     *Settings
	integrations *Integrations
}

func writeDevDiagnostic(path string, data []byte) error {
	if err := os.WriteFile(path+".tmp", data, 0600); err != nil {
		return err
	}
	return os.Rename(path+".tmp", path)
}

func startDevDiagnostics(ctx context.Context, win *mygo.Window, settings *Settings, integrations *Integrations) {
	if !mygo.IsDev() || os.Getenv("MYGO_SELFTEST") != "" {
		return
	}
	dir, err := filepath.Abs(filepath.Join(".mygo", "diagnostics"))
	if err != nil {
		log.Printf("dev diagnostics: %v", err)
		return
	}
	if err = os.MkdirAll(dir, 0700); err != nil {
		log.Printf("dev diagnostics: %v", err)
		return
	}
	ready, _ := json.Marshal(map[string]int{"pid": os.Getpid()})
	if err = writeDevDiagnostic(filepath.Join(dir, "ready.json"), ready); err != nil {
		log.Printf("dev diagnostics: %v", err)
		return
	}
	d := devDiagnostics{dir: dir, window: win, settings: settings, integrations: integrations}
	go d.serve(ctx)
}

func (d devDiagnostics) serve(ctx context.Context) {
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	lastID := ""
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
		raw, err := os.ReadFile(filepath.Join(d.dir, "request.json"))
		if err != nil {
			continue
		}
		var req devDiagnosticRequest
		if json.Unmarshal(raw, &req) != nil || req.ID == "" || req.ID == lastID || req.PID != os.Getpid() {
			continue
		}
		lastID = req.ID
		requestCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		value, err := d.run(requestCtx, req)
		cancel()
		response := devDiagnosticResponse{ID: req.ID, PID: os.Getpid(), Data: value}
		if err != nil {
			response.Error = err.Error()
			response.Data = nil
		}
		data, err := json.Marshal(response)
		if err == nil {
			err = writeDevDiagnostic(filepath.Join(d.dir, "response.json"), data)
		}
		if err != nil {
			log.Printf("dev diagnostics response: %v", err)
		}
	}
}

func (d devDiagnostics) run(ctx context.Context, req devDiagnosticRequest) (any, error) {
	switch req.Action {
	case "acceptance-start":
		return d.window.Page().EvalContext(ctx, devAcceptanceStart)
	case "acceptance-status":
		return d.window.Page().EvalContext(ctx, devAcceptanceStatus)
	case "open-apps":
		return mygo.EvalAs[bool](d.window.Page(), `const button=document.querySelector('.connect-apps-entry'); if(!button) return false; button.click(); window.dispatchEvent(new Event('focus')); return true;`)
	case "screenshot":
		png, err := d.window.CapturePage()
		if err != nil {
			return nil, err
		}
		path := filepath.Join(d.dir, "screenshot.png")
		if err = writeDevDiagnostic(path, png); err != nil {
			return nil, err
		}
		return map[string]string{"path": path}, nil
	case "status", "connect", "tools", "run":
		snapshot, err := d.settings.Get()
		if err != nil {
			return nil, err
		}
		profileID := snapshot.ActiveProfileID
		switch req.Action {
		case "status":
			value, err := d.integrations.secretGet()
			if err != nil && !errors.Is(err, mygo.ErrSecretNotFound) {
				return nil, integrationCredentialError("read", err)
			}
			stored := err == nil && len(value) > 0
			state, err := d.integrations.Status(ctx, profileID)
			if err != nil {
				return nil, err
			}
			return map[string]any{"profileId": profileID, "keychainStored": stored, "configured": state.Configured, "connections": state.Connections}, nil
		case "connect":
			return d.integrations.Connect(ctx, profileID, req.AppID)
		case "tools":
			return d.integrations.Tools(ctx, profileID, req.AppID)
		case "run":
			return d.integrations.Run(ctx, profileID, req.Slug, req.Arguments)
		}
	}
	return nil, errors.New("unknown development diagnostic action")
}
