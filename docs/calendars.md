# カレンダー連携

`/account#calendar-settings` で「使用しない」「Googleカレンダー」「iCloudカレンダー」「TimeTree（Google経由）」から1つを選び、保存する。同じサービス内の取り込み対象は引き続き複数選択できる。祝日カレンダーの除外も継続する。

サービスの選択は認証済みの `GET/PUT /api/v1/integrations/calendar-preference` でサーバーに保存する。取り込み対象のカレンダーと時間帯は従来どおりブラウザに保存する。

取り込み、手動書き出し、確定時の自動登録は選択済みサービスだけを使う。TimeTreeはGoogleの専用カレンダーを表示する方式で、書き出しだけを行う。選択されていないサービスへの接続・取り込み・書き出しリクエストは409 `calendar_provider_inactive` で拒否する。DBのユーザー単位ロックで選択変更と外部処理を直列化し、確定時の連携先は参加者ごとに1度だけ決める。

切り替えても既存の接続情報、専用カレンダーID、ブラウザの取り込み設定を保持する。以前書き出した予定も元のカレンダーに残る。再選択すれば既存の接続を利用できる。

バックエンドのマイグレーション `000017` が必要。既存の接続が1サービスだけならそれを選択済みとし、GoogleとiCloudの両方に接続済みの場合は「使用しない」にして再選択を求める。新規ユーザーは「使用しない」が初期値。

## 設定画面と旧URL

設定は`/account#calendar-settings`にまとめる。選択中のサービスだけを取得・表示し、接続状態を取得できなくてもプロフィール設定は表示する。TimeTreeの手順は`/account#timetree-guide`の開閉パネルで表示する。

旧`/calendars`、`/calendars/icloud`、`/calendars/timetree`、`/account/icloud`、`/account/timetree`は、OAuth結果などのクエリを保持したまま該当アンカーへ302転送する。未知のサービス名は404を返す。

## Google

### Google の「このアプリは確認されていません」という警告

Google ログインの基本プロフィール権限と、カレンダーの権限は審査の扱いが異なる。開発者のアカウントで動作していても、他の利用者での認可が保証されるわけではない。

本番の OAuth クライアントが属する Google Cloud プロジェクトの Google Auth Platform で、次を確認する。

- Branding: アプリ名、サポート先、ホーム `https://vacaro.astalum.dev/`、プライバシーポリシー `https://vacaro.astalum.dev/privacy`、利用規約 `https://vacaro.astalum.dev/terms`、認証済みドメインを設定する。
- Audience: 公開対象と公開ステータスを確認する。Testing では対象ユーザーの登録が必要で、カレンダー権限を含む更新トークンには原則 7 日の有効期限がある。
- Data Access: アプリが要求する次のスコープを登録し、必要なブランド・スコープの確認審査を申請する。公開ステータスを変更するだけでは、未確認アプリの警告は解除されない。
  - `https://www.googleapis.com/auth/calendar.events.freebusy`: アクセス可能なカレンダーの空き時間の確認。
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`: カレンダー一覧の取得。
  - `https://www.googleapis.com/auth/calendar.app.created`: 専用カレンダー「Vacaro」の作成と、その中の確定予定の登録・更新・削除。
- Google Calendar API が有効になっていることを確認する。
- OAuth クライアントに次のリダイレクト URI を正確に登録する。
  - `https://vacaro.astalum.dev/api/v1/auth/google/callback`
  - `https://vacaro.astalum.dev/api/v1/integrations/google-calendar/callback`

審査の完了・公開状態は環境変数や OAuth クライアント ID からは判定できない。Google Cloud Console の管理権限を持つ担当者による確認が必要。

Google Workspace の管理者によるアプリ制限は、上記の審査とは別に適用される。

### アカウントによって予定の取り込みが失敗する場合

初期の取り込み対象はメインカレンダーのみとする。Google Calendar の表示中フラグ `selected` では祝日・購読カレンダーも含まれるため、そのフラグだけで取り込み対象を増やさない。利用者が保存した選択のうち、Google標準の祝日カレンダー（IDが`#holiday@group.v.calendar.google.com`で終わるもの）は除外し、それ以外の選択を保持する。祝日は選択一覧にも表示せず、旧クライアントから送られた祝日のIDもAPI側で除外する。祝日だけが指定された場合は、未指定の場合と同様にメインカレンダーを使用する。表示名に「祝日」を含む通常のカレンダーは除外しない。

一覧取得に成功しても、予定の空き時間を取得する権限や、個別カレンダーへのアクセスが不足する場合がある。Google の同意画面では読み取り項目を許可する。予定の書き込み権限のみ省略した場合は、空き時間の取り込みを利用でき、自動登録には再接続が必要になる。

従来の `calendar.freebusy` は自分のカレンダーを対象とする。新規接続では、共有カレンダーも対象にできる `calendar.events.freebusy` を要求する。既存の接続は自動で書き換えず、必要な利用者が設定画面から再接続する。

| API エラーコード | 対応 |
| --- | --- |
| `calendar_reconnect_required` | トークンの期限切れ・取り消し。ユーザー設定から再接続する。 |
| `calendar_read_permission_required` | 読み取り権限が不足。再接続してカレンダー一覧・空き時間の読み取りを許可する。 |
| `calendar_unavailable` | 対象のいずれかで空き時間を取得できない。設定画面でメインカレンダーのみを選んで保存・再試行し、対象を絞る。祝日・購読カレンダーなどは FreeBusy を取得できない場合がある。 |
| `calendar_temporarily_unavailable` | Google 側の一時障害や利用制限。時間をおいて再試行する。 |
| `google_not_configured` | Google 連携設定や API の有効化を運営者が確認する。 |

取得できないカレンダーを無視して全時間を空き時間として返すことはしない。失敗時は入力中の回答を保持する。プレビューは回答や Google の予定を更新しない。

API ログの `Google Calendar request failed` は、処理 `operation` と固定値の `kind`、HTTP ステータスのみを記録する。トークン、Google のレスポンス本文、カレンダー ID・名称は記録しない。

### 公式資料

- [Calendar のスコープと未確認アプリ](https://developers.google.com/workspace/calendar/api/auth)
- [OAuth アプリの公開・確認状態](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [更新トークンの有効期限](https://developers.google.com/identity/protocols/oauth2#expiration)
- [権限の一部だけが許可された場合](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions)
- [FreeBusy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)

### 確定予定の書き込み先

確定予定は利用者ごとに作成するセカンダリカレンダー「Vacaro」へ登録する。メインカレンダーへの書き込みは行わない。`calendar.events` / `calendar.events.owned` は要求せず、`calendar.app.created` を使用する。Google Auth Platform のデータアクセスにも同じ変更を登録する。ログイン用の `openid`、`https://www.googleapis.com/auth/userinfo.email`、`https://www.googleapis.com/auth/userinfo.profile` と読み取り用の2スコープは引き続き登録する。

既存の接続は、読み取り機能を継続できるが、専用カレンダーの管理許可を得るまで書き込みを行わない。設定画面から再接続する。過去の広い権限を認可リクエストにまとめないよう、`include_granted_scopes=true` は送らない。Google 側に以前の許可が残っていること自体は、自動で取り消さない。

バックエンドのマイグレーション `000015` が必要。専用カレンダーIDはトークンとは別に保存し、連携解除・再接続でも再利用する。同名の既存カレンダーを名前で採用しない。削除済みの専用カレンダーは、次回の再接続・予定登録時に再作成する。権限不足・一時障害では再作成せず失敗として扱う。カレンダー作成とDB保存は分散トランザクションではないため、Googleでの作成直後の通信断やDB障害では、未記録のカレンダーが残る可能性がある。

旧メインカレンダーへの同期記録は残すが、専用カレンダーへの登録済みとは表示しない。既存のGoogle側の予定は自動移動・削除せず、必要な場合はユーザーが旧予定を整理し、確定画面から専用カレンダーへ登録する。

#### `calendar.app.created` の申請説明例

Vacaroは複数人の日程調整を行うアプリです。利用者の許可に基づき、利用者のGoogleアカウント内に専用カレンダー「Vacaro」を作成し、アプリ内で確定した予定を登録します。日時の変更時には該当する予定を更新し、確定解除時には削除します。読み取り専用や空き時間参照の権限では、専用カレンダーの作成と予定の登録・更新・削除を行えません。書き込み先はアプリが作成したカレンダーに限定できるため、calendar.eventsではなくcalendar.app.createdを使用します。

## iCloud

### 利用方法

1. iPhoneの標準カレンダーで、対象の予定がiCloudに保存されていることを確認する。
2. [Apple Account](https://account.apple.com/)の「サインインとセキュリティ」→「アプリ用パスワード」でVacaro用のパスワードを作る。Apple Accountの2ファクタ認証が必要。
3. Vacaroの「ユーザー設定」の「カレンダー設定」でiCloudを選択して保存した後、同じページの接続フォーム（`/account#calendar-settings`）で、Apple Accountのメールアドレスとアプリ用パスワードを入力する。通常のApple Accountパスワードは入力しない。
4. 取り込みに使うカレンダーを選び、保存する。初期値は最初の通常カレンダー。購読カレンダー・リマインダー用のコレクションは表示しない。専用「Vacaro」も取り込み対象として選択できる。
5. 回答画面の「iCloudから取込」で空き時間をプレビューし、回答を保存する。選択中のサービスの取り込みボタンだけを表示する。取り込みは現在の回答入力を置き換え、GoogleとiCloudの空き時間の自動合成は行わない。

接続時にiCloud内へ専用カレンダー「Vacaro」を作成する。全体予定・自分が所属するグループの確定予定を自動登録し、確定解除・イベント取り消し時に該当する予定を削除する。確定画面から登録を再試行できる。iPhoneの標準カレンダーでiCloud同期が有効なら、このカレンダーも表示できる。iPhoneへの反映速度はApple側・端末側の同期に依存する。

接続解除時はVacaroに保存した認証情報を削除する。iCloud上のカレンダー・予定は残す。Apple側のアプリ用パスワードはApple Accountで取り消す。通常のApple Accountパスワードを変更すると、アプリ用パスワードが取り消される場合があるため再接続する。

### 運用と実装

バックエンドのマイグレーション`000016`を先に適用する。Google連携用の環境変数・OAuth設定の追加変更は不要。認証情報は`SESSION_KEY`から用途を分けて導出した鍵で暗号化するため、SESSION_KEYを変更するとiCloudの再接続が必要となる。暗号化したApple Accountとアプリ用パスワード、home URLは`icloud_calendar_connections`へ保存し、平文のパスワードはAPI・ログ・URLへ返さない。

CalDAVのdiscoveryでホームを解決し、ユーザーIDから決まる専用コレクションパスを使う。名前だけが同じ他のカレンダーは採用しない。再接続しても同じパスを使う。専用カレンダーを再作成した場合は、旧同期記録を登録済みとして表示しない。

取り込みは期間指定のcalendar-queryとexpandを使用し、繰り返しと例外をiCloud側で展開する。キャンセル済み・TRANSPARENTの予定は除外し、終日予定・浮動時刻にはカレンダーのタイムゾーンを使用する。日時は内部・APIではUTCで扱う。取得失敗、不正な日時、未展開の繰り返しを検出した場合はプレビューを失敗させ、全時間を空き時間とは扱わない。読み取った予定の本文は保存しない。

書き込みはVacaro専用コレクションの固定UIDの予定だけを扱い、新規作成にIf-None-Match、更新・削除にETagとIf-Matchを使用する。既存の別UID、参加者・主催者付きの予定は上書きしない。外部へ招待メールを送るための参加者・主催者情報は作成しない。接続先はHTTPSの`caldav.icloud.com`および`p数字-caldav.icloud.com`、標準443番ポートだけに限定する。レスポンス内のURL・リダイレクト先も検証する。

GoogleとiCloudの接続・同期結果は別々に保持する。ゲストが既存のGoogleアカウントへログインして統合される場合、統合先にiCloud接続がなければゲスト側の接続も引き継ぐ。

このWebアプリから「このiPhone内」のローカル予定を直接読み取る機能はない。接続対象はユーザーが指定したiCloudアカウント。

### 公式資料

- [Apple: アプリ用パスワード](https://support.apple.com/en-us/102654)
- [Apple: 他社製アプリによるiCloudへのアクセス](https://support.apple.com/en-ca/121539)
- [CalDAV RFC 4791](https://www.rfc-editor.org/rfc/rfc4791)
- [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)

## TimeTree

表示手順はユーザー設定 `/account#timetree-guide` 内に表示する。カレンダー連携の設定と同じページで確認できる。

### 対応範囲

現在のサービス選択「TimeTree（Google経由）」はGoogleの専用カレンダーへの書き出しを使う。iCloudの予定も端末側からTimeTreeに表示できるが、VacaroでiCloudを選ぶ場合はiCloud連携として扱う。

`Vacaro → Googleの専用カレンダー「Vacaro」→ 端末の標準カレンダー → TimeTree`

TimeTree用の認証情報やAPI接続は追加しない。バックエンド変更・マイグレーション・追加のOAuthスコープは不要。Googleは既存の読み取り権限と `calendar.app.created` を引き続き要求する。「書き出しのみ」はTimeTree対応の範囲であり、Googleの認可方式を変更するものではない。

- Googleでログインして連携を接続する。ゲストはGoogleログインでイベントを引き継げる。iCloudはゲストでも接続可能。
- 接続後に確定した予定は専用カレンダーに自動登録される。以前に確定した予定は各確定画面から登録する。
- 端末の標準カレンダーで「Vacaro」が同期されていることを確認する。
- iPhoneでGoogleを使う場合はGoogleカレンダー同期設定でも「Vacaro」を有効にする。TimeTreeにカレンダーへのフルアクセスを許可する。
- AndroidはGoogleカレンダーのデータを他のアプリと共有する設定も確認する。
- TimeTreeのホームカレンダーの表示フィルターで「Vacaro」を選ぶ。

ホームカレンダーでの表示は個人用で、Google・iCloudの変更は端末の同期後に表示される。反映時間の即時性は保証しない。

TimeTreeの共有カレンダーへ共有する場合は、TimeTree側で外部カレンダーの予定を手動インポートする。共有先は自動更新されない。変更・削除はTimeTree側で整理が必要で、再インポートは重複を起こすことがある。Web版は外部カレンダーに対応しない。

### 取り込みの制限

TimeTree内の予定をGoogleへ自動同期・エクスポートする機能は公式には提供されていない。TimeTree内だけにある予定をVacaroが自動取得するとは案内しない。Google・iCloudにも保存した予定を取り込みたい場合は、Vacaroの連携サービスをGoogleまたはiCloudへ切り替える。TimeTreeを選択中は取り込まない。

### 公式資料（2026年11月9日確認）

- [外部カレンダーの利用と制限](https://support.timetreeapp.com/hc/ja/articles/360000629341)
- [共有カレンダーへの手動インポート](https://support.timetreeapp.com/hc/ja/articles/360000639742)
- [Googleカレンダー同期設定](https://calendar.google.com/calendar/syncselect)
- [TimeTree API終了のお知らせ](https://timetreeapp.com/intl/ja/newsroom/2023-12-14/connect-app-api-202312)

## 実装・API・検証

- 設定UI、データ取得、フォーム処理、サービス選択、取り込み設定の保存は`app/features/calendars/`にまとめる。UIとその状態管理は同じファイルに置く。
- `/api/v1/integrations/calendar-preference`でサービス選択を取得・更新し、Googleは`/integrations/google-calendar`、iCloudは`/integrations/icloud-calendar`配下で接続・一覧・解除を行う。
- 回答プレビューは`POST /events/:eventId/{google,icloud}-calendar-availability/preview`、手動の確定予定登録は`/events/:eventId/{google,icloud}-confirmation-calendar`を利用する（いずれもAPIのベースパスは`/api/v1`）。
- テストは`test/features/calendars/`、`test/routes/account/icloud-action.test.ts`、`test/routes/events/confirmed.test.tsx`、`test/browser/`。サービスの排他利用、祝日除外、認証情報をレスポンスへ返さないこと、取り込みと書き出しを確認する。
