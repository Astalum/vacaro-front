# vacaro-front

参加者が候補枠へ○・×で回答するのではなく、参加可能な開始・終了日時を自由に登録する日程調整サービス「vacaro」のフロントエンドです。

## 技術構成

- React 19
- React Router 8 Framework Mode
- TypeScript
- Vite
- Tailwind CSS / CSS

## 開発環境

先に `vacaro-back` を `http://localhost:8080` で起動します。

```bash
cd ../vacaro-back
docker compose up --build
```

### Dockerで起動する

WSL側へNode.jsをインストールしていない場合はこちらを使用します。

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose -f compose.dev.yaml up --build
```

ブラウザで `http://localhost:3000` を開きます。ソースコードの変更は自動的に反映されます。

### ローカルのNode.jsで起動する

Linux版Node.js 24が利用できる環境では、次のコマンドでも起動できます。

```bash
npm install
npm run dev
```

WSLから実行する場合は、Windows側のNode.jsではなくWSL内へインストールしたLinux版Node.jsを使用してください。`command -v node` が `/usr/bin`、`~/.nvm`などのLinuxパスを指している必要があります。

開発サーバーは `/api/*` をvacaro-backへプロキシするため、HttpOnlyセッションCookieを同一サイトとして利用できます。

### Googleログインを有効にする

Google Cloud ConsoleでOAuth 2.0クライアントを作成し、承認済みのリダイレクトURIへ次を登録します。

```text
http://localhost:8080/api/v1/auth/google/callback
http://localhost:8080/api/v1/integrations/google-calendar/callback
```

`vacaro-back`の`.env`へ`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_LOGIN_REDIRECT_URL`、`GOOGLE_CALENDAR_REDIRECT_URL`、`TOKEN_ENCRYPTION_KEY`を設定してください。フロントエンドはログイン開始、コールバック後の完了表示、ログアウト、カレンダー接続と空き時間プレビューに対応しています。

カレンダー連携では空き時間取得用の`calendar.freebusy`に加え、読み込み対象を選択するための`calendar.calendarlist.readonly`権限を使用します。権限追加前に接続済みだった場合は、`/account`からGoogleカレンダーを再接続してください。

バックエンドのURLを変更する場合：

```bash
cp .env.example .env
```

```env
VACARO_API_URL=http://localhost:8080
```

## コマンド

```bash
npm run dev
npm run typecheck
npm run build
npm run start
```

Docker開発環境を終了する場合：

```bash
docker compose -f compose.dev.yaml down
```

## ドキュメント

- [画面・ルーティング設計](docs/screen-and-routing-design.md)
- [API仕様](docs/api-design.md)
- [データベース設計](docs/database-design.md)

## 主要ルート

| URL | 用途 |
| --- | --- |
| `/account` | ユーザー情報・Googleカレンダー連携・取り込み対象の設定 |
| `/events/new` | イベント作成 |
| `/invitations/:inviteToken` | 招待確認・参加 |
| `/events/:eventId/availability` | 参加可能時間の回答 |
| `/events/:eventId/results` | 共通候補と回答状況 |
| `/events/:eventId/manage` | 主催者向け管理・日程確定 |
