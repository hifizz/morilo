# Development

## Local dev signing (macOS)

`npm run dev` runs `scripts/dev.sh`. On macOS it resolves the signing
identity by calling `scripts/setup-dev-signing.sh`, which prints a
certificate fingerprint, then starts `mygo dev -sign` with it. No paid Apple
Developer certificate is required for local signing — the identity is a
self-signed certificate; notarized distribution builds remain a separate
concern.

The identity lives in a dedicated development keychain, not the login
keychain:

- `~/Library/Application Support/Grokbot Development/signing.keychain-db`
- `~/Library/Application Support/Grokbot Development/signing-password`

Both live outside the repo; no private key material is ever written to the
tree. The directory is 0700 and the password file 0600 — a random value
generated once by the script that unlocks only this signing-only keychain.
Each setup run unlocks the keychain automatically, keeps it free of lock
timeouts, seeds its key partition list non-interactively, and adds it to the
user keychain search list so `codesign` finds it.

- The certificate and its fingerprint are created once and reused. Keep the
  keychain and password file across repo cleanups — do not regenerate them;
  a new identity changes the signing requirement and discards the
  permission stability this setup exists to provide.
- Signing by fingerprint keeps the app's designated requirement
  certificate-based (`certificate leaf = H"..."`) and identical across
  rebuilds, which prevents rebuild identity churn. It does not eliminate
  every OS prompt: permission grants stored against a previously
  signed/ad-hoc build can still need a one-time permission migration or OS
  authorization on first use under the new identity.
- Set `GROKBOT_DEV_SIGN_IDENTITY` to sign dev builds with a different
  existing identity instead.
- Non-macOS: `setup-dev-signing.sh` exits immediately and `dev.sh` passes
  through to plain `mygo dev`.
