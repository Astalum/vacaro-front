# アカウント・ログイン・ユーザー設定

## ユーザーページ

`/account`にプロフィール、タイムゾーン、カレンダー設定をまとめる。未ログイン・ゲストにはGoogleログインを案内し、登録ユーザーには表示名とメールアドレスを表示する。カレンダー設定の取得に失敗してもプロフィールを表示する。

- プロフィールの取得・更新: `GET /api/v1/me`、`PATCH /api/v1/me`。
- Googleログイン: `GET /api/v1/auth/google/start`への通常のブラウザ遷移。
- Googleコールバック: `/api/v1/auth/google/callback`。
- ログアウト: `DELETE /api/v1/session`。
- ゲスト作成: `POST /api/v1/guest-sessions`。

Googleログイン時はゲストで作成・参加したイベントを引き継ぐ。イベント内の別名はプロフィールと別に保持する。[招待時の表示名](events.md#招待時の表示名)を参照。

## タイムゾーン

内部・API・DBの日時はUTCで管理する。入力・表示にはユーザーが保存したIANAタイムゾーンを使い、新規ユーザーの初期値は`Asia/Tokyo`とする。Googleログイン時にブラウザのタイムゾーンで上書きしない。変更はユーザーページから保存する。

日付や時刻の共通処理は`app/lib/datetime.ts`、`app/lib/date-input.ts`、`app/lib/time.ts`で管理する。[24:00の扱い](events.md#時刻入力と2400)はイベント・回答・カレンダー取り込みで共通とする。

## Googleの設定

Google CloudでWebアプリ用のOAuthクライアントを作成し、開発環境では次のリダイレクトURIを登録する。

```text
http://localhost:8080/api/v1/auth/google/callback
http://localhost:8080/api/v1/integrations/google-calendar/callback
```

バックエンドの環境ファイルへ`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_LOGIN_REDIRECT_URL`、`GOOGLE_CALENDAR_REDIRECT_URL`、`TOKEN_ENCRYPTION_KEY`を設定する。秘密値はフロントの環境変数や配信するJSへ含めない。

ログインの`openid`はGoogleアカウントの本人確認に使用し、メール・プロフィールのスコープは表示情報の取得に使用する。カレンダーの認可とは別に扱う。公開時のデータアクセス登録、カレンダースコープ、審査・再接続については[カレンダー連携](calendars.md)を参照。

## セッションとAPIの境界

フロントとAPIは同一サイトで利用し、通常セッションはHttpOnly Cookieで管理する。`app/lib/api.ts`は`credentials: "same-origin"`を指定し、更新リクエストへ`X-Vacaro-CSRF: same-origin`を付ける。OAuthはAPIへの通常遷移で開始する。

ゲストの再回答リンクは`/responses/edit#token`で受け取り、`POST /api/v1/response-sessions`で対象イベント専用の回答Cookieへ交換する。トークンをURLのクエリへ載せず、交換後はフラグメントを除去する。通常ログインや他イベントへのアクセス権限には昇格させない。

## 実装と検証

- ユーザーページの取得・更新・状態管理・JSX: `app/routes/account/index.tsx`。
- アカウントのデータ型: `app/features/account/types.ts`。
- カレンダー設定のUIと処理: `app/features/calendars/`。[連携仕様](calendars.md)を参照。
- 検証: `test/routes/account/`、`test/lib/datetime.test.ts`、`test/routes/responses/`、`test/lib/api-security.test.ts`、`test/browser/`。

バックエンドの詳細は[API仕様](https://github.com/Astalum/vacaro-back/blob/main/docs/api-design.md)、[OAuthの実装方針](https://github.com/Astalum/vacaro-back/blob/main/docs/oauth-security.md)、[DB設計](https://github.com/Astalum/vacaro-back/blob/main/docs/database-design.md)を参照する。
