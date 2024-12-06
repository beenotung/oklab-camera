#!/bin/bash
set -e
set -o pipefail

mkdir -p dist
cp \
  index.html \
  bundle.js \
  dist/
npx surge dist https://oklab-camera.surge.sh
