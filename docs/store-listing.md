# Chrome Web Store 掲載情報（案）

[公開用のビルド](../README.md#公開用のビルド)の手順 5「ストアの掲載情報を埋めて審査に提出する」で
そのまま貼れるように、デベロッパーダッシュボードの入力欄ごとに文面をまとめたものです。

## カテゴリ

|          | カテゴリ                                  | 理由                                                                                                                                                                                                                                 |
| -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **推奨** | ワークフローと計画（Workflow & Planning） | どの機能も「仕事中のブラウザ作業から手数を減らす」もので、チケット管理（Jira）と会議（Meet）という業務の動線そのものに乗っています。同カテゴリには会議・タスク・社内ツール系の拡張が集まっていて、想定ユーザーの探し方に一番近いです |
| 次点     | ツール（Tools）                           | リダイレクトの設定という汎用ユーティリティ寄りの見方をする場合。ただし競合が多く、埋もれやすいカテゴリです                                                                                                                           |
| 選ばない | デベロッパーツール（Developer Tools）     | Jira を扱うので開発者向けに見えますが、このカテゴリは DevTools 拡張や Web 開発を助けるものが対象です。実装が TypeScript というだけでここには入りません                                                                               |

言語は「日本語」、対象地域は日本を想定した文面にしています。

## 名前（最大 75 文字）

```
Nanatsudougu（七つ道具）
```

`manifest.json` の `name` は `Nanatsudougu` です。ストア上でどんな拡張か伝わるよう、
掲載名だけ日本語の読みを添えています（掲載名は manifest と一致していなくても構いません）。

## 概要 / 短い説明（最大 132 文字）

推奨案（70 文字）:

```
廃止された Jira ドメインへのアクセスをパスごと移行先へ転送し、Google Meet の待機画面から開始時刻ちょうどに自動入室します。
```

代替案（機能名を前に出して検索に当てにいく形、76 文字）:

```
Jira ドメインの自動リダイレクトと Google Meet の自動入室。旧ドメインのリンクはパスを保ったまま転送し、会議は次の開始時刻に入室します。
```

- ここを空にすると `manifest.json` の `description` がそのまま概要として使われます。上の案を採用するなら
  文面がずれないように `manifest.json` の `description` も同じ文にそろえてください
- 検索インデックスの対象なので、「Jira」「atlassian」「Google Meet」「リダイレクト」「自動入室」は
  概要のどこかに入れています

## 詳細説明（最大 16,000 文字）

```
仕事中のブラウザで何度も繰り返している小さな手作業を、拡張機能に肩代わりさせます。
道具は今のところ 3 つ。どれも既定では何もせず、あなたが設定した内容にだけ反応します。

■ Jira ドメインリダイレクト

移行や統合で使われなくなった Atlassian (atlassian.net) のドメインを開いたときに、
新しいドメインへ自動で切り替えます。

  https://a.atlassian.net/browse/XAPP-134
    ↓
  https://b.atlassian.net/browse/XAPP-134

・置き換わるのはホスト名だけです。パス・クエリ文字列・ハッシュはそのまま引き継ぐので、
  古いブックマークや、過去のチケット・Slack に残ったリンクをそのまま開けます
・リクエストが送信される前にブラウザ側で切り替わるため、廃止されたドメインへ実際に
  アクセスすることはありません
・移行元と移行先の組はいくつでも登録でき、1 行ずつ有効・無効を切り替えられます

■ Google Meet 自動入室

会議の待機画面を開いておくと、次の開始時刻になった時点で「参加」ボタンを押します。

  10:07 に待機画面を開く → 10:15 に自動で入室

・既定は OFF です。勝手に会議へ入るのは驚きが大きいので、明示的に有効にしたときだけ動きます
・開始時刻の間隔は 5 / 10 / 15 / 30 / 60 分から選べます（既定は 15 分 = :00 :15 :30 :45）
・待機画面の左下に「10:15 に自動で参加します」とカウントダウンが表示され、キャンセルボタンで
  その場で取りやめられます
・時刻だけずらしたいときは「+1 分」「-1 分」ボタンで入室時刻を 1 分ずつ前後に動かせます
・「まだ参加できないようです。このまま待機を続けますか？」と聞かれたときは、自動で「待機」を
  押します。放っておくと待機列から外されてしまうためです
・カメラとマイクの状態は、あなたが待機画面で設定したものがそのまま使われます。
  拡張機能側では変更しません

■ ページ自動リロード

開いたまま更新を待つページを、決めた間隔で決めた時間だけリロードし続けます。

  5 分ごとに 1 時間 → 1 時間たったら自動で止まります

・ツールバーのアイコンから拡張機能を開くと、そのとき見ていたタブが対象になります
・リロード間隔は 5 分 / 10 分 / 30 分、続ける時間は 1 時間から 8 時間まで選べます
・決めた時間がたてば自分で止まります。止め忘れて何時間もリロードし続けることはありません
・設定画面を閉じてもタイマーは動き続けます。開き直せば残り時間が表示され、そこから
  「停止」で止められます。タブを閉じたときも止まります

■ 設定の持ち運び

設定は Chrome アカウントで同期されるので、同じアカウントでログインした端末には自動で反映されます。
JSON ファイルへの書き出しと読み込みもでき、書き出す機能・取り込む機能はそれぞれ選べます。
取り込みは選んだ機能だけを置き換えるので、片方の設定だけを別の端末へ渡せます。

■ 収集しないもの

閲覧履歴、入力内容、会議の音声や映像、個人を識別できる情報は、収集も送信もしません。
設定は Chrome の同期ストレージに保存されるだけで、外部のサーバーへ送られるものはありません。
広告も解析ツールも入っていません。

■ 必要な権限

・declarativeNetRequest — 登録したドメインのリダイレクトに使います
・storage — 設定の保存に使います
・alarms — ページ自動リロードの次のリロード時刻を知らせるためのものです
・activeTab — ページ自動リロードの対象として、ツールバーのアイコンを押したタブだけを
  扱うためのものです
・*://*.atlassian.net/* — リダイレクトの対象を atlassian.net に限定するためのものです
・meet.google.com — 待機画面へカウントダウンを表示し、「参加」ボタンと、待機を続けるか尋ねる
  ダイアログの「待機」ボタンをクリックするためのものです

ソースコードは GitHub で公開しています。
https://github.com/wilf312/browser-tool
```

- 末尾の GitHub リンクはリポジトリを public にしている場合だけ残してください。private のままなら
  この 2 行を削ります
- ストアの詳細説明は Markdown も HTML も解釈されません。上の `■` と `・` はプレーンテキストで
  見出しと箇条書きに見せるためのものなので、記号ごとそのまま貼ります

## 英語（en）の掲載情報

`public/_locales/en/messages.json` を追加したので、ダッシュボードの言語「英語」にも同じ内容を
登録します。カテゴリと「プライバシーへの取り組み」タブは全言語共通なので、日本語のままで構いません。

### 名前（最大 75 文字）

```
Nanatsudougu
```

### 概要 / 短い説明（最大 132 文字）

```
Redirects retired Jira domains with their paths intact and joins Google Meet automatically right at the start time.
```

### 詳細説明（最大 16,000 文字）

```
Takes over the small, repeated browser chores of your workday. There are three tools so far.
None of them does anything by default — each one reacts only to the setup you give it.

■ Jira domain redirect

When you open an Atlassian (atlassian.net) domain that a migration or consolidation has retired,
it switches you to the new domain automatically.

  https://a.atlassian.net/browse/XAPP-134
    ↓
  https://b.atlassian.net/browse/XAPP-134

・Only the host name is replaced. The path, query string and hash carry over as they are, so old
  bookmarks and links left in tickets or Slack still open
・The switch happens in the browser before the request is sent, so the retired domain is never
  actually reached
・You can register as many source/destination pairs as you like, and turn each row on or off

■ Google Meet auto join

Keep a meeting's waiting screen open and the Join button is pressed the moment the next start
time comes around.

  Open the waiting screen at 10:07 → join automatically at 10:15

・Off by default. Joining a meeting on your behalf is a big surprise, so it only runs when you
  turn it on
・The start interval can be 5 / 10 / 15 / 30 / 60 minutes (default 15 minutes = :00 :15 :30 :45)
・The bottom-left of the waiting screen shows "Joining automatically at 10:15" with a countdown,
  and you can call it off right there with Cancel
・To shift only the timing, the "+1 min" and "-1 min" buttons move the join time one minute later
  or earlier
・When Meet asks "You haven't left the call yet — do you want to keep waiting?", the extension
  presses Keep waiting for you. Left unanswered, the dialog drops you out of the lobby
・The camera and microphone state you set on the waiting screen is used as it is. The extension
  does not change it

■ Page auto reload

Keeps reloading a page you leave open waiting for updates, at the interval and for the duration
you set.

  Every 5 minutes for 1 hour → stops automatically after 1 hour

・Open the extension from the toolbar icon and the tab you were looking at becomes the target
・The reload interval can be 5 / 10 / 30 minutes, and the duration 1 to 8 hours
・It stops on its own once the duration is up — no leaving it reloading for hours by mistake
・The timer keeps running after you close the settings screen. Open it again to see the time left
  and press Stop from there. Closing the tab also stops it

■ Carrying your settings

Settings sync through your Chrome account, so they reach every device you sign in to with the
same account. You can also export them to a JSON file and read them back, picking which features
to write and which to read. An import replaces only the features you choose, so you can hand just
one feature's settings to another device.

■ What is not collected

Browsing history, what you type, meeting audio or video, and personally identifiable information
are neither collected nor sent. Settings are only stored in Chrome's synced storage; nothing goes
to an external server. There are no ads and no analytics.

■ Permissions

・declarativeNetRequest — used to redirect the domains you register
・storage — used to save your settings
・alarms — used to know when the next auto reload is due
・activeTab — used so auto reload only ever touches the tab you pressed the toolbar icon on
・*://*.atlassian.net/* — used to limit redirects to atlassian.net domains
・meet.google.com — used to show the countdown on the waiting screen and to click the Join button
  and the Keep waiting button in the dialog that asks whether to keep waiting

The source code is on GitHub.
https://github.com/wilf312/browser-tool
```

## スペイン語（es）の掲載情報

`public/_locales/es/messages.json` を追加したので、ダッシュボードの言語「スペイン語」にも
同じ内容を登録します。カテゴリと「プライバシーへの取り組み」タブは全言語共通です。

### 名前（最大 75 文字）

```
Nanatsudougu
```

### 概要 / 短い説明（最大 132 文字）

```
Redirige los dominios Jira retirados conservando la ruta y entra automáticamente en Google Meet justo a la hora de inicio.
```

### 詳細説明（最大 16,000 文字）

```
Se encarga de las pequeñas tareas repetitivas del navegador en tu jornada. De momento hay tres
herramientas. Ninguna hace nada por defecto: cada una reacciona solo a lo que configures.

■ Redirección de dominios Jira

Cuando abres un dominio de Atlassian (atlassian.net) que una migración o consolidación ha
retirado, te cambia automáticamente al dominio nuevo.

  https://a.atlassian.net/browse/XAPP-134
    ↓
  https://b.atlassian.net/browse/XAPP-134

・Solo se sustituye el nombre del host. La ruta, la cadena de consulta y el hash se conservan tal
  cual, así que los marcadores antiguos y los enlaces que quedaron en tickets o Slack siguen
  abriéndose
・El cambio ocurre en el navegador antes de enviar la petición, así que nunca se llega a acceder
  al dominio retirado
・Puedes registrar tantos pares origen/destino como quieras y activar o desactivar cada fila

■ Entrada automática en Google Meet

Si dejas abierta la pantalla de espera de una reunión, se pulsa el botón «Unirse» en cuanto llega
la próxima hora de inicio.

  Abrir la pantalla de espera a las 10:07 → entrar automáticamente a las 10:15

・Desactivado por defecto. Entrar en una reunión por ti es una sorpresa grande, así que solo
  funciona cuando lo activas
・El intervalo de inicio puede ser 5 / 10 / 15 / 30 / 60 minutos (por defecto 15 minutos =
  :00 :15 :30 :45)
・En la esquina inferior izquierda de la pantalla de espera se muestra «Te unirás automáticamente
  a las 10:15» con una cuenta atrás, y puedes cancelarlo ahí mismo con Cancelar
・Para cambiar solo el momento, los botones «+1 min» y «-1 min» mueven la hora de entrada un
  minuto después o antes
・Cuando Meet pregunta «Aún no has salido de la llamada, ¿quieres seguir esperando?», la extensión
  pulsa Seguir esperando por ti. Si se deja sin responder, el diálogo te saca de la sala de espera
・El estado de cámara y micrófono que hayas puesto en la pantalla de espera se usa tal cual. La
  extensión no lo cambia

■ Recarga automática de páginas

Sigue recargando una página que dejas abierta esperando novedades, con el intervalo y durante el
tiempo que definas.

  Cada 5 minutos durante 1 hora → se detiene automáticamente al cabo de 1 hora

・Abre la extensión desde el icono de la barra de herramientas y la pestaña que estabas viendo pasa
  a ser el objetivo
・El intervalo de recarga puede ser 5 / 10 / 30 minutos, y la duración de 1 a 8 horas
・Se detiene solo cuando se cumple la duración: no se queda recargando durante horas por olvido
・El temporizador sigue activo al cerrar la pantalla de ajustes. Vuelve a abrirla para ver el tiempo
  restante y pulsar Detener. Cerrar la pestaña también lo detiene

■ Llevar tus ajustes

Los ajustes se sincronizan con tu cuenta de Chrome, así que llegan a todos los dispositivos en los
que inicies sesión con la misma cuenta. También puedes exportarlos a un archivo JSON y volver a
cargarlos, eligiendo qué funciones escribir y cuáles leer. La importación solo sustituye las
funciones que elijas, así que puedes pasar los ajustes de una sola función a otro dispositivo.

■ Lo que no se recoge

El historial de navegación, lo que escribes, el audio o vídeo de las reuniones y la información
que permita identificarte no se recogen ni se envían. Los ajustes solo se guardan en el
almacenamiento sincronizado de Chrome; nada va a un servidor externo. No hay anuncios ni
herramientas de análisis.

■ Permisos

・declarativeNetRequest: se usa para redirigir los dominios que registras
・storage: se usa para guardar tus ajustes
・alarms: se usa para saber cuándo toca la siguiente recarga automática
・activeTab: se usa para que la recarga automática solo afecte a la pestaña en la que pulsaste el
  icono de la barra de herramientas
・*://*.atlassian.net/*: se usa para limitar las redirecciones a dominios atlassian.net
・meet.google.com: se usa para mostrar la cuenta atrás en la pantalla de espera y para pulsar el
  botón «Unirse» y el botón «Seguir esperando» del diálogo que pregunta si quieres seguir esperando

El código fuente está publicado en GitHub.
https://github.com/wilf312/browser-tool
```

## 中国語（zh_CN）の掲載情報

`public/_locales/zh_CN/messages.json` を追加したので、ダッシュボードの言語「中国語（簡体字）」にも
同じ内容を登録します。カテゴリと「プライバシーへの取り組み」タブは全言語共通です。

### 名前（最大 75 文字）

```
Nanatsudougu
```

### 概要 / 短い説明（最大 132 文字）

```
在保留路径的情况下重定向已停用的 Jira 域名，并在开始时间自动进入 Google Meet。
```

### 詳細説明（最大 16,000 文字）

```
替你处理日常工作中在浏览器里反复出现的细小手工作业。目前有三件工具，默认都不会做任何事，
只对你设置的内容作出反应。

■ Jira 域名重定向

当你打开一个因迁移或整合而停用的 Atlassian（atlassian.net）域名时，自动切换到新域名。

  https://a.atlassian.net/browse/XAPP-134
    ↓
  https://b.atlassian.net/browse/XAPP-134

・只替换主机名。路径、查询字符串和片段原样保留，所以旧的收藏夹、工单或 Slack 里留下的链接
  都能直接打开
・在请求发送之前就在浏览器端完成切换，因此不会真正访问已停用的域名
・可以登记任意多组来源与去向，并逐行启用或停用

■ Google Meet 自动入会

保持会议等待页面打开，到了下一个开始时间就会按下「加入」按钮。

  10:07 打开等待页面 → 10:15 自动入会

・默认关闭。擅自进入会议的影响很大，所以只有明确启用时才会工作
・开始时间间隔可选 5 / 10 / 15 / 30 / 60 分钟（默认 15 分钟 = :00 :15 :30 :45）
・等待页面左下角会显示「将在 10:15 自动加入」和倒计时，可以当场用取消按钮中止
・只想调整时间时，可用「+1 分钟」「-1 分钟」按钮把入会时间前后移动 1 分钟
・当 Meet 询问「你还没有退出通话，是否继续等待？」时，扩展会自动按下「继续等待」。如果放着
  不管，就会被移出等待队列
・摄像头和麦克风沿用你在等待页面设置的状态，扩展不会更改

■ 页面自动重新加载

对一直开着等待更新的页面，按设定的间隔持续重新加载设定的时长。

  每 5 分钟一次，持续 1 小时 → 满 1 小时后自动停止

・从工具栏图标打开扩展，当时正在查看的标签页会成为目标
・重新加载间隔可选 5 / 10 / 30 分钟，持续时间可选 1 到 8 小时
・到设定时长会自行停止，不会忘记停止而连续重新加载好几个小时
・关闭设置页面后计时器仍会继续运行。重新打开即可看到剩余时间，并从那里按「停止」。关闭标签页
  也会停止

■ 设置的携带

设置会通过 Chrome 账号同步，因此用同一账号登录的设备会自动生效。也可以导出为 JSON 文件并
重新导入，导出和导入都能按功能选择。导入只替换所选的功能，因此可以把某一项功能的设置单独
带到另一台设备。

■ 不收集的内容

浏览记录、输入内容、会议的音视频以及可识别个人身份的信息，都不收集也不发送。设置只保存在
Chrome 的同步存储中，不会发送到任何外部服务器。没有广告，也没有分析工具。

■ 所需权限

・declarativeNetRequest — 用于重定向你登记的域名
・storage — 用于保存设置
・alarms — 用于得知下一次自动重新加载的时间
・activeTab — 用于让自动重新加载只作用于你按下工具栏图标的那个标签页
・*://*.atlassian.net/* — 用于把重定向对象限定为 atlassian.net 域名
・meet.google.com — 用于在等待页面显示倒计时，以及点击「加入」按钮和询问是否继续等待的
  对话框中的「继续等待」按钮

源代码在 GitHub 上公开。
https://github.com/wilf312/browser-tool
```

## 「プライバシーへの取り組み」タブ

ここが埋まっていないと、掲載情報を書いても公開できません。ダッシュボードが出す
エラーの並びに合わせて、上から順に貼れるようにしてあります。

### 単一用途（single purpose）の説明

Chrome Web Store は「拡張機能の目的は 1 つに絞られていること」を求めます。Jira と Meet という
別々のサービスを触るため、ここは審査でつつかれやすい箇所です。機能の一覧ではなく、
1 つの目的として言い切る形で書きます。

```
業務で使う Web ツールを開くときの定型操作を自動化し、手作業を減らすことが目的です。
廃止されたドメインへのアクセスを現行のドメインへ転送すること、会議の待機画面で開始時刻に
参加ボタンを押すこと、更新を待つページを一定時間リロードし続けることは、いずれもユーザーが
手で行っている同じ操作の置き換えです。
```

差し戻された場合の逃げ道は、Meet 自動入室を別アイテムとして分けて出すことです。コードは
`src/lib/meet-*` と `src/content/` にまとまっていて、manifest から content script の項目を
落とせば Jira リダイレクト単体のビルドになります。

### 権限の正当性

権限ごとに欄が分かれています。`manifest.json` が要求しているのは次の 6 つで、それ以外の欄は出ません。

**`declarativeNetRequest` の理由**

```
ユーザーが設定画面で登録した移行元ドメインへのアクセスを、移行先ドメインへリダイレクトするために使用します。ルールはユーザーが入力したドメインの組からのみ生成し、リクエストの内容を読み取ることはありません。リダイレクトで置き換えるのはホスト名だけで、パス・クエリ文字列・ハッシュはそのまま引き継ぎます。
```

**`storage` の理由**

```
リダイレクトのルール、Google Meet 自動入室の設定、ページ自動リロードの間隔と時間を保存し、ユーザーの Chrome アカウントで端末間に同期するために使用します。動作中のリロードタイマーは同期されないセッションストレージに保存し、ブラウザを終了すると消えます。保存するのはユーザーが設定画面で入力・選択した値だけです。
```

**`alarms` の理由**

```
ページ自動リロードで、ユーザーが指定した間隔（5 分・10 分・30 分）ごとにタブを再読み込みするタイミングを知るために使用します。Manifest V3 の service worker は処理の合間に停止されるため、次の再読み込み時刻に起動し直す手段としてアラームが必要です。アラームはユーザーがタイマーを開始したタブごとに 1 つだけ作成し、指定した時間が過ぎるか、タブが閉じられるか、ユーザーが停止したときに削除します。
```

**`activeTab` の理由**

```
ページ自動リロードの対象タブを設定画面に表示するために使用します。ユーザーがツールバーのアイコンを押した時点のタブに限って URL とタイトルを読み取り、「このタブをリロードします」と示すためだけのものです。読み取った URL は画面に表示するだけで、保存も送信もしません。すべてのサイトを読み取る権限（tabs）は要求していません。
```

**ホスト権限（`*://*.atlassian.net/*`）の理由**

```
リダイレクトの対象を atlassian.net のドメインに限定するために指定しています。この拡張機能の目的は廃止された atlassian.net のドメインを現行のドメインへ転送することなので、それ以外のホストへの権限は要求していません。ページの内容の読み取りや送信は行いません。
```

**コンテンツ スクリプト（`https://meet.google.com/*`）の理由**

会議ページの権限について別途聞かれた場合はこちらを使います。ホスト権限の欄が 1 つしかない
場合は、上のホスト権限の文面の末尾にこの内容を続けてください。

```
Google Meet の待機画面に、自動入室までのカウントダウンとキャンセルボタンを表示し、ユーザーが設定した開始時刻になったときに参加ボタンをクリックするために使用します。入室をリクエストしたあとに Meet が表示する「このまま待機を続けますか？」のダイアログでは「待機」ボタンをクリックし、待機を継続します。対象は会議コードを含む URL の待機画面だけで、ページの内容を読み取って外部へ送信することはありません。
```

### リモートコードの使用

**「いいえ、リモートコードは使用していません」** を選びます。理由の欄には次を貼ります。

```
実行するコードはすべて拡張機能のパッケージに同梱しています。外部から取得したスクリプトの読み込みや、eval() などによる文字列の実行は行いません。使用しているライブラリ（React）はビルド時にバンドルされ、パッケージ内のファイルとして配布されます。
```

この拡張機能は外部へのネットワーク通信を一切行いません（`src/` に `fetch` も `eval` も
リモートのスクリプトタグもありません）。設定の書き出しはブラウザ内で生成した JSON を
ダウンロードするだけ、読み込みはローカルファイルの読み取りだけです。

### データ使用に関する開示

記入欄ではなくチェックボックスです。**「データの使用が〜ポリシーに準拠していることを表明」の
エラーはここが未チェックのときに出ます。**

1. 「収集するユーザーデータ」は**すべてチェックを外す**。個人情報・健康情報・財務情報・
   認証情報・個人的な通信・位置情報・閲覧履歴・ユーザー行動・ウェブサイトのコンテンツ、
   どれも収集していません
2. その下の **「データ使用に関する認定」** の 3 つにすべてチェックを入れる。ここが表明の本体で、
   1 つでも空だと公開できません
   - 認定販売者以外の第三者にユーザーデータを販売していない
   - アイテムの単一用途と関係のない目的でユーザーデータを使用または転送していない
   - 信用力の判断や融資目的でユーザーデータを使用または転送していない
3. ページ右上の **[下書きを保存]** を押す。チェックしただけで保存しないとエラーは消えません

収集データが無いことと、ポリシー準拠の表明は別々の項目です。「何も収集していないのだから
表明も不要」とはならず、3 つのチェックは必ず必要です。

プライバシー ポリシーの URL は、収集するデータが無い場合でも入力を求められることがあります。
求められたらリポジトリに `PRIVACY.md` を置いてその URL を指定するのが手軽です。

### パブリッシャーの連絡先メールアドレス

これも文面ではなく操作です。**アイテムの編集画面ではなく、ダッシュボード全体の設定ページ**に
あるので見落としやすい項目です。

1. デベロッパー ダッシュボードの左メニューから **[設定]** を開く（アイテムの編集画面を閉じて、
   アイテム一覧の側にあるメニューです）
2. **[アカウント]** タブの「連絡先メールアドレス」に、ユーザーからの問い合わせを受け取る
   アドレスを入力して保存する
3. そのアドレスに Chrome Web Store から確認メールが届くので、本文のリンクを開く
4. 設定ページに戻り、アドレスの横が **確認済み** になっていることを確かめる

このメールアドレスはストアの掲載ページに公開されます。個人のアドレスを出したくない場合は、
問い合わせ用に別のアドレスを用意してから登録してください。確認が済むまで、掲載情報を
すべて埋めても審査には出せません。

### スクリーンショット（1280x800、最低 1 枚 / 最大 5 枚）

説明文の順番に合わせて 4 枚あれば足ります。

1. 設定画面の Jira ドメインリダイレクト（ルールが 2 〜 3 行入っている状態）
2. Meet の待機画面の左下に「10:15 に自動で参加します」のカウントダウンが出ている状態
3. ページ自動リロードが動いていて、残り時間と「停止」が見えている状態
4. 設定のインポート / エクスポート（機能ごとのチェックボックスが見えている状態）
