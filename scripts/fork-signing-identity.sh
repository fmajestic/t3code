#!/usr/bin/env bash
# Fork-local: creates the self-signed "T3 Fork Local" code signing identity that fork:dist:desktop:app signs with.
# macOS only delivers notifications from apps whose signature chains to a trusted certificate.
set -euo pipefail

NAME="T3 Fork Local"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"

if security find-identity -v -p codesigning "$KEYCHAIN" | grep -q "\"$NAME\""; then
  echo "\"$NAME\" is already a valid code signing identity."
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$work/key.pem" -out "$work/cert.pem" -subj "/CN=$NAME" \
  -addext "basicConstraints=critical,CA:false" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning" 2>/dev/null
# security(1) cannot read OpenSSL 3's default PKCS#12 encryption; LibreSSL has no -legacy flag.
openssl pkcs12 -export -legacy -inkey "$work/key.pem" -in "$work/cert.pem" \
  -out "$work/id.p12" -passout pass:fork -name "$NAME" 2>/dev/null ||
  openssl pkcs12 -export -inkey "$work/key.pem" -in "$work/cert.pem" \
    -out "$work/id.p12" -passout pass:fork -name "$NAME"

security import "$work/id.p12" -k "$KEYCHAIN" -P fork -T /usr/bin/codesign
echo "Trusting \"$NAME\" for code signing; macOS asks for your password."
security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$work/cert.pem"
security find-identity -v -p codesigning "$KEYCHAIN" | grep "\"$NAME\""
