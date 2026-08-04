# browser-tool

廃止された Jira (atlassian.net) のドメインへのアクセスを、**パス以降をそのまま残したまま**移行先のドメインへリダイレクトする Chrome 拡張です。

```
https://a.atlassian.net/browse/XAPP-134
                ↓
https://b.atlassian.net/browse/XAPP-134
```

パス名だけでなく、クエリ文字列とハッシュもそのまま引き継ぎます。

## インストール

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」でこのリポジトリのルートを選択

## 使い方

ツールバーのアイコン（または拡張機能の「オプション」）から設定画面を開きます。

| 有効 | from | to | 削除 |
| --- | --- | --- | --- |
| ☑ | `a.atlassian.net` | `b.atlassian.net` | 削除 |

- **有効**: チェックボックスでルールごとに有効／無効を切り替えます
- **from / to**: ホスト名を入力します（`https://` やパスを付けても自動で取り除かれます）
- **削除**: その行を削除します
- 「＋ 追加」で行を追加します。変更は自動保存され、`chrome.storage.sync` 経由で他の端末にも同期されます

無効なルール（from か to が空、from と to が同じ）は無視されます。同じ from に複数のルールがある場合は、有効なもののうち上の行が優先されます。

## しくみ

- ルールは `chrome.storage.sync` に保存されます
- Service worker (`src/background.js`) がルールを [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) の動的ルールへ変換します。リクエストが発生する前にブラウザ側でリダイレクトされるため、廃止されたドメインへ実際にアクセスすることはありません
- 変換されるのは**ホスト名だけ**です（`redirect.transform.host`）。そのためパス・クエリ・ハッシュは自動的に維持されます
- 対象は `main_frame`（アドレスバーやリンクによるページ遷移）のみです

権限は `*://*.atlassian.net/*` に限定しています。atlassian.net 以外のドメインをルールに登録したい場合は `manifest.json` の `host_permissions` を広げてください。

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
    storage.js             chrome.storage.sync の読み書きと正規化
    dnr-sync.js            動的ルールの入れ替え
    debounce.js            保存のデバウンス
  options/
    options.html/.css/.js  設定画面
    rules-table.js         ルールテーブルのレンダリングと操作
tests/                     各モジュールのテスト + 設定画面の結合テスト
```
