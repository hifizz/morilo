# Changelog

All notable user-facing changes to Morilo are documented here, newest
first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/):
each `## [<version>] - <date>` section becomes the release notes shown in
the in-app update window, and `mygo build` fails when the section of the
version being built is missing. Entries are grouped under `### Added`,
`### Changed`, `### Deprecated`, `### Removed`, `### Fixed` and
`### Security`; internal-only changes (CI, tooling, docs) need no entry.
Pull requests add user-facing entries under `## [Unreleased]`; cutting a
release renames it to `## [<version>] - <date>` in the same commit that
bumps `package.json`.

## [Unreleased]

## [0.1.0] - 2026-11-09

### Added

- Multi-bot chat with streaming replies, a thinking/tool activity
  indicator, and consecutive short messages split into separate bubbles.
- User-owned model connections: any provider is configured in onboarding
  or Settings and verified before it is saved; API keys live in the
  system credential store.
- Local profiles, each with its own conversations and memory import.
- Optional Instabox remote computers that give the agent a desktop.
- GitHub and Vercel integrations with read-only tools.
- Signed automatic updates from GitHub Releases: the app checks in the
  background, offers install, later or skip, and relaunches into the new
  version after the user installs.
