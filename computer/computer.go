package computer

import "context"

type Backend interface {
	Info(context.Context) (Info, error)
	Wake(context.Context) error
	Exec(context.Context, Command) (Result, error)
	ReadFile(context.Context, string) ([]byte, error)
	WriteFile(context.Context, string, []byte) error
	Screenshot(context.Context) ([]byte, error)
	Act(context.Context, Action) error
	DesktopURL(context.Context, bool) (string, error)
}

type Info struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	State   string  `json:"state"`
	Spec    Spec    `json:"spec"`
	Runtime Runtime `json:"runtime"`
}

type Spec struct {
	VCPUs             int `json:"vcpus"`
	MemMiB            int `json:"memMiB"`
	PersistentDiskGiB int `json:"persistentDiskGiB"`
}

type Runtime struct {
	Ready bool `json:"ready"`
}

type Command struct {
	Command        string `json:"command"`
	Cwd            string `json:"cwd,omitempty"`
	TimeoutSeconds int    `json:"timeoutSeconds,omitempty"`
}

type Result struct {
	Stdout    string `json:"stdout"`
	Stderr    string `json:"stderr"`
	ExitCode  int    `json:"exitCode"`
	TimedOut  bool   `json:"timedOut"`
	Truncated bool   `json:"truncated"`
}

type Action struct {
	Action    string `json:"action"`
	X         int    `json:"x,omitempty"`
	Y         int    `json:"y,omitempty"`
	Text      string `json:"text,omitempty"`
	Keys      string `json:"keys,omitempty"`
	Direction string `json:"direction,omitempty"`
	Amount    int    `json:"amount,omitempty"`
}
