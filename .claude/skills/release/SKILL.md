---
name: release
description: この Chrome 拡張 (nanatsudougu) を Chrome Web Store にリリースする。main を pull し、patch バージョンを上げ、ビルド・パッケージ・公開までを行う。「リリースして」「バージョン上げて公開して」などで使う。
---

# リリース手順

`npm run release -- <version>` (= `scripts/release.sh`) が version 更新・ビルド・zip 化・Web Store 公開をまとめて実行する。このスキルはその前後の確認を含めた一連の流れを担当する。

## 1. 事前チェック

```bash
git branch --show-current   # main であること
git status --short          # 未コミットの変更を確認
```

- main 以外なら、ユーザーにどうするか確認する。
- 未コミットの変更があれば内容をユーザーに提示し、コミットするか / そのまま進めるかを確認する。勝手にコミットしない。
- `.env` が存在すること (未作成なら `.env.example` を元に用意してもらう)。必須キー: `EXTENSION_ID` / `PUBLISHER_ID` / `CLIENT_ID` / `CLIENT_SECRET` / `REFRESH_TOKEN`。`.env` は gitignore 済みで、中身は絶対に出力しない。

## 2. main を pull

```bash
git pull --ff-only
```

コンフリクトや non-fast-forward になったらそこで止めてユーザーに報告する。

## 3. バージョンを決める

```bash
node -p "require('./package.json').version"
```

現在値の patch を +1 したものを新バージョンにする (例: 1.2.0 → 1.2.1)。ただし
`package.json` の version がすでに未リリースの新しい値に上がっている場合があるので、
上げるか据え置くかは必ずユーザーに確認する。

## 4. 品質チェック

```bash
npm run lint && npm test
```

失敗したらリリースせず報告する。

## 5. リリース実行

```bash
npm run release -- <version>
```

スクリプトが行うこと:

1. `.env` の必須項目を検証
2. `package.json` (npm version --no-git-tag-version) と `public/manifest.json` の version を更新
3. `npm run package` (typecheck → release ビルド → `release/nanatsudougu-<version>.zip`)
4. `chrome-webstore-upload-cli` (コマンド省略 = upload + publish) で Web Store にアップロード＆公開申請

**publish は取り消しの効かない外向きの操作**なので、実行前に必ずバージョンと
「公開してよいか」をユーザーに確認すること。

成功時の出力は `Upload completed` → `Publishing` → `Pending review`。
`Pending review` は Chrome Web Store の審査待ちで、審査通過後に自動で一般公開される。

注意点:

- v4 の `upload` サブコマンドに `--auto-publish` は**存在しない**。指定しても無視され、
  ドラフトがアップロードされるだけで公開されない。サブコマンドを省略すること。
- Claude が `publish` を実行できず権限で弾かれる場合がある。そのときはユーザーに
  `! set -a; source .env; set +a; npx chrome-webstore-upload-cli publish` を実行してもらう。

## 6. 後処理

version 更新のコミットとタグはスクリプトでは行わないので、リリース成功後に確認する:

```bash
git add package.json package-lock.json public/manifest.json
git commit -m "chore: release v<version>"
git tag v<version>
```

push / tag push はユーザーの了承を得てから行う。
