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

echo "Tag $TAG pushed, Actions 会自动创建 Release 并上传附件"
echo "进度查看: https://github.com/maoqingwei/obsidian-version-view/actions"
