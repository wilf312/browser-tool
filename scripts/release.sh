#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "使い方: npm run release -- <version>"
  echo "例: npm run release -- 1.2.0"
  exit 1
fi

# .env の存在と必須項目を確認
if [ ! -f ".env" ]; then
  echo "エラー: .env ファイルが見つかりません。.env.example をコピーして設定してください。"
  exit 1
fi

set -a
source .env
set +a

MISSING=()
[ -z "$EXTENSION_ID" ]   && MISSING+=("EXTENSION_ID")
[ -z "$PUBLISHER_ID" ]   && MISSING+=("PUBLISHER_ID")
[ -z "$CLIENT_ID" ]      && MISSING+=("CLIENT_ID")
[ -z "$CLIENT_SECRET" ]  && MISSING+=("CLIENT_SECRET")
[ -z "$REFRESH_TOKEN" ]  && MISSING+=("REFRESH_TOKEN")

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "エラー: .env に以下の項目が設定されていません:"
  for key in "${MISSING[@]}"; do
    echo "  - $key"
  done
  exit 1
fi

echo "バージョンを $VERSION に更新します..."

# package.json
CURRENT=$(node -p "require('./package.json').version")
if [ "$CURRENT" != "$VERSION" ]; then
  npm version "$VERSION" --no-git-tag-version
fi

# manifest.json
MANIFEST="public/manifest.json"
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" "$MANIFEST"

echo "package.json と manifest.json を $VERSION に更新しました"

# ビルド・パッケージ・公開
npm run package
# upload と publish を両方行う（コマンド省略時の挙動）
# 注: v4 の upload サブコマンドに --auto-publish は無く、指定しても無視される
npx chrome-webstore-upload-cli --source "release/nanatsudougu-${VERSION}.zip"
