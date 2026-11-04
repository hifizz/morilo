#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then
  exit 0
fi
identity='Morilo Local Development'
state="$HOME/Library/Application Support/Morilo Development"
keychain="$state/signing.keychain-db"
password_file="$state/signing-password"
umask 077
mkdir -p "$state"
chmod 700 "$state"
if [[ -e "$keychain" && ! -f "$password_file" ]]; then
  printf '%s\n' 'The development keychain password is missing; restore it rather than replacing the signing identity.' >&2
  exit 1
fi
if [[ ! -f "$password_file" ]]; then
  /usr/bin/openssl rand -hex 32 > "$password_file"
fi
chmod 600 "$password_file"
password="$(cat "$password_file")"
if [[ -z "$password" ]]; then
  printf '%s\n' 'The development keychain password file is empty.' >&2
  exit 1
fi
if [[ ! -e "$keychain" ]]; then
  /usr/bin/security create-keychain -p "$password" "$keychain" >&2
fi
/usr/bin/security unlock-keychain -p "$password" "$keychain"
# No sleep/timeout lock for this signing-only keychain; the login keychain is untouched.
/usr/bin/security set-keychain-settings "$keychain"
fingerprint="$(/usr/bin/security find-identity -p codesigning "$keychain" | awk '/"Morilo Local Development"/ { print $2; exit }')"
if [[ -z "$fingerprint" ]]; then
  if /usr/bin/security find-certificate -c "$identity" "$keychain" >/dev/null 2>&1; then
    printf '%s\n' 'The development certificate exists without a usable private key; restore its identity rather than replacing it.' >&2
    exit 1
  fi
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/morilo-signing.XXXXXX")"
  trap 'rm -rf "$tmp"' EXIT
  cat > "$tmp/certificate.cnf" <<'CONF'
[req]
prompt = no
distinguished_name = subject
x509_extensions = signing
[subject]
CN = Morilo Local Development
[signing]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
CONF
  /usr/bin/openssl req -new -newkey rsa:2048 -nodes -x509 -sha256 -days 3650 \
    -config "$tmp/certificate.cnf" -keyout "$tmp/key.pem" -out "$tmp/cert.pem" >&2
  /usr/bin/openssl pkcs12 -export -inkey "$tmp/key.pem" -in "$tmp/cert.pem" \
    -name "$identity" -out "$tmp/identity.p12" -passout pass:morilo-dev
  /usr/bin/security import "$tmp/identity.p12" -k "$keychain" -f pkcs12 -P morilo-dev -x -T /usr/bin/codesign >&2
  fingerprint="$(/usr/bin/security find-identity -p codesigning "$keychain" | awk '/"Morilo Local Development"/ { print $2; exit }')"
fi
if [[ ! "$fingerprint" =~ ^[0-9A-Fa-f]{40}$ ]]; then
  printf '%s\n' 'Could not find the development signing identity.' >&2
  exit 1
fi
# Restrict this operation to our dedicated keychain, never the login keychain.
/usr/bin/security set-key-partition-list -S apple-tool:,apple: -s -k "$password" "$keychain" >/dev/null
keychains=()
found=false
while IFS= read -r path; do
  keychains+=("$path")
  if [[ "$path" == "$keychain" ]]; then found=true; fi
done < <(/usr/bin/security list-keychains -d user | sed 's/^[[:space:]]*"//; s/"[[:space:]]*$//')
if [[ "$found" == false ]]; then
  /usr/bin/security list-keychains -d user -s "${keychains[@]}" "$keychain"
fi
# Stdout is consumed by dev.sh; diagnostics must stay on stderr.
printf '%s\n' "$fingerprint"
