#!/bin/bash
set -euo pipefail

VERSION=$(node -p "require('./manifest.json').version")
TAG="$VERSION"

echo "Preparing release v$VERSION"

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag '$TAG' already exists"
  exit 1
fi

git tag "$TAG"
git push origin "$TAG"

gh release create "$TAG" --title "$TAG" main.js styles.css manifest.json --notes ""

echo "Release v$VERSION published: https://github.com/maoqingwei/obsidian-version-view/releases/tag/$TAG"
