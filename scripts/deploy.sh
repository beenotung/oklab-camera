#!/bin/bash
set -e
set -o pipefail

npm run build
mkdir -p dist
cp -r \
  index.html \
  bundle.js \
  imgs/ \
  manifest.json \
  dist/
npx surge dist https://oklab-camera.surge.sh
