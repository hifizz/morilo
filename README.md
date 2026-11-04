# Morilo

**Your AI workspace, on your desktop.**

English | [简体中文](README.zh-CN.md)

Morilo is an early-stage desktop AI app built with Go, MyGo and React. Keep separate assistants and conversations in one place, with streaming replies, local profiles and optional connections to apps and a remote computer. Agent sessions are powered by the Pi RPC CLI.

![Morilo desktop interface with example conversations](docs/images/morilo-desktop.png)

*Native macOS interface with illustrative sample conversations, not a recorded live model run.*

## What it does

- **Multiple assistants and conversations** — organize different kinds of work without putting everything in one thread.
- **Streaming, readable replies** — Markdown, short message bubbles and a compact progress indicator instead of raw tool logs.
- **Local profiles and history** — keep conversations, preferences and imported memory on your device, separated by profile.
- **Personal preferences** — light/dark themes, accent colors, English/Chinese UI and timezone-aware context.
- **Optional connected apps** — GitHub and Vercel integrations through Composio, limited to the implemented read-only tool allowlist.
- **Optional remote computer** — connect an Instabox machine, watch its desktop and opt into interactive control.

> **Project status:** macOS is the currently validated desktop target. Browser preview uses simulated replies; real agent execution requires the desktop app and a configured model provider. Demo billing, referral, permissions and vault settings were removed. Scheduled tasks are not implemented.

## Install

Packages target **macOS 13.5 or later**, on Apple Silicon and Intel. They include **Node.js 24.22.2 and Pi 1.5.0**; end users do not need Go, Node or Pi installed.

[GitHub Actions](https://github.com/hifizz/morilo/actions/workflows/build.yml) produces preview packages for `main` and `develop`. Unsigned packages are marked as test builds. Signed, notarized versions are published through [GitHub Releases](https://github.com/hifizz/morilo/releases) once the maintainer configures Apple signing credentials. See [distribution details](docs/distribution.md).

## Run locally

### Requirements

- macOS for the validated native workflow.
- Go per [`go.mod`](go.mod) (**1.27.3**).
- Node.js per [`.node-version`](.node-version) (**24.22.2**) and npm.
- Access to a model provider for real chat.

A globally installed Pi CLI is **not** required: `npm run prepare:runtime` stages the bundled Node + pinned Pi runtime used by builds, and development falls back to an installed `pi` only when the prepared runtime is absent.

```bash
git clone https://github.com/hifizz/morilo.git
cd morilo
npm ci
npm --prefix frontend ci
npm run prepare:runtime
npm run dev
```

On macOS, `npm run dev` prepares a dedicated local development signing identity, starts Vite on port 3000, and opens **Morilo Dev.app**. An Apple Developer subscription is not required for this local workflow. See [development and signing notes](docs/development.md) for details.

### Configure a model provider

On first launch, onboarding asks for your model service: pick a preset (OpenAI, Anthropic, Google Gemini, Ollama or OpenAI-compatible), adjust the protocol and base URL if needed, paste your API key, and enter a model ID manually or via "Load models". **Test and save** performs one short real request against your provider — it may incur a charge on your own account. Check "no API key" for local providers. Advanced settings cover image support, reasoning, context window and max output tokens; they must match what your provider actually supports.

Keys live only in the OS credential store. Morilo writes a managed, non-secret Pi configuration under `<userData>/pi-agent/managed`; it does not use or modify your global Pi configuration, and `connections.json` stores only opaque credential references, never keys.

| Build | Pi configuration directory |
| --- | --- |
| Development | `~/Library/Application Support/Morilo Dev/pi-agent/` |
| Packaged app | `~/Library/Application Support/Morilo/pi-agent/` |

A valid pre-existing per-app `pi-agent` configuration is retained and treated as a completed setup; nothing is migrated or deleted.

### Optional services

- **GitHub / Vercel:** open **Connect apps** in the desktop app and configure a Composio project API key. The app stores that key in the system credential store. Connected-account permissions still matter: Morilo's tool allowlist does not narrow the underlying token's permissions.
- **Instabox:** connect in **Settings → Computer** (or during onboarding) with a personal Instabox API key, then pick one of your machines. **Create remote computer** asks for a name, shows the reported spec, and requires an explicit confirmation — usage fees are charged by Instabox on your own account. A pending creation keeps a durable record you can resume or dismiss; dismissing only stops tracking, it never deletes the machine. The same form handles key rotation (blocked while a creation is pending). `INSTABOX_API_KEY`/`INSTABOX_MACHINE_ID`/`INSTABOX_API_URL` environment variables are still honored as a legacy fallback for existing setups, but are not the default path.

  Modes: **chat** (fresh default — no file or app tools), **local** (agent tools run in `~/morilo-workspace` with your full OS permissions — it is not a sandbox and requires explicit confirmation), or **remote** (your Instabox machine).

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the native app and frontend development server |
| `npm run build` | Build the frontend and package the desktop app |
| `npm run generate` | Regenerate the typed Go-to-TypeScript bindings |
| `npm --prefix frontend run dev` | Browser-only preview with simulated replies |
| `CGO_ENABLED=0 go test ./...` | Run offline business tests; paid model calls are skipped by default |
| `MORILO_LIVE_TEST=1 go test . -run '^TestPiSessionRoundTrip$' -v` | Opt into the legacy Pi configuration round trip; requires credentials and may incur provider charges |
| `npm --prefix frontend run test:markdown` | Check Markdown rendering and unsafe-content handling |

macOS packages are written under `build/darwin-arm64/` on the tested Apple Silicon setup. Local builds are not automatically notarized for public distribution; see [distribution and release notes](docs/distribution.md) for CI artifacts, signing secrets and the release flow.

## Project layout

- `main.go` — desktop host, window and service bindings.
- `agent.go` — per-conversation Pi RPC sessions and streamed chat events.
- `settings.go` / `store.go` — local profiles, preferences and conversation persistence.
- `integrations.go` / `integrations/` — Composio integration and the read-only tool bridge.
- `computer.go` / `computer/` — remote-computer service and Instabox adapter.
- `frontend/` — React, TypeScript, Vite and Tailwind UI.
- `docs/development.md` — local signing and credential-store notes.

## Data and credentials

Local storage is not the same as offline execution: prompts and imported memory can be sent to your configured model provider, and optional services communicate with their respective providers. Pi can run tools on your machine; local execution is not a sandbox.

Keep API keys, local app data and generated build artifacts out of commits. The app uses a dedicated Pi configuration directory and does not intentionally reuse your global Pi credentials.

## License

[MIT](LICENSE) — Copyright (c) 2026 hifizz. Third-party dependencies retain their own licenses.
