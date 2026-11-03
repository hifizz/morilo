package main

import (
	"context"
	"log"
	"os"
	"time"

	"github.com/egoist/mygo"
)

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if os.Getenv("MYGO_SELFTEST") != "" {
		dir, err := os.MkdirTemp("", "grokbot-selftest-")
		if err != nil {
			log.Fatal(err)
		}
		mygo.App.SetPath(mygo.PathUserData, dir)
	}
	computer := NewComputer(computerBackend())
	settings, err := NewSettings()
	if err != nil {
		log.Fatalf("settings: %v", err)
	}
	mygo.Bind(settings)
	mygo.Bind(computer)
	integrations, err := NewIntegrations(func(id string) error { _, err := settings.profile(id); return err })
	if err != nil {
		log.Fatal(err)
	}
	defer integrations.close()
	mygo.Bind(integrations)
	chat := NewChat(computer, settings)
	chat.integrations = integrations
	mygo.Bind(chat)
	if store, err := NewStore(settings); err != nil {
		log.Printf("store: %v (state will not persist)", err)
	} else {
		mygo.Bind(store)
	}
	mygo.App.WhenReady(func() {
		settings.applyTheme = func(theme string) {
			mygo.Theme.SetSource(mygo.ThemeSource(theme))
		}
		if snapshot, err := settings.Get(); err == nil {
			settings.applyTheme(snapshot.Preferences.Theme)
		}
		win := mygo.NewWindow(mygo.WindowOptions{
			Title:         "Grokbot",
			URL:           "/",
			Width:         1280,
			Height:        840,
			MinWidth:      960,
			MinHeight:     640,
			StateKey:      "main",
			TitleBarStyle: mygo.TitleBarHiddenInset,
			// Center the traffic lights in the 46px sidebar actions row.
			TrafficLightPosition: &mygo.Point{X: 15, Y: 17},
		})
		startDevDiagnostics(ctx, win, settings, integrations)
		if os.Getenv("MYGO_SELFTEST") != "" {
			go selftest(win)
		}
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}

// selftest types a prompt into the real composer, sends it, waits for the
// run to settle and screenshots the page: MYGO_SELFTEST=1 mygo dev.
func selftest(win *mygo.Window) {
	time.Sleep(2 * time.Second) // let the page finish loading
	result, err := mygo.EvalAs[string](win.Page(), `
		const ta = document.querySelector('textarea');
		if (!ta) return "no textarea";
		const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
		setter.call(ta, '用三条短消息介绍一下你自己');
		ta.dispatchEvent(new Event('input', { bubbles: true }));
		ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		return "sent";
	`)
	log.Printf("selftest send: %v (err: %v)", result, err)
	for i := 0; i < 90; i++ {
		time.Sleep(time.Second)
		typing, _ := mygo.EvalAs[bool](win.Page(), `return !!document.querySelector('.agent-status')`)
		if i > 3 && !typing {
			break
		}
	}
	info, _ := mygo.EvalAs[string](win.Page(), `
		const tbs = [...document.querySelectorAll('.message-toolbar')];
		tbs.forEach(t => { t.style.opacity = '1'; });
		const r = tbs[0]?.getBoundingClientRect();
		return tbs.length + " toolbars, first at " + (r ? r.x + "," + r.y + " " + r.width + "x" + r.height : "n/a");
	`)
	log.Printf("selftest toolbars: %s", info)
	time.Sleep(300 * time.Millisecond) // let the paint settle
	png, err := win.CapturePage()
	if err != nil {
		log.Printf("selftest capture: %v", err)
		return
	}
	if err := os.WriteFile("/tmp/grokbot-shot.png", png, 0o644); err != nil {
		log.Printf("selftest write: %v", err)
		return
	}
	count, _ := mygo.EvalAs[int](win.Page(), `return document.querySelectorAll('.message-row--agent').length`)
	log.Printf("selftest done: /tmp/grokbot-shot.png, agent bubbles: %d", count)
}
