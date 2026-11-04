package main

import (
	"encoding/json"
	"errors"
	"net/url"
	"strings"
	"unicode"
)

// ModelConnection contains only user-visible, non-secret configuration.
// The API key is supplied to Pi through a child-process environment variable.
type ModelConnection struct {
	API            string `json:"api"`
	BaseURL        string `json:"baseUrl"`
	ModelID        string `json:"modelId"`
	NoAPIKey       bool   `json:"noApiKey"`
	SupportsImages bool   `json:"supportsImages"`
	Reasoning      bool   `json:"reasoning"`
	ContextWindow  int    `json:"contextWindow"`
	MaxTokens      int    `json:"maxTokens"`
}

const managedProviderID = "morilo-user"
const modelKeyEnvironment = "MORILO_MODEL_API_KEY"

func normalizeModelConnection(config ModelConnection) (ModelConnection, error) {
	config.BaseURL = strings.TrimRight(strings.TrimSpace(config.BaseURL), "/")
	config.ModelID = strings.TrimSpace(config.ModelID)
	switch config.API {
	case "openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai":
	default:
		return config, errors.New("choose a supported model API protocol")
	}
	address, err := url.Parse(config.BaseURL)
	if err != nil || address.Hostname() == "" ||
		(address.Scheme != "https" && address.Scheme != "http") ||
		address.User != nil || address.RawQuery != "" || address.Fragment != "" ||
		strings.ContainsAny(config.BaseURL, "\r\n\t ") {
		return config, errors.New("use an HTTP or HTTPS base URL without credentials, query parameters, or a fragment")
	}
	if config.ModelID == "" || len(config.ModelID) > 256 ||
		strings.IndexFunc(config.ModelID, unicode.IsControl) >= 0 {
		return config, errors.New("enter a valid model ID")
	}
	if config.ContextWindow < 1024 || config.ContextWindow > 10000000 ||
		config.MaxTokens < 1 || config.MaxTokens > config.ContextWindow {
		return config, errors.New("model context must be 1,024–10,000,000 tokens; maximum output must fit within it")
	}
	return config, nil
}

// managedPiFiles is the only author of the generated model configuration.
// Callers write these files into an isolated managed directory and leave any
// pre-existing pi-agent configuration untouched. No API key enters these bytes.
func managedPiFiles(config ModelConnection) (map[string][]byte, error) {
	config, err := normalizeModelConnection(config)
	if err != nil {
		return nil, err
	}
	input := []string{"text"}
	if config.SupportsImages {
		input = append(input, "image")
	}
	model := map[string]any{
		"id": config.ModelID, "name": config.ModelID,
		"reasoning": config.Reasoning, "input": input,
		"contextWindow": config.ContextWindow, "maxTokens": config.MaxTokens,
	}
	key := "${" + modelKeyEnvironment + "}"
	if config.NoAPIKey {
		key = "morilo-local"
	}
	models := map[string]any{
		"providers": map[string]any{
			managedProviderID: map[string]any{
				"name": "Your model connection", "baseUrl": config.BaseURL,
				"api": config.API, "apiKey": key, "models": []any{model},
			},
		},
	}
	thinking := "off"
	if config.Reasoning {
		thinking = "medium"
	}
	settings := map[string]any{
		"defaultProvider": managedProviderID, "defaultModel": config.ModelID,
		"defaultThinkingLevel": thinking,
	}
	files := make(map[string][]byte, 3)
	for name, value := range map[string]any{
		"models.json": models, "settings.json": settings, "auth.json": map[string]any{},
	} {
		data, err := json.MarshalIndent(value, "", "  ")
		if err != nil {
			return nil, err
		}
		files[name] = append(data, '\n')
	}
	return files, nil
}
