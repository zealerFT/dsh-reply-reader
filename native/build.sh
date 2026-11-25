#!/bin/sh
set -eu
cd "$(dirname "$0")"
out=$(mktemp -d)
trap 'rm -rf "$out"' EXIT
for arch in arm64 x86_64; do
  xcrun swiftc -parse-as-library -O -target "$arch-apple-macosx15.0" translate.swift -o "$out/$arch"
done
lipo -create "$out/arm64" "$out/x86_64" -output translate
codesign --force -s - translate
