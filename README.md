# Nanatsudougu（七つ道具）

<img width="1280" height="800" alt="sc" src="https://github.com/user-attachments/assets/2a90c2e7-cbec-4275-846c-bc96439534a0" />

日々のブラウザ作業を少し楽にする Chrome 拡張です。仕事に必要な小さい道具をまとめた「七つ道具」で、
今のところ 3 つの機能があります。

1. **Jira ドメインリダイレクト** — 廃止された Jira (atlassian.net) のドメインへのアクセスを、パス以降をそのまま残したまま移行先のドメインへリダイレクトします
2. **Meet 自動入室** — Google Meet の待機画面で、次の開始時刻になったら「参加」ボタンを自動でクリックします
3. **ページ自動リロード** — 開いているタブを、決めた間隔で決めた時間だけリロードし続けます

どの設定も JSON ファイルに書き出して、別の端末で読み込めます（[設定のインポート / エクスポート](#設定のインポート--エクスポート)）。

## インストール

Vite でビルドしたものを読み込みます。

```bash
npm install
npm run build
```

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」で `dist/` を選択

設定はツールバーのアイコン（または拡張機能の「オプション」）から開きます。

自分の環境で使うだけならこれで十分です。Chrome Web Store で配布する場合は
[公開用のビルド](#公開用のビルド)を参照してください。

## Jira ドメインリダイレクト

```
https://a.atlassian.net/browse/XAPP-134
                ↓
https://b.atlassian.net/browse/XAPP-134
```

パス名だけでなく、クエリ文字列とハッシュもそのまま引き継ぎます。

| 有効 | from              | to                | 削除 |
| ---- | ----------------- | ----------------- | ---- |
| ☑    | `a.atlassian.net` | `b.atlassian.net` | 削除 |

- **有効**: チェックボックスでルールごとに有効／無効を切り替えます
- **from / to**: ホスト名を入力します（`https://` やパスを付けても自動で取り除かれます）
- **削除**: その行を削除します
- 「＋ 追加」で行を追加します。変更は自動保存され、`chrome.storage.sync` 経由で他の端末にも同期されます

無効なルール（from か to が空、from と to が同じ）は無視されます。同じ from に複数のルールがある場合は、有効なもののうち上の行が優先されます。

### しくみ

- ルールは `chrome.storage.sync` に保存されます
- Service worker (`src/background.ts`) がルールを [declarativeNetRequest](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) の動的ルールへ変換します。リクエストが発生する前にブラウザ側でリダイレクトされるため、廃止されたドメインへ実際にアクセスすることはありません
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

待機画面の左下に「10:15 に自動で参加します」とカウントダウンが表示され、**キャンセル**ボタンでその場で取りやめられます。時刻だけずらしたいときは **+1 分** / **-1 分** ボタンで入室時刻を 1 分ずつ前後に動かせます（押した回数だけ動きます）。-1 分は現在時刻より前には戻らず、入室時刻を過ぎて参加ボタンを待っている間は押せなくなります。入室・キャンセル後の表示は数秒で消えますが、待たずにパネルのどこかをクリックすればすぐ消せます（カウントダウン中のクリックでは消えません）。

### しくみ

- 対象は会議コードの URL（`https://meet.google.com/abc-defg-hij`）だけです。トップページや `/new` では何もしません
- 現在時刻から見て次の区切り（既定は 15 分刻み）を入室時刻とします。ちょうど区切りの時刻に開いた場合は、その次の区切りが対象になります
- 「参加」ボタンは待機画面の準備ができてから現れるため、入室時刻になっても見つからない場合は最大 2 分間探し続けます。それでも見つからなければ諦めます（`参加ボタンが見つかりませんでした`）
- ボタンは表示ラベルで探します（`今すぐ参加` / `Join now` / `参加をリクエスト` / `Ask to join`）。`参加者` のような別のボタンを誤って押さないよう、`参加` だけは完全一致のときのみ対象にします
- カメラとマイクの状態は待機画面で設定したものがそのまま使われます。拡張機能側では変更しません
- Meet は SPA なので URL を監視しています。別の会議へ移動すると、その会議のカウントダウンが改めて始まります

## ページ自動リロード

ビルドの結果や試合の経過のように、開いたまま更新を待つページのための機能です。ツールバーの
アイコンからこの拡張を開くと、そのとき見ていたタブが対象になります。

```
[ページ自動リロード]
  対象: https://ci.example.com/job/main
  リロード間隔 [1 分 ▾]  続ける時間 [30 分 ▾]  [開始]
                            ↓
  1 分ごとにリロードしています（終了まで 28:42 ／ 次まで 00:18）  [停止]
```

- **リロード間隔**: 30 秒 / 1 分 / 3 分 / 5 分 / 10 分 / 30 分
- **続ける時間**: 5 分 / 15 分 / 30 分 / 1 時間 / 3 時間 / 8 時間。この時間がたてば自分で止まります。
  止め忘れて何時間もリロードし続ける、ということにはなりません
- 選んだ値は次に開いたときの初期値として憶えます

止まるのは、**決めた時間がたったとき**・**タブを閉じたとき**・**「停止」を押したとき**の 3 つです。
設定画面（ポップアップ）を閉じてもタイマーは動き続けます。もう一度開けば残り時間が表示され、
そこから停止できます。

### しくみ

- タイマーは**タブに紐づきます**。そのタブで別のページへ移動した場合、移動先がリロードされます。
  URL ではなくタブが対象、と考えてください
- リロードは [`chrome.alarms`](https://developer.chrome.com/docs/extensions/reference/api/alarms) が起こします。service worker は次のリロードまでの間に
  停止されますが、アラームが来れば起き直すので、間隔が何分空いても関係ありません。逆に Chrome の
  アラームは 30 秒より短い間隔では動かないため、最短の間隔は 30 秒です
- 動いているタイマーは `chrome.storage.session` に置きます。タブ ID はブラウザを再起動すると
  意味を失うので、再起動で消えるここが正しい置き場所です
- タブごとに動くので、複数のタブでそれぞれ別のタイマーを走らせられます。設定画面はいま見ている
  タブのぶんだけを表示します
- 対象のタブの URL を読むために [`activeTab`](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) 権限を使っています。ツールバーのアイコンを
  押したそのタブに対してだけ許可される権限なので、閲覧履歴を読む権限（`tabs`）は必要ありません。
  `chrome://extensions` から設定画面をタブとして開いた場合は対象のタブがないので、その旨を表示します

## 設定のインポート / エクスポート

設定画面のいちばん下から、設定を JSON ファイルに書き出したり、書き出したファイルを読み込んだり
できます。書き出す機能も、取り込む機能も**機能単位で選べます**。

```
[エクスポート]
  書き出す機能  ☑ Jira ドメインリダイレクト  ルール 2 件（有効 1 件）
                ☑ Meet 自動入室              自動入室 ON / 15 分間隔
                ☑ ページ自動リロード         1 分ごと / 30 分
                                                  ↓
                              nanatsudougu-settings-20260804-1210.json

[インポート]
  取り込む機能  ☑ Jira ドメインリダイレクト  ルール 2 件（有効 1 件）
                ☐ Meet 自動入室              自動入室 ON / 15 分間隔
                ☑ ページ自動リロード         1 分ごと / 30 分
                                                  ↓
                        チェックした機能だけが今の設定を置き換える
```

- **エクスポート**: チェックした機能の設定だけがファイルに入ります。ファイル名には書き出した
  日時が入るので、複数の世代を並べても取り違えません
- **インポート**: ファイルを選んだ時点では何も書き込みません。中身（機能ごとの件数や値）を
  確認して、取り込む機能にチェックを入れ、「選択した設定を適用」を押したときだけ保存されます。
  チェックを外した機能と、ファイルに入っていない機能は今の設定のままです
- 適用は**置き換え**です。リダイレクトルールは今のルールに追加されるのではなく、ファイルの
  ルールに入れ替わります
- 適用した内容は `chrome.storage.sync` に書かれるので、上のセクションの表示もその場で
  更新され、他の端末にも同期されます

ファイルの中身はこの形です。`features` に入っている機能だけが取り込みの対象になります。

```json
{
  "format": "nanatsudougu-settings",
  "version": 1,
  "exportedAt": "2026-08-04T03:10:00.000Z",
  "features": {
    "redirectRules": [
      { "id": "1", "from": "a.atlassian.net", "to": "b.atlassian.net", "enabled": true }
    ],
    "meetAutoJoin": { "enabled": true, "intervalMinutes": 15 },
    "reloadTimer": { "intervalSeconds": 60, "durationMinutes": 30 }
  }
}
```

ページ自動リロードで書き出されるのは、**次に開始するときの初期値**だけです。動いているタイマーは
そのブラウザのそのタブのものなので、ファイルには入りません。

`format` が違うファイル、壊れた JSON、この拡張より新しい `version` のファイルは、理由を表示して
読み込みません。手で編集したファイルは、通常の保存と同じ正規化（`sanitizeRules` /
`sanitizeMeetSettings` / `sanitizeReloadSettings`）を通してから適用されるので、欠けた項目は
既定値で埋まります。

改名前の `browser-tool` で書き出したファイル（`"format": "browser-tool-settings"`）も、
そのまま読み込めます。書き出すときは常に新しい `nanatsudougu-settings` になります。

## 公開用のビルド

Chrome Web Store には ZIP をアップロードします。`npm run package` が公開用のビルドと
ZIP の作成をまとめて行います。

```bash
npm run package    # release/nanatsudougu-<version>.zip を作る
```

1. バージョンを上げる（`package.json` と `public/manifest.json` の両方）。
   数字がずれていると `npm test` と `npm run package` の両方で落ちます
2. `npm run check && npm test` を通す
3. `npm run package` を実行する
4. [デベロッパーダッシュボード](https://chrome.google.com/webstore/devconsole)で対象の
   アイテムを開き、「パッケージ」から `release/` の ZIP をアップロードする
5. ストアの掲載情報（説明・スクリーンショット・プライバシーの項目）を埋めて審査に提出する。
   カテゴリと説明文の案は [`docs/store-listing.md`](docs/store-listing.md) にあります

デベロッパーモードは開発中に `dist/` をそのまま読み込むためのものなので、公開版の
インストールには必要ありません。ストアから入れた拡張は Chrome が自動で更新します。

### 開発用ビルドとの違い

`npm run build`（`--mode` なし）と `npm run build:release`（`--mode release`）の違いは
source map の有無だけです。どちらも同じ `dist/` に、同じ内容の minify 済みコードを出力します。

- **`npm run build`**: `dist/*.map` も出力します。`chrome://extensions` から読み込んで
  デバッグするときに元のソースを追えます
- **`npm run build:release`**: source map を出しません。map にはソース全体が inline で
  入るため、公開する ZIP からは外しています

`scripts/package.mjs` は ZIP を作る前に次を確認して、通らなければ何も作らずに終了します。
アップロードが弾かれてから気づくと手戻りが大きいものだけを見ています。

- `manifest.json` が ZIP の直下にある（Chrome Web Store はこの形しか受け付けません）
- `manifest.json` が参照しているファイル（`background.js` / `content/main.js` /
  `options.html`）がビルド結果に揃っている
- `manifest.json` と `package.json` のバージョンが一致している
- `.map` が残っていない（= 公開用ビルドで作られた `dist/` である）

`release/` は `.gitignore` に入れてあります。ZIP はコミットしません。

## 開発

[Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript です。

```bash
npm install
npm run build      # dist/ を生成（型チェック込み、source map あり）
npm run build:release  # 公開用に dist/ を生成（source map なし）
npm run package    # build:release + release/ に ZIP を作る
npm run dev        # ソースの変更を dist/ に反映し続ける
npm run check      # 静的チェック（format:check + lint + typecheck）
npm run format     # oxfmt（ファイルを整形して書き戻す）
npm run format:check  # oxfmt --check（整形済みかどうかだけ確認する）
npm run lint       # oxlint
npm run lint:fix   # oxlint --fix（自動修正できるものだけ直す）
npm run typecheck  # tsc --noEmit
npm test           # 一度だけ実行
npm run test:unit      # ユニットテスト（*.unit.test.ts）だけ
npm run test:scenario  # シナリオテスト（*.scenario.test.ts）だけ
npm run test:watch
npm run test:coverage  # カバレッジ付きで実行（coverage/ に HTML レポート）
```

### 静的チェック

- **[oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)**: 設定は `.oxfmtrc.json` です。ほぼ既定値のままで、
  文字列だけ既存のコードに合わせてシングルクォート（`singleQuote`）にしています。
  対象は `src` / `tests` の TS・TSX に加えて CSS・Markdown・JSON です
- **[oxlint](https://oxc.rs/docs/guide/usage/linter.html)**: 設定は `.oxlintrc.json` です。`correctness` / `suspicious` / `perf`
  をエラーとして扱い、TypeScript・React・import・unicorn・vitest のプラグインを有効にしています。
  スタイル寄りで誤検知の多い `pedantic` は入れていません。プロジェクトの構成と衝突する
  3 つのルールだけ個別に off にしています（理由は設定ファイルのコメントに書いてあります）
- **tsc**: `tsconfig.json`（`src` と `tests`）と `tsconfig.node.json`（ビルド設定ファイル）の
  2 つを `--noEmit` で通します。`npm run build` の先頭でも同じチェックが走ります

### CI

`.github/workflows/ci.yml` が push（`main`）と pull request で format → lint → typecheck → test → build を
実行します。Node のバージョンは [mise](https://mise.jdx.dev/) が `mise.toml` の指定
（現在は 24.15.0）を読んで揃えるので、CI とローカルで同じバージョンになります。

TDD で実装しています。テストは [Vitest](https://vitest.dev/)（DOM は jsdom）と
[Testing Library](https://testing-library.com/) を使用します。

テストは対象の実装と同じディレクトリに置きます（colocation）。`src/lib/redirect.ts`
のテストは `src/lib/redirect.unit.test.ts` です。実装を動かすときに対応するテストが
同じ場所にあるので、探す手間も、移動のときに置き去りにする心配もありません。

テストファイルは種類を名前で区別します。

- **ユニットテスト** `<対象>.unit.test.ts(x)`: モジュール 1 つ（純粋関数・
  ラッパ・単体のコンポーネント）を、依存を差し替えた状態で確かめます
- **シナリオテスト** `<対象>.scenario.test.ts(x)`: service worker の起動、
  content script の自動入室、設定画面の操作といった、複数のモジュールをまたぐ
  一連の流れを通します

`vitest.config.ts` の `include` はこの 2 つだけを拾うので、どちらでもない名前の
ファイルは実行されません。

`tests/` に残っているのは、対象が `src/` の外にあって隣に置けないものだけです。

- `tests/manifest.unit.test.ts` / `tests/build-config.unit.test.ts`: `public/manifest.json`
  とビルド設定そのもののテスト
- `tests/setup.ts` / `tests/fake-chrome.ts`: 全テスト共通のセットアップと
  `chrome` API のスタブ

カバレッジは `src/**` が対象です（型定義のみの `src/lib/types.ts` と、隣に置いた
テストファイル自身は除外）。行・関数カバレッジは 100%、残る未到達の分岐は呼び出し側で
防いでいる防御的なガード（`if (!rule)`、`textContent ?? ''` など）だけです。

```
public/manifest.json       そのまま dist/ にコピーされる
options.html               設定画面の HTML エントリ
vite.config.ts             設定画面 + service worker のビルド
vite.content.config.ts     content script のビルド（IIFE）
scripts/package.mjs        dist/ を公開用の ZIP にまとめる
src/                       実装と、その隣に置いたテスト
  background.ts            service worker: ルール → declarativeNetRequest 同期、リロードのアラーム
  background.scenario.test.ts
  entry-points.scenario.test.tsx  2 つのエントリが読み込めることの確認
  lib/
    types.ts               ルール・設定・スナップショットの型
    redirect.ts            リダイレクト解決 / DNR ルール生成（純粋関数）
    sync-storage.ts        chrome.storage.sync の薄いラッパ
    session-storage.ts     chrome.storage.session の薄いラッパ
    storage.ts             リダイレクトルールの読み書きと正規化
    dnr-sync.ts            動的ルールの入れ替え
    debounce.ts            保存のデバウンス
    format-time.ts         時刻とカウントダウンの表示フォーマット（純粋関数）
    active-tab.ts          設定画面が対象にするタブの取得
    reload-timer.ts        リロードの時刻計算と正規化（純粋関数）
    reload-jobs.ts         動いているタイマーの保存とアラームの出し入れ
    reload-settings.ts     リロードタイマーの初期値の読み書き
    meet-schedule.ts       入室時刻の計算（純粋関数）
    meet-join.ts           待機画面から「参加」ボタンを探す
    meet-auto-join.ts      自動入室の状態機械（タイマーと DOM を持たない）
    meet-page.ts           対象となる Meet の URL 判定
    meet-settings.ts       Meet 自動入室の設定の読み書き
    settings-transfer.ts   設定ファイルの組み立てと読み取り（純粋関数）
    *.unit.test.ts         上の各モジュールのユニットテスト
  content/
    main.ts                content script のエントリ
    meet-auto-join.ts      設定・URL 監視・パネル・状態機械の配線
    meet-panel.tsx         shadow root への React ルートの出し入れ
    MeetPanel.tsx          カウントダウン表示のコンポーネント
    meet-panel.unit.test.tsx
    meet-content.scenario.test.ts          自動入室の一連の流れ
    meet-content-defaults.scenario.test.ts 設定が空のときの既定動作
  options/
    main.tsx               設定画面のエントリ
    App.tsx                3 つのセクションを並べるだけ
    RedirectRulesSection.tsx  ルールの読み込み・保存
    RulesTable.tsx         ルールテーブル（表示のみ）
    MeetAutoJoinSection.tsx   Meet 自動入室の設定
    ReloadTimerSection.tsx    ページ自動リロードの開始と停止
    SettingsTransferSection.tsx  設定の書き出しと読み込み
    download.ts            生成したファイルをブラウザのダウンロードに渡す
    useStatus.ts           「保存しました」の表示と自動クリア
    options.css
    RulesTable.unit.test.tsx / download.unit.test.ts / useStatus.unit.test.ts
    options-page.scenario.test.tsx  設定画面の操作
    reload-timer.scenario.test.tsx  ページ自動リロードの開始から停止まで
tests/                     隣に置けないテストと共通のヘルパ
  manifest.unit.test.ts    public/manifest.json の内容
  build-config.unit.test.ts  vite の 2 つのビルド設定
  setup.ts                 各テスト後のクリーンアップ
  fake-chrome.ts           chrome 拡張 API のスタブ
```

### ビルドの構成

- **設定画面と service worker** (`vite.config.ts`): ES モジュールとして `dist/` に出力します。`manifest.json` が service worker のパスを名指しするため、`background.js` だけファイル名を固定しています
- **content script** (`vite.content.config.ts`): manifest v3 の content script は ES モジュールとして注入できないため、単一の IIFE として別に出力します。動的 `import()` も `web_accessible_resources` も不要になりました
- React は content script にも同梱されるので、Meet のページには 60 KB ほど（gzip）が追加で読み込まれます。パネルの UI をこれ以上増やさないなら、`MeetPanel.tsx` だけ素の DOM に戻す選択肢もあります
- `manifest.json` は `public/` にあり、Vite がそのまま `dist/` にコピーします。参照しているパスとビルド成果物の対応は `tests/manifest.unit.test.ts` で確認しています
- **モード**: 2 つの設定はどちらも `--mode release` のときだけ source map を落とします。それ以外の違いはないので、公開する ZIP の中身は普段デバッグしているものと同じです（`tests/build-config.unit.test.ts` で確認しています）
