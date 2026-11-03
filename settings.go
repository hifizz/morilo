package main

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/egoist/mygo"
)

type Preferences struct {
	Theme        string `json:"theme"`
	Accent       string `json:"accent"`
	Language     string `json:"language"`
	Spellcheck   bool   `json:"spellcheck"`
	MicrophoneID string `json:"microphoneId"`
	Timezone     string `json:"timezone"`
}

type LocalProfile struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Memory string `json:"memory"`
}

type SettingsSnapshot struct {
	Preferences     Preferences    `json:"preferences"`
	Profiles        []LocalProfile `json:"profiles"`
	ActiveProfileID string         `json:"activeProfileId"`
}

type Settings struct {
	mu         sync.Mutex
	path       string
	snapshot   SettingsSnapshot
	applyTheme func(string)
}

func profileID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

func defaultSnapshot() SettingsSnapshot {
	profile := LocalProfile{ID: profileID(), Name: "本地用户"}
	return SettingsSnapshot{
		Preferences: Preferences{
			Theme:        "system",
			Accent:       "bot",
			Language:     "system",
			Spellcheck:   true,
			MicrophoneID: "default",
			Timezone:     "auto",
		},
		Profiles:        []LocalProfile{profile},
		ActiveProfileID: profile.ID,
	}
}

func NewSettings() (*Settings, error) {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return nil, err
	}
	return newSettingsAt(dir)
}

func newSettingsAt(dir string) (*Settings, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	s := &Settings{path: filepath.Join(dir, "settings.json"), snapshot: defaultSnapshot()}
	data, err := os.ReadFile(s.path)
	if err == nil {
		var snap SettingsSnapshot
		if err := json.Unmarshal(data, &snap); err != nil {
			return nil, fmt.Errorf("settings file unreadable: %w", err)
		}
		if len(snap.Profiles) == 0 {
			return nil, errors.New("settings file has no profiles")
		}
		if err := validatePreferences(snap.Preferences); err != nil {
			return nil, fmt.Errorf("settings file unreadable: %w", err)
		}
		if snap.ActiveProfileID != "" && !slices.ContainsFunc(snap.Profiles, func(p LocalProfile) bool { return p.ID == snap.ActiveProfileID }) {
			return nil, errors.New("settings file selects an unknown profile")
		}
		s.snapshot = snap
		return s, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	if err := s.save(s.snapshot); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Settings) Get() (SettingsSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	snap := s.snapshot
	snap.Profiles = slices.Clone(snap.Profiles)
	return snap, nil
}

func (s *Settings) save(snapshot SettingsSnapshot) error {
	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *Settings) update(change func(*SettingsSnapshot) error) (SettingsSnapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	next := s.snapshot
	next.Profiles = slices.Clone(next.Profiles)
	if err := change(&next); err != nil {
		return SettingsSnapshot{}, err
	}
	if err := s.save(next); err != nil {
		return SettingsSnapshot{}, err
	}
	s.snapshot = next
	result := next
	result.Profiles = slices.Clone(next.Profiles)
	return result, nil
}

func validatePreferences(p Preferences) error {
	switch p.Theme {
	case "system", "light", "dark":
	default:
		return fmt.Errorf("unknown theme %q", p.Theme)
	}
	switch p.Accent {
	case "bot", "blue", "neutral":
	default:
		return fmt.Errorf("unknown accent %q", p.Accent)
	}
	switch p.Language {
	case "system", "en", "zh":
	default:
		return fmt.Errorf("unknown language %q", p.Language)
	}
	if p.MicrophoneID == "" || (p.MicrophoneID != "default" && p.MicrophoneID != "disabled" && len(p.MicrophoneID) > 512) {
		return errors.New("invalid microphone device id")
	}
	if p.Timezone == "" {
		return errors.New("invalid timezone")
	}
	if p.Timezone != "auto" {
		if _, err := time.LoadLocation(p.Timezone); err != nil {
			return fmt.Errorf("unknown timezone %q", p.Timezone)
		}
	}
	return nil
}

func (s *Settings) UpdatePreferences(p Preferences) (SettingsSnapshot, error) {
	if err := validatePreferences(p); err != nil {
		return SettingsSnapshot{}, err
	}
	snap, err := s.update(func(next *SettingsSnapshot) error {
		next.Preferences = p
		return nil
	})
	if err != nil {
		return SettingsSnapshot{}, err
	}
	s.mu.Lock()
	apply := s.applyTheme
	s.mu.Unlock()
	if apply != nil {
		apply(p.Theme)
	}
	return snap, nil
}

func validProfileName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", errors.New("profile name is required")
	}
	if utf8.RuneCountInString(name) > 80 {
		return "", errors.New("profile name too long")
	}
	return name, nil
}

func (s *Settings) CreateProfile(name, email string) (SettingsSnapshot, error) {
	name, err := validProfileName(name)
	if err != nil {
		return SettingsSnapshot{}, err
	}
	profile := LocalProfile{ID: profileID(), Name: name, Email: strings.TrimSpace(email)}
	return s.update(func(next *SettingsSnapshot) error {
		next.Profiles = append(next.Profiles, profile)
		next.ActiveProfileID = profile.ID
		return nil
	})
}

func (s *Settings) UpdateProfile(id, name, email string) (SettingsSnapshot, error) {
	name, err := validProfileName(name)
	if err != nil {
		return SettingsSnapshot{}, err
	}
	return s.update(func(next *SettingsSnapshot) error {
		idx := slices.IndexFunc(next.Profiles, func(p LocalProfile) bool { return p.ID == id })
		if idx < 0 {
			return errors.New("unknown local profile")
		}
		next.Profiles[idx].Name = name
		next.Profiles[idx].Email = strings.TrimSpace(email)
		return nil
	})
}

func (s *Settings) SelectProfile(id string) (SettingsSnapshot, error) {
	return s.update(func(next *SettingsSnapshot) error {
		if id != "" && !slices.ContainsFunc(next.Profiles, func(p LocalProfile) bool { return p.ID == id }) {
			return errors.New("unknown local profile")
		}
		next.ActiveProfileID = id
		return nil
	})
}

const maxMemory = 64 << 10

func (s *Settings) ImportMemory(id, filename, content string) (SettingsSnapshot, error) {
	safe := strings.TrimSpace(path.Base(strings.ReplaceAll(filename, "\\", "/")))
	if safe == "" || safe == "." || safe == "/" {
		safe = "memory.txt"
	}
	if utf8.RuneCountInString(safe) > 80 {
		safe = string([]rune(safe)[:80])
	}
	lower := strings.ToLower(safe)
	var normalized string
	switch {
	case strings.HasSuffix(lower, ".txt"), strings.HasSuffix(lower, ".md"):
		normalized = strings.TrimSpace(strings.ReplaceAll(content, "\r\n", "\n"))
		if normalized == "" {
			return SettingsSnapshot{}, errors.New("导入内容为空")
		}
	case strings.HasSuffix(lower, ".json"):
		var parsed any
		if err := json.Unmarshal([]byte(content), &parsed); err != nil {
			return SettingsSnapshot{}, fmt.Errorf("JSON 无效：%v", err)
		}
		var buf bytes.Buffer
		if err := json.Indent(&buf, []byte(content), "", "  "); err != nil {
			return SettingsSnapshot{}, fmt.Errorf("JSON 无效：%v", err)
		}
		normalized = buf.String()
	default:
		return SettingsSnapshot{}, errors.New("仅支持 .txt / .md / .json 文件")
	}
	addition := "## " + safe + "\n" + normalized
	return s.update(func(next *SettingsSnapshot) error {
		idx := slices.IndexFunc(next.Profiles, func(p LocalProfile) bool { return p.ID == id })
		if idx < 0 {
			return errors.New("unknown local profile")
		}
		existing := next.Profiles[idx].Memory
		merged := existing + "\n\n" + addition
		if existing == "" {
			merged = addition
		}
		if len(merged) > maxMemory {
			return errors.New("导入后记忆超过 64KB 上限")
		}
		next.Profiles[idx].Memory = merged
		return nil
	})
}

func (s *Settings) profile(id string) (LocalProfile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := slices.IndexFunc(s.snapshot.Profiles, func(p LocalProfile) bool { return p.ID == id })
	if idx < 0 {
		return LocalProfile{}, errors.New("unknown local profile")
	}
	return s.snapshot.Profiles[idx], nil
}

func (s *Settings) isDefaultProfile(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.snapshot.Profiles) > 0 && s.snapshot.Profiles[0].ID == id
}

func (s *Settings) contextMessage(profileID, text string, now time.Time) (string, error) {
	snapshot, err := s.Get()
	if err != nil {
		return "", err
	}
	var profile *LocalProfile
	for i := range snapshot.Profiles {
		if snapshot.Profiles[i].ID == profileID {
			profile = &snapshot.Profiles[i]
			break
		}
	}
	if profile == nil {
		return "", errors.New("unknown local profile")
	}
	location := time.Local
	if snapshot.Preferences.Timezone != "auto" {
		location, err = time.LoadLocation(snapshot.Preferences.Timezone)
		if err != nil {
			return "", err
		}
	}
	contextText := fmt.Sprintf("用户设置：时区 %s；当前时间 %s。", location.String(), now.In(location).Format(time.RFC3339))
	if profile.Memory != "" {
		contextText += "\n导入的记忆仅供背景参考，不代表已执行的操作；与本轮请求冲突时，以本轮请求为准。\n<imported_memory>\n" + profile.Memory + "\n</imported_memory>"
	}
	return contextText + "\n\n用户本轮消息：\n" + text, nil
}
