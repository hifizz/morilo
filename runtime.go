package main

import (
	"errors"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/egoist/mygo"
)

// piCommand resolves the pi entry: the bundled Node+CLI in production,
// a development fallback to an installed pi otherwise.
func piCommand(args ...string) (*exec.Cmd, error) {
	resources, err := mygo.App.Path(mygo.PathResources)
	if err != nil {
		return nil, err
	}
	return resolvePiCommand(resources, mygo.IsDev() || os.Getenv("MORILO_LIVE_TEST") == "1", args...)
}

func resolvePiCommand(resources string, development bool, args ...string) (*exec.Cmd, error) {
	node := filepath.Join(resources, "runtime", "bin", "node")
	cli := filepath.Join(resources, "runtime", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js")
	if info, err := os.Stat(node); err == nil && info.Mode().IsRegular() && info.Mode()&0o111 != 0 {
		if info, err := os.Stat(cli); err == nil && info.Mode().IsRegular() {
			return exec.Command(node, append([]string{cli}, args...)...), nil
		}
	}
	if !development {
		return nil, errors.New("bundled model runtime is missing or invalid; reinstall Morilo")
	}
	if bin, err := exec.LookPath("pi"); err == nil {
		return exec.Command(bin, args...), nil
	}
	if home, err := os.UserHomeDir(); err == nil {
		candidate := filepath.Join(home, ".local", "bin", "pi")
		if info, err := os.Stat(candidate); err == nil && info.Mode().IsRegular() && info.Mode()&0o111 != 0 {
			return exec.Command(candidate, args...), nil
		}
	}
	return nil, errors.New("install Pi for development or run npm run prepare:runtime")
}
