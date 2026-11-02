package main

import (
	"context"
	"testing"
	"time"
)

// TestPiSessionRoundTrip drives one real prompt through a pi subprocess and
// expects streamed text followed by settlement.
func TestPiSessionRoundTrip(t *testing.T) {
	sess, err := startPi("test")
	if err != nil {
		t.Fatalf("startPi: %v", err)
	}
	defer sess.kill()

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	got := make(chan ChatEvent, 1024)
	done := make(chan error, 1)
	go func() {
		done <- sess.prompt(ctx, "Reply with exactly: OK", func(e ChatEvent) bool {
			got <- e
			return true
		})
	}()

	var text string
	var sawDone bool
	for !sawDone {
		select {
		case e := <-got:
			if e.Type == "text" {
				text += e.Delta
			}
			if e.Type == "done" {
				sawDone = true
			}
			if e.Type == "error" {
				t.Fatalf("stream error: %s", e.Detail)
			}
		case err := <-done:
			if err != nil {
				t.Fatalf("prompt: %v", err)
			}
			sawDone = true
		case <-ctx.Done():
			t.Fatal("timed out waiting for the run to settle")
		}
	}
	if text == "" {
		t.Fatal("no text streamed")
	}
	t.Logf("streamed: %q", text)
}
