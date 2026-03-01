#!/usr/bin/env bash
# Usage: ./scripts/release.sh [patch|minor|major]
# Default: patch
#
# 작업 순서:
#   1. CHANGELOG.md [Unreleased] 섹션에 이번 변경 내용 기록
#   2. ./scripts/release.sh minor  (또는 patch / major)
#      → VERSION 파일 bump, CHANGELOG 날짜 삽입, git commit + tag 자동 생성

set -euo pipefail

BUMP=${1:-patch}

if ! command -v bump-my-version &>/dev/null; then
  echo "❌  bump-my-version 이 없습니다. 먼저 설치하세요:"
  echo "    pip install bump-my-version"
  exit 1
fi

OLD=$(cat VERSION)
echo "▶  현재 버전: $OLD  →  bump: $BUMP"

# CHANGELOG [Unreleased] 섹션이 비어 있으면 경고
if grep -q "## \[Unreleased\]" CHANGELOG.md; then
  NEXT_BLOCK=$(awk '/## \[Unreleased\]/{found=1; next} found && /^## /{exit} found{print}' CHANGELOG.md | grep -v '^[[:space:]]*$' | head -1)
  if [ -z "$NEXT_BLOCK" ]; then
    echo "⚠️   CHANGELOG.md [Unreleased] 섹션이 비어 있습니다."
    echo "    릴리스 전에 변경 내용을 기록하는 것을 권장합니다."
    read -r -p "계속 진행하시겠습니까? (y/N) " CONFIRM
    [[ "$CONFIRM" =~ ^[Yy]$ ]] || exit 0
  fi
fi

bump-my-version bump "$BUMP"

NEW=$(cat VERSION)
echo "✅  릴리스 완료: v$NEW"
echo "    git tag v$NEW 생성됨"
echo ""
echo "👉  원격 반영: git push && git push --tags"
