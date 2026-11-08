# Google カレンダー連携の設定と障害調査

## Google の「このアプリは確認されていません」という警告

Google ログインの基本プロフィール権限と、カレンダーの権限は審査の扱いが異なる。開発者のアカウントで動作していても、他の利用者での認可が保証されるわけではない。

本番の OAuth クライアントが属する Google Cloud プロジェクトの Google Auth Platform で、次を確認する。

- Branding: アプリ名、サポート先、ホーム `https://vacaro.astalum.dev/`、プライバシーポリシー `https://vacaro.astalum.dev/privacy`、利用規約 `https://vacaro.astalum.dev/terms`、認証済みドメインを設定する。
- Audience: 公開対象と公開ステータスを確認する。Testing では対象ユーザーの登録が必要で、カレンダー権限を含む更新トークンには原則 7 日の有効期限がある。
- Data Access: アプリが要求する次のスコープを登録し、必要なブランド・スコープの確認審査を申請する。公開ステータスを変更するだけでは、未確認アプリの警告は解除されない。
  - `https://www.googleapis.com/auth/calendar.events.freebusy`: アクセス可能なカレンダーの空き時間の確認。
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`: カレンダー一覧の取得。
  - `https://www.googleapis.com/auth/calendar.events`: 確定した日時の登録・更新・削除。
- Google Calendar API が有効になっていることを確認する。
- OAuth クライアントに次のリダイレクト URI を正確に登録する。
  - `https://vacaro.astalum.dev/api/v1/auth/google/callback`
  - `https://vacaro.astalum.dev/api/v1/integrations/google-calendar/callback`

審査の完了・公開状態は環境変数や OAuth クライアント ID からは判定できない。Google Cloud Console の管理権限を持つ担当者による確認が必要。

Google Workspace の管理者によるアプリ制限は、上記の審査とは別に適用される。

## アカウントによって予定の取り込みが失敗する場合

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

## 公式資料

- [Calendar のスコープと未確認アプリ](https://developers.google.com/workspace/calendar/api/auth)
- [OAuth アプリの公開・確認状態](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [更新トークンの有効期限](https://developers.google.com/identity/protocols/oauth2#expiration)
- [権限の一部だけが許可された場合](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions)
- [FreeBusy API](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
