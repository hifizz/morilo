package main

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sync"

	"github.com/egoist/mygo"
)

// Store persists the app's UI state — conversations and bots — as one JSON
// document in the app's user data directory.
type Store struct {
	mu   sync.Mutex
	path string
}

// NewStore binds the service: `mygo.Bind(NewStore())`.
func NewStore() (*Store, error) {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{path: filepath.Join(dir, "state.json")}, nil
}

// Load returns the saved state, or "" on the first run.
func (s *Store) Load() (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.path)
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// Save writes the state atomically.
func (s *Store) Save(state string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, []byte(state), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
