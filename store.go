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
	mu       sync.Mutex
	dir      string
	settings *Settings
}

// NewStore binds the service: `mygo.Bind(NewStore())`.
func NewStore(settings *Settings) (*Store, error) {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return nil, err
	}
	return newStoreAt(dir, settings)
}

func newStoreAt(dir string, settings *Settings) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{dir: dir, settings: settings}, nil
}

func (s *Store) pathFor(profileID string) (string, error) {
	profile, err := s.settings.profile(profileID)
	if err != nil {
		return "", err
	}
	if s.settings.isDefaultProfile(profile.ID) {
		return filepath.Join(s.dir, "state.json"), nil
	}
	return filepath.Join(s.dir, "profiles", profile.ID, "state.json"), nil
}

// Load returns the saved state, or "" on the first run.
func (s *Store) Load(profileID string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	path, err := s.pathFor(profileID)
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// Save writes the state atomically.
func (s *Store) Save(profileID, state string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	path, err := s.pathFor(profileID)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(state), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
