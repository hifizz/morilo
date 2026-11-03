package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"

	"github.com/egoist/mygo"
)

// ChatEvent is one piece of a chat run, streamed to the page through the
// channel of Chat.Send.
type ChatEvent struct {
	Type   string `json:"type"`             // "text" | "thinking" | "tool_start" | "tool_end" | "done" | "error"
	Seg    int    `json:"seg,omitempty"`    // which assistant message of the run a "text" piece belongs to
	Delta  string `json:"delta,omitempty"`  // text of a "text"/"thinking" piece
	Tool   string `json:"tool,omitempty"`   // tool name of a "tool_*" piece
	Detail string `json:"detail,omitempty"` // argument summary or error text
	Failed bool   `json:"failed,omitempty"` // a "tool_end" that failed
}

// Chat is the bound service the frontend talks to. Each conversation owns
// one pi subprocess in RPC mode, keeping the agent's context in memory.
type Chat struct {
	mu       sync.Mutex
	sessions map[string]*piSession
	computer *Computer
}

// NewChat binds the service: `mygo.Bind(NewChat())`.
func NewChat(computer *Computer) *Chat {
	return &Chat{sessions: map[string]*piSession{}, computer: computer}
}

// Send runs one prompt of a conversation, streaming its pieces to events.
// Concurrent sends of one conversation run one after another.
func (c *Chat) Send(ctx context.Context, conversationID, text string, events *mygo.Channel[ChatEvent]) error {
	sess, err := c.session(conversationID)
	if err != nil {
		return err
	}
	return sess.prompt(ctx, text, func(e ChatEvent) bool {
		return events.Send(e) == nil
	})
}

// Stop aborts the conversation's running agent, if any.
func (c *Chat) Stop(conversationID string) error {
	c.mu.Lock()
	sess := c.sessions[conversationID]
	c.mu.Unlock()
	if sess == nil {
		return nil
	}
	_, err := sess.call(nil, map[string]any{"type": "abort"})
	return err
}

// Reset drops the conversation's agent; the next Send starts a fresh one.
func (c *Chat) Reset(conversationID string) error {
	c.mu.Lock()
	sess := c.sessions[conversationID]
	delete(c.sessions, conversationID)
	c.mu.Unlock()
	if sess != nil {
		sess.kill()
	}
	return nil
}

func (c *Chat) session(conversationID string) (*piSession, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if sess := c.sessions[conversationID]; sess != nil && sess.alive() {
		return sess, nil
	}
	sess, err := startPi(conversationID, c.computer)
	if err != nil {
		return nil, err
	}
	c.sessions[conversationID] = sess
	return sess, nil
}

// piSession is one `pi --mode rpc` subprocess. It reads JSONL records from
// stdout: command responses route to their waiting caller by id, session
// events go to the events channel for the active prompt to pump.
type piSession struct {
	cmd   *exec.Cmd
	stdin *bufio.Writer

	writeMu sync.Mutex // one writer on stdin
	runMu   sync.Mutex // one active run
	ids     atomic.Int64

	pendMu  sync.Mutex
	pending map[string]chan rpcResponse

	events chan map[string]any
	dead   chan error // reader finished: the process ended
}

type rpcResponse struct {
	Success bool            `json:"success"`
	Error   string          `json:"error"`
	Data    json.RawMessage `json:"data"`
}

// chatStylePrompt teaches the bot to answer as several short chat messages,
// separated by ¶, which the app splits into bubbles.
const chatStylePrompt = `你在一个即时通讯界面里和用户对话。默认把回复拆成多条简短的消息，每条一两句话，就像一个人连续发好几条消息那样；相邻两条消息之间用单独一个 ¶ 字符分隔，¶ 前后不用换行或空行，也不要把它放进代码块或引用里。只有当内容必须是整体时——比如一段代码、一份文档——才发单独一条。`

const remoteComputerPrompt = `你的工具操作对象是所有 Bot 共用的远程 Linux 电脑，不是运行聊天程序的本机 Mac。使用 computer_exec、computer_read、computer_write 和 computer_desktop 完成操作。远程默认工作目录是 /data/home；每次命令的 shell 独立，需要切换目录时指定 cwd 或在同一条命令里 cd。桌面操作前先截图，按截图坐标操作。没有工具结果时不要声称操作已经完成。`

func startPi(conversationID string, computer *Computer) (*piSession, error) {
	bin, err := exec.LookPath("pi")
	if err != nil {
		home, _ := os.UserHomeDir()
		bin = filepath.Join(home, ".local", "bin", "pi")
	}
	workdir, err := piWorkdir()
	if err != nil {
		return nil, err
	}
	sessions, err := piSessionDir()
	if err != nil {
		return nil, err
	}
	agentDir, err := piAgentDir()
	if err != nil {
		return nil, err
	}
	// --session-id resumes this conversation's earlier context on restart.
	args := []string{"--mode", "rpc",
		"--session-dir", sessions,
		"--session-id", sessionID(conversationID),
		"--append-system-prompt", chatStylePrompt,
		"--no-extensions", "--no-mcp"}
	var endpoint computerEndpoint
	if computer != nil && computer.backend != nil {
		endpoint, err = computer.bridge()
		if err != nil {
			return nil, err
		}
		args = append(args,
			"--no-builtin-tools",
			"--extension", endpoint.path,
			"--append-system-prompt", remoteComputerPrompt)
	}
	cmd := exec.Command(bin, args...)
	cmd.Dir = workdir
	// Grokbot keeps its own pi agent directory: providers, credentials and
	// settings stay apart from the user's global ~/.pi/agent.
	cmd.Env = piEnv(agentDir, endpoint)
	cmd.Stderr = log.Writer()
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start pi: %w", err)
	}
	s := &piSession{
		cmd:     cmd,
		stdin:   bufio.NewWriter(stdin),
		pending: map[string]chan rpcResponse{},
		events:  make(chan map[string]any, 512),
		dead:    make(chan error, 1),
	}
	go s.read(stdout)
	return s, nil
}

func piEnv(agentDir string, endpoint computerEndpoint) []string {
	env := make([]string, 0, len(os.Environ())+4)
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "INSTABOX_API_KEY=") {
			continue
		}
		env = append(env, e)
	}
	env = append(env, "PI_CODING_AGENT_DIR="+agentDir)
	if endpoint.url != "" {
		env = append(env,
			"GROKBOT_COMPUTER_URL="+endpoint.url,
			"GROKBOT_COMPUTER_TOKEN="+endpoint.token)
	}
	return env
}

// piWorkdir is where the agent's tools run: ~/grokbot-workspace.
func piWorkdir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, "grokbot-workspace")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// piSessionDir is where pi writes session files, under the app's user data.
// Without an app context, such as in tests, it falls back to the temp dir.
func piSessionDir() (string, error) {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		dir = os.TempDir()
	}
	dir = filepath.Join(dir, "pi-sessions")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

// piAgentDir is the app's private pi agent directory, under user data. It
// holds the relay provider definition and resolves the API key from the
// macOS Keychain, so nothing secret is written to disk. Missing files get
// created with these defaults.
func piAgentDir() (string, error) {
	base, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		base = os.TempDir()
	}
	dir := filepath.Join(base, "pi-agent")
	files := map[string]string{
		"models.json": `{
  "providers": {
    "relay": {
      "name": "Zilin Relay",
      "baseUrl": "https://relay.zilin.im/v1",
      "api": "openai-completions",
      "models": [
        {
          "id": "swe-2",
          "name": "swe-2",
          "reasoning": false,
          "input": ["text", "image"],
          "contextWindow": 128000,
          "maxTokens": 16384
        }
      ]
    }
  }
}
`,
		"settings.json": `{
  "defaultProvider": "relay",
  "defaultModel": "swe-2"
}
`,
		"auth.json": `{
  "relay": {
    "type": "api_key",
    "key": "!/usr/bin/security find-generic-password -s grokbot-relay -w"
  }
}
`,
	}
	for name, content := range files {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); err == nil {
			continue
		}
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return "", err
		}
		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			return "", err
		}
	}
	return dir, nil
}

// sessionID makes a conversation id safe as a pi session id.
func sessionID(conversationID string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r == '-', r == '_':
			return r
		}
		return '-'
	}, conversationID)
}

func (s *piSession) read(stdout io.Reader) {
	reader := bufio.NewReaderSize(stdout, 1<<20)
	err := error(nil)
	for {
		line, readErr := reader.ReadBytes('\n')
		if len(line) > 0 {
			s.route(line)
		}
		if readErr != nil {
			err = readErr
			break
		}
	}
	if errors.Is(err, io.EOF) {
		err = errors.New("pi exited")
	}
	s.pendMu.Lock()
	for id, ch := range s.pending {
		ch <- rpcResponse{Error: err.Error()}
		delete(s.pending, id)
	}
	s.pendMu.Unlock()
	s.dead <- err
}

// route sends a record to its caller (responses carry an id) or to the
// session event stream.
func (s *piSession) route(line []byte) {
	var head struct {
		Type string `json:"type"`
		ID   string `json:"id"`
	}
	if json.Unmarshal(line, &head) != nil {
		return
	}
	if head.Type == "response" && head.ID != "" {
		var resp rpcResponse
		json.Unmarshal(line, &resp)
		s.pendMu.Lock()
		ch := s.pending[head.ID]
		delete(s.pending, head.ID)
		s.pendMu.Unlock()
		if ch != nil {
			ch <- resp
		}
		return
	}
	var record map[string]any
	if json.Unmarshal(line, &record) != nil {
		return
	}
	select {
	case s.events <- record:
	default: // no run is consuming: drop
	}
}

// call writes one command and waits for its response.
func (s *piSession) call(ctx context.Context, command map[string]any) (*rpcResponse, error) {
	id := fmt.Sprintf("req-%d", s.ids.Add(1))
	command["id"] = id
	ch := make(chan rpcResponse, 1)
	s.pendMu.Lock()
	s.pending[id] = ch
	s.pendMu.Unlock()

	if err := s.write(command); err != nil {
		s.pendMu.Lock()
		delete(s.pending, id)
		s.pendMu.Unlock()
		return nil, err
	}

	var resp rpcResponse
	if ctx != nil {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case resp = <-ch:
		}
	} else {
		resp = <-ch
	}
	if !resp.Success {
		if resp.Error == "" {
			resp.Error = "command failed"
		}
		return nil, errors.New(resp.Error)
	}
	return &resp, nil
}

func (s *piSession) write(command map[string]any) error {
	s.writeMu.Lock()
	defer s.writeMu.Unlock()
	data, err := json.Marshal(command)
	if err != nil {
		return err
	}
	if _, err := s.stdin.Write(append(data, '\n')); err != nil {
		return err
	}
	return s.stdin.Flush()
}

func (s *piSession) alive() bool {
	select {
	case <-s.dead:
		return false
	default:
		return true
	}
}

func (s *piSession) kill() {
	s.cmd.Process.Kill()
	s.cmd.Wait()
}

// prompt sends one message and pumps session events to send until the run
// settles.
func (s *piSession) prompt(ctx context.Context, text string, send func(ChatEvent) bool) error {
	s.runMu.Lock()
	defer s.runMu.Unlock()

	resp, err := s.call(ctx, map[string]any{"type": "prompt", "message": text})
	if err != nil {
		return err
	}
	// "handled" means nothing will run: no agent_settled is coming.
	var data struct {
		Disposition string `json:"disposition"`
	}
	if resp.Data != nil && json.Unmarshal(resp.Data, &data) == nil && data.Disposition == "handled" {
		return nil
	}

	ctxDone := ctx.Done()
	seg := -1 // counts assistant messages of this run: text → tool → text
	for {
		select {
		case <-ctxDone:
			// Tell pi to stop, then keep draining until it settles.
			ctxDone = nil
			s.write(map[string]any{"type": "abort"})
		case err := <-s.dead:
			send(ChatEvent{Type: "error", Detail: err.Error()})
			return err
		case record := <-s.events:
			if done := s.forward(record, send, &seg); done {
				send(ChatEvent{Type: "done"})
				return nil
			}
		}
	}
}

// forward maps one pi session record to ChatEvents. It reports whether the
// run settled.
func (s *piSession) forward(record map[string]any, send func(ChatEvent) bool, seg *int) bool {
	switch record["type"] {
	case "message_start":
		if msg, _ := record["message"].(map[string]any); msg["role"] == "assistant" {
			*seg++
		}
	case "message_update":
		ev, _ := record["assistantMessageEvent"].(map[string]any)
		switch ev["type"] {
		case "text_delta":
			send(ChatEvent{Type: "text", Seg: *seg, Delta: stringOf(ev, "delta")})
		case "thinking_delta":
			send(ChatEvent{Type: "thinking", Delta: stringOf(ev, "delta")})
		case "error":
			detail, _ := ev["error"].(string)
			if detail == "" {
				detail = stringOf(ev, "reason")
			}
			send(ChatEvent{Type: "error", Detail: detail})
		}
	case "tool_execution_start":
		send(ChatEvent{Type: "tool_start", Tool: stringOf(record, "toolName"), Detail: summarizeArgs(record["args"])})
	case "tool_execution_end":
		send(ChatEvent{Type: "tool_end", Tool: stringOf(record, "toolName"), Failed: record["isError"] == true})
	case "agent_settled":
		return true
	}
	return false
}

func stringOf(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return v
}

// summarizeArgs renders tool arguments as one short line for the event row.
func summarizeArgs(args any) string {
	m, ok := args.(map[string]any)
	if !ok {
		return ""
	}
	for _, key := range []string{"command", "path", "file_path", "pattern", "query"} {
		if v, ok := m[key].(string); ok && v != "" {
			return truncate(strings.ReplaceAll(v, "\n", " "), 120)
		}
	}
	data, err := json.Marshal(m)
	if err != nil {
		return ""
	}
	return truncate(string(data), 120)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
