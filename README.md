# browser-tool

日々のブラウザ作業を少し楽にする Chrome 拡張です。今のところ 2 つの機能があります。

1. **Jira ドメインリダイレクト** — 廃止された Jira (atlassian.net) のドメインへのアクセスを、パス以降をそのまま残したまま移行先のドメインへリダイレクトします
2. **Meet 自動入室** — Google Meet の待機画面で、次の開始時刻になったら「参加」ボタンを自動でクリックします

## インストール

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」でこのリポジトリのルートを選択

設定はツールバーのアイコン（または拡張機能の「オプション」）から開きます。

## Jira ドメインリダイレクト

```
https://a.atlassian.net/browse/XAPP-134
                ↓
https://b.atlassian.net/browse/XAPP-134
```

パス名だけでなく、クエリ文字列とハッシュもそのまま引き継ぎます。

| 有効 | from | to | 削除 |
| --- | --- | --- | --- |
| ☑ | `a.atlassian.net` | `b.atlassian.net` | 削除 |

- **有効**: チェックボックスでルールごとに有効／無効を切り替えます
- **from / to**: ホスト名を入力します（`https://` やパスを付けても自動で取り除かれます）
- **削除**: その行を削除します
- 「＋ 追加」で行を追加します。変更は自動保存され、`chrome.storage.sync` 経由で他の端末にも同期されます

無効なルール（from か to が空、from と to が同じ）は無視されます。同じ from に複数のルールがある場合は、有効なもののうち上の行が優先されます。

### しくみ

- ルールは `chrome.storage.sync` に保存されます
- Service worker (`src/background.js`) がルールを [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) の動的ルールへ変換します。リクエストが発生する前にブラウザ側でリダイレクトされるため、廃止されたドメインへ実際にアクセスすることはありません
- 変換されるのは**ホスト名だけ**です（`redirect.transform.host`）。そのためパス・クエリ・ハッシュは自動的に維持されます
- 対象は `main_frame`（アドレスバーやリンクによるページ遷移）のみです

権限は `*://*.atlassian.net/*` に限定しています。atlassian.net 以外のドメインをルールに登録したい場合は `manifest.json` の `host_permissions` を広げてください。

## Meet 自動入室

会議の待機画面（`https://meet.google.com/abc-defg-hij`）を開いておくと、**次の開始時刻**になった時点で「参加」ボタンをクリックします。

```
10:07 に待機画面を開く → 10:15 に自動で入室
```

設定画面の項目は 2 つです。

- **自動入室を有効にする**: 既定では OFF です。勝手に会議へ入るのは驚きが大きいので、明示的に ON にしたときだけ動きます
- **開始時刻の間隔**: 5 / 10 / 15 / 30 / 60 分。既定は 15 分（:00 :15 :30 :45）です

待機画面の右下に「10:15 に自動で参加します」とカウントダウンが表示され、**キャンセル**ボタンでその場で取りやめられます。入室・キャンセル後の表示は数秒で消えます。

### しくみ

- 対象は会議コードの URL（`https://meet.google.com/abc-defg-hij`）だけです。トップページや `/new` では何もしません
- 現在時刻から見て次の区切り（既定は 15 分刻み）を入室時刻とします。ちょうど区切りの時刻に開いた場合は、その次の区切りが対象になります
- 「参加」ボタンは待機画面の準備ができてから現れるため、入室時刻になっても見つからない場合は最大 2 分間探し続けます。それでも見つからなければ諦めます（`参加ボタンが見つかりませんでした`）
- ボタンは表示ラベルで探します（`今すぐ参加` / `Join now` / `参加をリクエスト` / `Ask to join`）。`参加者` のような別のボタンを誤って押さないよう、`参加` だけは完全一致のときのみ対象にします
- カメラとマイクの状態は待機画面で設定したものがそのまま使われます。拡張機能側では変更しません
- Meet は SPA なので URL を監視しています。別の会議へ移動すると、その会議のカウントダウンが改めて始まります

## 開発

```bash
npm install
npm test         # 一度だけ実行
npm run test:watch
```

TDD で実装しています。テストは [Vitest](https://vitest.dev/)（DOM は jsdom）を使用します。

```
manifest.json
src/
  background.js            service worker: ルール → declarativeNetRequest 同期
  lib/
    redirect.js            リダイレクト解決 / DNR ルール生成（純粋関数）
    sync-storage.js        chrome.storage.sync の薄いラッパ
    storage.js             リダイレクトルールの読み書きと正規化
    dnr-sync.js            動的ルールの入れ替え
    debounce.js            保存のデバウンス
    meet-schedule.js       入室時刻の計算と表示フォーマット（純粋関数）
    meet-join.js           待機画面から「参加」ボタンを探す
    meet-auto-join.js      自動入室の状態機械（タイマーと DOM を持たない）
    meet-page.js           対象となる Meet の URL 判定
    meet-settings.js       Meet 自動入室の設定の読み書き
  content/
    meet-loader.js         content script: モジュール版を動的 import で起動
    meet-auto-join.js      設定・URL 監視・パネル・状態機械の配線
    meet-panel.js          待機画面の右下に出すカウントダウン表示
  options/
    options.html/.css/.js  設定画面
    rules-table.js         ルールテーブルのレンダリングと操作
tests/                     各モジュールのテスト + 設定画面 / content script の結合テスト
```

manifest v3 の content script はモジュールを直接読み込めないため、`meet-loader.js`（通常のスクリプト）から `chrome.runtime.getURL()` + 動的 `import()` でモジュール版を起動しています。そのため `src/content/*.js` と `src/lib/*.js` を `web_accessible_resources` に登録しています。
