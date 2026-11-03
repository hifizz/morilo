package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func settingsAt(t *testing.T) (*Settings, string) {
	t.Helper()
	dir := t.TempDir()
	s, err := newSettingsAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	return s, dir
}

func TestSettingsDefaults(t *testing.T) {
	s, _ := settingsAt(t)
	snap, err := s.Get()
	if err != nil {
		t.Fatal(err)
	}
	p := snap.Preferences
	if p.Theme != "system" || p.Accent != "bot" || p.Language != "system" || !p.Spellcheck || p.MicrophoneID != "default" || p.Timezone != "auto" {
		t.Fatalf("preferences: %+v", p)
	}
	if len(snap.Profiles) != 1 || snap.Profiles[0].ID == "" || snap.Profiles[0].Name != "本地用户" || snap.Profiles[0].Email != "" {
		t.Fatalf("profiles: %+v", snap.Profiles)
	}
	if snap.ActiveProfileID != snap.Profiles[0].ID {
		t.Fatalf("active: %v", snap.ActiveProfileID)
	}
}

func TestSettingsPreferences(t *testing.T) {
	s, dir := settingsAt(t)
	p := Preferences{Theme: "dark", Accent: "blue", Language: "en", Spellcheck: false, MicrophoneID: "disabled", Timezone: "Asia/Shanghai"}
	snap, err := s.UpdatePreferences(p)
	if err != nil {
		t.Fatal(err)
	}
	if snap.Preferences != p {
		t.Fatalf("preferences: %+v", snap.Preferences)
	}
	reloaded, err := newSettingsAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	if snap2, _ := reloaded.Get(); snap2.Preferences != p {
		t.Fatalf("reloaded: %+v", snap2.Preferences)
	}
	for _, bad := range []Preferences{
		{Theme: "neon", Accent: "blue", Language: "en", MicrophoneID: "default", Timezone: "auto"},
		{Theme: "dark", Accent: "blue", Language: "fr", MicrophoneID: "default", Timezone: "auto"},
		{Theme: "dark", Accent: "blue", Language: "en", MicrophoneID: "default", Timezone: "Mars/Olympus"},
		{Theme: "dark", Accent: "blue", Language: "en", MicrophoneID: strings.Repeat("x", 600), Timezone: "auto"},
	} {
		if _, err := s.UpdatePreferences(bad); err == nil {
			t.Fatalf("accepted %+v", bad)
		}
	}
	if snap3, _ := s.Get(); snap3.Preferences != p {
		t.Fatalf("mutated on invalid update: %+v", snap3.Preferences)
	}
}

func TestProfileLifecycle(t *testing.T) {
	s, dir := settingsAt(t)
	snap, err := s.CreateProfile("  第二用户  ", "a@b.c")
	if err != nil {
		t.Fatal(err)
	}
	if len(snap.Profiles) != 2 || snap.Profiles[1].Name != "第二用户" || snap.Profiles[1].Email != "a@b.c" {
		t.Fatalf("profiles: %+v", snap.Profiles)
	}
	secondID := snap.Profiles[1].ID
	if secondID == snap.Profiles[0].ID {
		t.Fatal("ids not unique")
	}
	if snap.ActiveProfileID != secondID {
		t.Fatal("new profile not selected")
	}
	if _, err := s.ImportMemory(secondID, "notes.txt", "remember me"); err != nil {
		t.Fatal(err)
	}
	snap, err = s.UpdateProfile(secondID, "renamed", "")
	if err != nil {
		t.Fatal(err)
	}
	if snap.Profiles[1].Name != "renamed" || snap.Profiles[1].ID != secondID || !strings.Contains(snap.Profiles[1].Memory, "remember me") {
		t.Fatalf("profile: %+v", snap.Profiles[1])
	}
	if _, err := s.SelectProfile(""); err != nil {
		t.Fatal(err)
	}
	reloaded, err := newSettingsAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	if snap2, _ := reloaded.Get(); snap2.ActiveProfileID != "" {
		t.Fatalf("signout not persisted: %v", snap2.ActiveProfileID)
	}
	if _, err := s.SelectProfile("ghost"); err == nil {
		t.Fatal("unknown profile selected")
	}
	if _, err := s.CreateProfile("   ", ""); err == nil {
		t.Fatal("empty name accepted")
	}
	if _, err := s.CreateProfile(strings.Repeat("长", 81), ""); err == nil {
		t.Fatal("long name accepted")
	}
}

func TestProfileRouting(t *testing.T) {
	s, _ := settingsAt(t)
	snap, _ := s.Get()
	defID := snap.Profiles[0].ID
	snap, _ = s.CreateProfile("other", "")
	secondID := snap.Profiles[1].ID
	c := NewChat(nil, s)
	if got := c.logicalID(defID, "c1"); got != "c1" {
		t.Fatalf("default logical id %q", got)
	}
	if got := c.logicalID(secondID, "c1"); got != secondID+":c1" {
		t.Fatalf("second logical id %q", got)
	}
}

func TestMemoryImport(t *testing.T) {
	s, dir := settingsAt(t)
	snap, _ := s.Get()
	id := snap.Profiles[0].ID
	if _, err := s.ImportMemory(id, "notes.md", "prefers dark mode"); err != nil {
		t.Fatal(err)
	}
	snap, _ = s.ImportMemory(id, "facts.json", `{"lang":"zh"}`)
	if snap.Profiles[0].Memory == "" || !strings.Contains(snap.Profiles[0].Memory, "## facts.json") || !strings.Contains(snap.Profiles[0].Memory, `"lang": "zh"`) {
		t.Fatalf("memory: %q", snap.Profiles[0].Memory)
	}
	if _, err := s.ImportMemory(id, "bad.json", "{invalid"); err == nil {
		t.Fatal("invalid json accepted")
	}
	if _, err := s.ImportMemory(id, "empty.txt", "   "); err == nil {
		t.Fatal("empty accepted")
	}
	if _, err := s.ImportMemory(id, "big.txt", strings.Repeat("x", 70<<10)); err == nil {
		t.Fatal("oversize accepted")
	}
	if _, err := s.ImportMemory(id, "evil.exe", "data"); err == nil {
		t.Fatal("unsupported extension accepted")
	}
	reloaded, err := newSettingsAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	snap2, _ := reloaded.Get()
	if !strings.Contains(snap2.Profiles[0].Memory, "prefers dark mode") {
		t.Fatal("memory not persisted")
	}
	snap3, _ := s.CreateProfile("other", "")
	if snap3.Profiles[1].Memory != "" {
		t.Fatal("memory leaked across profiles")
	}
}

func TestSettingsInitialProfilePersists(t *testing.T) {
	s, dir := settingsAt(t)
	first, err := s.Get()
	if err != nil {
		t.Fatal(err)
	}
	reload, err := newSettingsAt(dir)
	if err != nil {
		t.Fatal(err)
	}
	second, err := reload.Get()
	if err != nil {
		t.Fatal(err)
	}
	if second.Profiles[0].ID != first.Profiles[0].ID {
		t.Fatal("profile id regenerated on reload")
	}
	if second.ActiveProfileID != first.ActiveProfileID {
		t.Fatal("active profile changed on reload")
	}
	info, err := os.Stat(filepath.Join(dir, "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("settings.json mode %v", info.Mode().Perm())
	}
}

func TestSettingsFailedSaveKeepsSnapshot(t *testing.T) {
	newBlocked := func(t *testing.T) *Settings {
		t.Helper()
		s, dir := settingsAt(t)
		blocker := filepath.Join(dir, "blocker")
		if err := os.WriteFile(blocker, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
		s.path = filepath.Join(blocker, "settings.json")
		return s
	}
	mutations := []func(*Settings, SettingsSnapshot) error{
		func(s *Settings, snap SettingsSnapshot) error {
			_, err := s.UpdatePreferences(Preferences{Theme: "dark", Accent: "blue", Language: "en", Spellcheck: false, MicrophoneID: "default", Timezone: "UTC"})
			return err
		},
		func(s *Settings, snap SettingsSnapshot) error { _, err := s.CreateProfile("n2", "e"); return err },
		func(s *Settings, snap SettingsSnapshot) error {
			_, err := s.UpdateProfile(snap.Profiles[0].ID, "n", "e")
			return err
		},
		func(s *Settings, snap SettingsSnapshot) error { _, err := s.SelectProfile(""); return err },
		func(s *Settings, snap SettingsSnapshot) error {
			_, err := s.ImportMemory(snap.Profiles[0].ID, "a.txt", "b")
			return err
		},
	}
	for i, mutate := range mutations {
		s := newBlocked(t)
		before, err := s.Get()
		if err != nil {
			t.Fatal(err)
		}
		if err := mutate(s, before); err == nil {
			t.Fatalf("mutation %d succeeded against blocked path", i)
		}
		after, err := s.Get()
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(before, after) {
			t.Fatalf("mutation %d leaked into snapshot: %+v != %+v", i, before, after)
		}
	}
	s, _ := settingsAt(t)
	p := Preferences{Theme: "system", Accent: "bot", Language: "system", Spellcheck: true, MicrophoneID: "default", Timezone: "auto"}
	for _, bad := range []Preferences{
		{Theme: "system", Accent: "bot", Language: "system", Spellcheck: true, MicrophoneID: "", Timezone: "auto"},
		{Theme: "system", Accent: "bot", Language: "system", Spellcheck: true, MicrophoneID: "default", Timezone: ""},
	} {
		if _, err := s.UpdatePreferences(bad); err == nil {
			t.Fatalf("empty field accepted: %+v", bad)
		}
	}
	if snap, _ := s.Get(); snap.Preferences != p {
		t.Fatal("snapshot changed by invalid update")
	}
}

func TestContextMessage(t *testing.T) {
	s, _ := settingsAt(t)
	snap, _ := s.Get()
	defID := snap.Profiles[0].ID
	s.UpdatePreferences(Preferences{Theme: "system", Accent: "bot", Language: "system", Spellcheck: true, MicrophoneID: "default", Timezone: "Asia/Shanghai"})
	s.ImportMemory(defID, "notes.txt", "likes cats")
	snap, _ = s.CreateProfile("other", "")
	otherID := snap.Profiles[1].ID
	s.ImportMemory(otherID, "o.txt", "other-secret")
	now := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	got, err := s.contextMessage(defID, "hello world", now)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, "11:04:05+08:00") || !strings.Contains(got, "Asia/Shanghai") || !strings.Contains(got, "likes cats") || !strings.HasSuffix(got, "hello world") {
		t.Fatalf("context: %q", got)
	}
	if strings.Contains(got, "other-secret") {
		t.Fatal("other profile memory leaked")
	}
	if _, err := s.contextMessage("ghost", "x", now); err == nil {
		t.Fatal("unknown profile accepted")
	}
}
