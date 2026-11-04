package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"sync"

	"github.com/hifizz/morilo/computer"
)

type Computer struct {
	backend computer.Backend

	mu            sync.Mutex
	url           string
	token         string
	server        *http.Server
	extensionPath string
}

func NewComputer(backend computer.Backend) *Computer {
	return &Computer{backend: backend}
}

func computerBackend() computer.Backend {
	key := os.Getenv("INSTABOX_API_KEY")
	id := os.Getenv("INSTABOX_MACHINE_ID")
	if key == "" || id == "" {
		return nil
	}
	return computer.NewInstabox(os.Getenv("INSTABOX_API_URL"), key, id)
}

type ComputerStatus struct {
	Configured bool   `json:"configured"`
	ID         string `json:"id,omitempty"`
	Name       string `json:"name,omitempty"`
	State      string `json:"state"`
}

func (c *Computer) Status(ctx context.Context) (ComputerStatus, error) {
	if c.backend == nil {
		return ComputerStatus{State: "unconfigured"}, nil
	}
	info, err := c.backend.Info(ctx)
	if err != nil {
		return ComputerStatus{}, err
	}
	return ComputerStatus{Configured: true, ID: info.ID, Name: info.Name, State: info.State}, nil
}

type ComputerView struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	State    string `json:"state"`
	URL      string `json:"url"`
	ViewOnly bool   `json:"viewOnly"`
}

func (c *Computer) Connect(ctx context.Context, takeControl bool) (ComputerView, error) {
	if c.backend == nil {
		return ComputerView{}, errors.New("远程电脑未配置：设置 INSTABOX_API_KEY 和 INSTABOX_MACHINE_ID 后重启应用")
	}
	if err := c.backend.Wake(ctx); err != nil {
		return ComputerView{}, err
	}
	info, err := c.backend.Info(ctx)
	if err != nil {
		return ComputerView{}, err
	}
	viewOnly := !takeControl
	u, err := c.backend.DesktopURL(ctx, viewOnly)
	if err != nil {
		return ComputerView{}, err
	}
	return ComputerView{ID: info.ID, Name: info.Name, State: info.State, URL: u, ViewOnly: viewOnly}, nil
}
