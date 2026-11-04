# Distribution and releases

Morilo ships as a self-contained macOS app. The packaged app embeds its own Node.js 24.22.2 runtime and the pinned `@earendil-works/pi-coding-agent` 1.5.0 package — end users do not install Node.js or Pi. Node archives are downloaded from `nodejs.org` and verified against the pinned SHA256 values in [`runtime/node-checksums.json`](../runtime/node-checksums.json); dependency versions come from the frozen `runtime/package-lock.json` npm integrity data, and shipped license files plus `THIRD-PARTY-NOTICES.txt` are included in the bundle. One upstream data file (`pi-ai`'s `providers/data/.manifest.json`) is renamed to `manifest.json` during staging because the MyGo resource copier skips dotfiles; the single import that references it is rewritten and its license is retained.

## Continuous integration

`.github/workflows/build.yml` runs on pushes to `main` and `develop`, on **all** tags, on `workflow_dispatch`, and on pull requests to `main`/`develop` (PRs run only the `checks` job — tests, generated-binding freshness, Markdown checks and the frontend build).

Checks and both packaging jobs use `macos-15-intel`, avoiding dependence on the constrained hosted ARM runner pool. MyGo cross-compiles the Apple Silicon app; the preparation script explicitly installs the target architecture's Node and Pi dependencies. Each job runs `npm run prepare:runtime -- <arch>` then `npx mygo build -platform darwin/<arch>`, verifies the signature with `codesign --verify --deep --strict`, and checks the app and Node binary architectures with `lipo`.

The Intel job additionally executes the packaged-runtime probe (`TestPackagedModelConnection`, a local SSE fixture with installed Node/Pi excluded from PATH — no paid provider call). The cross-built ARM package cannot execute on an Intel runner; test it on Apple Silicon before a release using `MORILO_PACKAGED_RESOURCES="<app>/Contents/Resources" go test . -run '^TestPackagedModelConnection$' -count=1`. The initial ARM package passed this check locally.

Both jobs upload the DMG plus its `.sha256` as a workflow artifact named `morilo-<label>-<arch>` with a 14-day retention. File names carry the version, branch/tag + 8-char SHA label, architecture and an `unsigned`/`notarized` status, e.g. `morilo-0.1.0-main-a1b2c3d4-arm64-unsigned.dmg`.

The workflow does not require or receive model provider, Instabox or Composio keys.

## Signing and notarization

Signing is optional per job. When all six secrets are present the job creates a temporary keychain, imports a Developer ID Application certificate, configures a notarytool profile, and produces a signed + notarized DMG. When any secret is missing, the same job still produces and uploads an **unsigned** DMG for testing; the `release` job then fails explicitly rather than publishing unsigned builds.

| Secret | Content |
| --- | --- |
| `MACOS_CERTIFICATE_P12` | Base64-encoded Developer ID Application `.p12` |
| `MACOS_CERTIFICATE_PASSWORD` | Password for the `.p12` |
| `MACOS_SIGN_IDENTITY` | Signing identity name, e.g. `Developer ID Application: … (TEAMID)` |
| `APPLE_ID` | Apple ID for notarization |
| `APPLE_TEAM_ID` | Apple Developer team ID |
| `APPLE_APP_PASSWORD` | App-specific password for notarytool |

For local signed builds, `mygo.config.ts` honors `MORILO_SIGN_IDENTITY` plus `MORILO_NOTARY_PROFILE` / `MORILO_NOTARY_KEYCHAIN` — provision a notarytool keychain profile yourself (`xcrun notarytool store-credentials`). Without them, `npm run build` produces an ad-hoc signed local package.

Signing and notarization have not been exercised against a real Apple account from this repository yet; the workflow is designed for that configuration but is unverified end-to-end.

## Cutting a release

A public GitHub Release is created **only** by pushing a version tag. Tag `vX.Y.Z` (or a semver prerelease like `v1.0.0-beta.1`) must match `package.json`'s `version` exactly; `scripts/release-metadata.mjs` enforces this. Non-version tags still build and upload artifacts but never create a Release.

Maintainer flow (do not execute from automation):

```bash
npm version <version> --no-git-tag-version   # updates package.json and package-lock.json
git add package.json package-lock.json && git commit -m "chore: version <version>"
git push
git tag v<version>
git push origin v<version>
```

The `release` job requires **both** `*-notarized.dmg` artifacts (arm64 and amd64) to exist — it verifies the checksums, then creates (or updates) the GitHub Release, marking prereleases automatically. Missing signing secrets make this job fail explicitly; unsigned artifacts remain available from the workflow run.

The repository currently has no tag or release produced by this work. Automatic updates are not enabled; users download new versions from GitHub Releases.
