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

あわせて、前回リリース以降に `manifest.json` の権限が増えていないか確認する:

```bash
git diff <前回のreleaseコミット> -- public/manifest.json
```

権限が増えている場合、Developer Dashboard に用途説明を書かないと publish が弾かれる
(詳細は「7. よくある失敗と対処」)。先にユーザーへ伝えておくこと。

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

## 7. よくある失敗と対処

### `Invalid grant: The authentication keys are probably invalid or expired`

`.env` の `REFRESH_TOKEN` が失効している。**OAuth 同意画面が「テスト中 / Testing」のままだと
refresh token は 7 日で失効する**ので、まず恒久対策を行う:

1. https://console.cloud.google.com/apis/credentials/consent で
   **アプリを公開 / PUBLISH APP** を押して「本番 / In production」にする（外部審査は不要）
2. そのうえで refresh token を取り直す

`CLIENT_ID` / `CLIENT_SECRET` は失効しないので再作成不要。Google Cloud の認証情報画面で
Client secret が `Enabled` なら生きている。`.env` の値をそのまま使い回す。

token の取り直しに `npx chrome-webstore-upload-keys` は使えない。対話 CLI なので
Bash ツール経由でも `!` 実行でも 120 秒でデタッチされ、stdin を受け取れなくなる。
代わりにローカルにコールバックサーバを立てて OAuth を通す:

- `redirect_uri=http://localhost:<port>`、`scope=https://www.googleapis.com/auth/chromewebstore`、
  `access_type=offline`、`prompt=consent` で認可 URL を組み立てる
- `open <url>` でブラウザを開き、ユーザーに承認してもらう
- 受け取った code を `https://oauth2.googleapis.com/token` に POST して refresh_token を取得し、
  スクリプト内から `.env` に直接書き込む（トークンは画面に出さない）

バックアップを `.env.bak` に作る場合、**`.gitignore` は `.env` しか無視しないので
作業後に必ず削除する**こと。

### `Your submission does not meet the requirements to be published in the store.`

アップロードは成功していて、publish だけが弾かれた状態（ZIP はドラフトとして反映済み、
再アップロード不要）。原因はストア掲載情報の不備で、**多くは `manifest.json` に権限を
追加したのに用途説明 (justification) を書いていないこと**。

リリース前に権限差分を確認する:

```bash
git diff <前回のreleaseコミット> -- public/manifest.json
```

権限が増えていたら、Developer Dashboard の **プライバシーへの取り組み /
Privacy practices** タブで各権限の用途、単一用途の説明、データ使用の開示を記入し、
**審査のため送信**する必要がある。

### Developer Dashboard はブラウザ自動操作できない

`chrome.google.com` は Chrome の拡張機能ギャラリー扱いで、拡張によるスクリプト実行が
ブロックされている (`The extensions gallery cannot be scripted`)。claude-in-chrome では
スクリーンショットすら取れない。ダッシュボードの入力は**必ずユーザーの手作業**になるので、
代行を申し出ず、貼り付け用の文面を用意して渡すこと。
