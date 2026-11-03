package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestStoreProfiles(t *testing.T) {
	dir := t.TempDir()
	legacy := `{"conversations":[{"id":"c1"}]}`
	if err := os.WriteFile(filepath.Join(dir, "state.json"), []byte(legacy), 0o600); err != nil {
		t.Fatal(err)
	}
	s, err := newSettingsAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	store, err := newStoreAt(dir, s)
	if err != nil {
		t.Fatal(err)
	}
	snap, _ := s.Get()
	defID := snap.Profiles[0].ID
	got, err := store.Load(defID)
	if err != nil {
		t.Fatal(err)
	}
	if got != legacy {
		t.Fatalf("legacy state: %q", got)
	}
	snap, _ = s.CreateProfile("second", "")
	secondID := snap.Profiles[1].ID
	if err := store.Save(secondID, `{"second":true}`); err != nil {
		t.Fatal(err)
	}
	if got, _ := store.Load(secondID); got != `{"second":true}` {
		t.Fatalf("second state: %q", got)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil || string(raw) != legacy {
		t.Fatalf("legacy overwritten: %v %q", err, raw)
	}
	if _, err := os.Stat(filepath.Join(dir, "profiles", secondID, "state.json")); err != nil {
		t.Fatalf("profile state missing: %v", err)
	}
	if _, err := store.Load("ghost"); err == nil {
		t.Fatal("unknown profile loaded")
	}
	if err := store.Save("ghost", "x"); err == nil {
		t.Fatal("unknown profile saved")
	}
}
