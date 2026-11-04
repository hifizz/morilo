package computer

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
)

func fakeInstabox(t *testing.T, key string, mux *http.ServeMux) *Instabox {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-Key") != key {
			t.Errorf("%s %s: bad X-API-Key", r.Method, r.URL.Path)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		mux.ServeHTTP(w, r)
	}))
	t.Cleanup(srv.Close)
	return NewInstabox(srv.URL, key, "m1")
}

func writeBody(t *testing.T, w http.ResponseWriter, v any) {
	t.Helper()
	if err := json.NewEncoder(w).Encode(v); err != nil {
		t.Errorf("write response: %v", err)
	}
}

func TestInstaboxInfo(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/machines/m1", func(w http.ResponseWriter, r *http.Request) {
		writeBody(t, w, Info{ID: "m1", Name: "box", State: "running"})
	})
	m := fakeInstabox(t, "k1", mux)
	info, err := m.Info(context.Background())
	if err != nil {
		t.Fatalf("Info: %v", err)
	}
	if info != (Info{ID: "m1", Name: "box", State: "running"}) {
		t.Fatalf("info: %+v", info)
	}
}

func TestInstaboxWake(t *testing.T) {
	for _, tc := range []struct {
		name      string
		machine   string
		opStates  []string
		opMessage string
		wantErr   string
		wantStart bool
	}{
		{name: "already running", machine: "running"},
		{name: "starts then succeeds", machine: "stopped", opStates: []string{"pending", "succeeded"}, wantStart: true},
		{name: "start fails", machine: "stopped", opStates: []string{"failed"}, opMessage: "no capacity", wantErr: "no capacity", wantStart: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var started, idem atomic.Int32
			polls := 0
			mux := http.NewServeMux()
			mux.HandleFunc("GET /v1/machines/m1", func(w http.ResponseWriter, r *http.Request) {
				writeBody(t, w, Info{ID: "m1", Name: "box", State: tc.machine})
			})
			mux.HandleFunc("POST /v1/machines/m1/start", func(w http.ResponseWriter, r *http.Request) {
				started.Add(1)
				if r.Header.Get("Idempotency-Key") != "" {
					idem.Add(1)
				}
				op := operation{ID: "op1", State: tc.opStates[0]}
				op.Error.Message = tc.opMessage
				writeBody(t, w, op)
			})
			mux.HandleFunc("GET /v1/operations/op1", func(w http.ResponseWriter, r *http.Request) {
				state := tc.opStates[len(tc.opStates)-1]
				if polls < len(tc.opStates) {
					state = tc.opStates[polls]
				}
				polls++
				op := operation{ID: "op1", State: state}
				op.Error.Message = tc.opMessage
				writeBody(t, w, op)
			})
			m := fakeInstabox(t, "k1", mux)
			err := m.Wake(context.Background())
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("Wake error = %v, want %q", err, tc.wantErr)
				}
			} else if err != nil {
				t.Fatalf("Wake: %v", err)
			}
			if got := started.Load() > 0; got != tc.wantStart {
				t.Fatalf("start called = %v, want %v", got, tc.wantStart)
			}
			if tc.wantStart && idem.Load() != started.Load() {
				t.Fatal("start without Idempotency-Key")
			}
		})
	}
}

func TestInstaboxExec(t *testing.T) {
	var got execRequest
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/machines/m1/exec", func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Errorf("decode exec: %v", err)
		}
		writeBody(t, w, Result{Stdout: "out", Stderr: "err", ExitCode: 7})
	})
	m := fakeInstabox(t, "k1", mux)
	res, err := m.Exec(context.Background(), Command{Command: "exit 7"})
	if err != nil {
		t.Fatalf("Exec: %v", err)
	}
	if res.ExitCode != 7 || res.Stdout != "out" || res.Stderr != "err" {
		t.Fatalf("result: %+v", res)
	}
	if got.Cmd != "exit 7" || got.Cwd != "/data/home" || got.TimeoutSeconds != 60 {
		t.Fatalf("exec request: %+v", got)
	}
}

func TestInstaboxExecValidation(t *testing.T) {
	m := NewInstabox("http://unused", "k", "m1")
	if _, err := m.Exec(context.Background(), Command{}); err == nil {
		t.Fatal("empty command accepted")
	}
	if _, err := m.Exec(context.Background(), Command{Command: "x", TimeoutSeconds: 601}); err == nil {
		t.Fatal("timeout 601 accepted")
	}
}

func TestInstaboxActArgvNotShell(t *testing.T) {
	var got execRequest
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/machines/m1/desktop", func(w http.ResponseWriter, r *http.Request) {
		writeBody(t, w, map[string]bool{"running": true})
	})
	mux.HandleFunc("POST /v1/machines/m1/exec", func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Errorf("decode exec: %v", err)
		}
		writeBody(t, w, Result{})
	})
	m := fakeInstabox(t, "k1", mux)

	text := `it's "fine" $(rm -rf /) 中文 \n;|&` + "`tick`"
	if err := m.Act(context.Background(), Action{Action: "type", Text: text}); err != nil {
		t.Fatalf("Act type: %v", err)
	}
	want := []string{"xdotool", "type", "--clearmodifiers", "--delay", "0", "--file", "-"}
	if !slices.Equal(got.Argv, want) {
		t.Fatalf("argv = %v, want %v", got.Argv, want)
	}
	if got.Stdin != text || got.Envs["DISPLAY"] != ":1" || got.Cmd != "" {
		t.Fatalf("exec request: %+v", got)
	}

	if err := m.Act(context.Background(), Action{Action: "click", X: 10, Y: 20}); err != nil {
		t.Fatalf("Act click: %v", err)
	}
	want = []string{"xdotool", "mousemove", "10", "20", "click", "1"}
	if !slices.Equal(got.Argv, want) {
		t.Fatalf("argv = %v, want %v", got.Argv, want)
	}
}

func TestInstaboxActErrors(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/machines/m1/desktop", func(w http.ResponseWriter, r *http.Request) {
		writeBody(t, w, map[string]bool{"running": true})
	})
	mux.HandleFunc("POST /v1/machines/m1/exec", func(w http.ResponseWriter, r *http.Request) {
		writeBody(t, w, Result{ExitCode: 1, Stderr: "xdotool: boom"})
	})
	m := fakeInstabox(t, "k1", mux)

	if err := m.Act(context.Background(), Action{Action: "teleport"}); err == nil {
		t.Fatal("unknown action accepted")
	}
	if err := m.Act(context.Background(), Action{Action: "scroll", Direction: "diagonal"}); err == nil {
		t.Fatal("unknown direction accepted")
	}
	if err := m.Act(context.Background(), Action{Action: "click", X: -1, Y: 0}); err == nil {
		t.Fatal("negative coordinate accepted")
	}
	if err := m.Act(context.Background(), Action{Action: "press", Keys: "Return"}); err == nil {
		t.Fatal("nonzero xdotool exit reported as success")
	}
}

func TestInstaboxFiles(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', 0x00, 0xff}
	var gotQuery string
	var gotBody []byte
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/machines/m1/files/content", func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		w.Write(png)
	})
	mux.HandleFunc("PUT /v1/machines/m1/files", func(w http.ResponseWriter, r *http.Request) {
		gotQuery = r.URL.RawQuery
		gotBody, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
	})
	m := fakeInstabox(t, "k1", mux)

	data, err := m.ReadFile(context.Background(), "docs/a b.txt")
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(data) != string(png) {
		t.Fatalf("read %d bytes, want png", len(data))
	}
	if gotQuery != "path=%2Fdata%2Fhome%2Fdocs%2Fa+b.txt" && gotQuery != "path=%2Fdata%2Fhome%2Fdocs%2Fa%20b.txt" {
		t.Fatalf("read query: %s", gotQuery)
	}

	if err := m.WriteFile(context.Background(), "/abs/f.bin", png); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if string(gotBody) != string(png) {
		t.Fatal("upload body was re-encoded")
	}
	if q, _ := http.NewRequest("GET", "/?"+gotQuery, nil); q.URL.Query().Get("path") != "/abs/f.bin" || q.URL.Query().Get("parents") != "true" {
		t.Fatalf("write query: %s", gotQuery)
	}
	if err := m.WriteFile(context.Background(), "", png); err == nil {
		t.Fatal("empty path accepted")
	}
}

func TestInstaboxScreenshotAndDesktopURL(t *testing.T) {
	png := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}
	var scrotArgv []string
	var streamBody map[string]any
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/machines/m1/desktop", func(w http.ResponseWriter, r *http.Request) {
		writeBody(t, w, map[string]bool{"running": true})
	})
	mux.HandleFunc("POST /v1/machines/m1/exec", func(w http.ResponseWriter, r *http.Request) {
		var req execRequest
		json.NewDecoder(r.Body).Decode(&req)
		scrotArgv = req.Argv
		writeBody(t, w, Result{})
	})
	mux.HandleFunc("GET /v1/machines/m1/files/content", func(w http.ResponseWriter, r *http.Request) {
		w.Write(png)
	})
	mux.HandleFunc("POST /v1/machines/m1/desktop/stream", func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(&streamBody)
		writeBody(t, w, map[string]any{"url": "https://vnc.example/s1", "expiresAt": "later"})
	})
	m := fakeInstabox(t, "k1", mux)

	shot, err := m.Screenshot(context.Background())
	if err != nil {
		t.Fatalf("Screenshot: %v", err)
	}
	if string(shot) != string(png) {
		t.Fatal("screenshot bytes mismatch")
	}
	want := []string{"scrot", "-o", "/tmp/morilo-screen.png"}
	if !slices.Equal(scrotArgv, want) {
		t.Fatalf("scrot argv = %v, want %v", scrotArgv, want)
	}

	u, err := m.DesktopURL(context.Background(), true)
	if err != nil {
		t.Fatalf("DesktopURL: %v", err)
	}
	if u != "https://vnc.example/s1" {
		t.Fatalf("url = %q", u)
	}
	if streamBody["viewOnly"] != true || streamBody["ttlSeconds"] != float64(3600) {
		t.Fatalf("stream request: %v", streamBody)
	}
	if _, err := m.DesktopURL(context.Background(), false); err != nil {
		t.Fatalf("DesktopURL interactive: %v", err)
	}
	if streamBody["viewOnly"] != false || streamBody["ttlSeconds"] != float64(3600) {
		t.Fatalf("stream request: %v", streamBody)
	}
}
