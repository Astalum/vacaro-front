# vacaro-front

参加者が候補枠へ○・×で回答するのではなく、参加可能な開始・終了日時を自由に登録する日程調整サービス「vacaro」のフロントエンドです。

## 技術構成

- React 19
- React Router 8 Framework Mode
- TypeScript
- Vite
- Tailwind CSS / CSS

## 開発環境

先に `vacaro-back` を `http://localhost:8081` で起動します。

```bash
cd ../vacaro-back
API_PORT=8081 PUBLIC_APP_URL=http://localhost:8080 docker compose up --build
```

### Dockerで起動する

WSL側へNode.jsをインストールしていない場合はこちらを使用します。

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose -f compose.dev.yaml up --build
```

ブラウザで `http://localhost:8080` を開きます。ソースコードの変更は自動的に反映されます。

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
http://localhost:8081/api/v1/auth/google/callback
http://localhost:8081/api/v1/integrations/google-calendar/callback
```

`vacaro-back`の`.env`へ`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`GOOGLE_LOGIN_REDIRECT_URL`、`GOOGLE_CALENDAR_REDIRECT_URL`、`TOKEN_ENCRYPTION_KEY`を設定してください。フロントエンドはログイン開始、コールバック後の完了表示、ログアウト、カレンダー接続、空き時間プレビュー、確定日時の自動登録に対応しています。

カレンダー連携では空き時間取得用の`calendar.freebusy`、読み込み対象を選択するための`calendar.calendarlist.readonly`、確定予定を書き込むための`calendar.events`権限を使用します。権限追加前に接続済みだった場合は、`/account`からGoogleカレンダーを再接続してください。

バックエンドのURLを変更する場合：

```bash
cp .env.example .env
```

```env
VACARO_API_URL=http://localhost:8081
```

Dockerから接続するAPIのURLだけを変更する場合は、`DOCKER_VACARO_API_URL`を
指定してください。

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

## 本番デプロイ

本番VPSではソースコードの取得、依存関係のインストール、型チェック、テスト、イメージのビルドを行いません。`main`へのpush時にGitHub Actionsがこれらを実行し、検証済みイメージをGHCRへ発行します。

VPSへ配置するのは、原則として次のファイルだけです。`compose.prod.yaml`は、フロントエンド、バックエンドAPI、DBマイグレーション、PostgreSQLをまとめて起動します。

- `deploy/compose.prod.yaml`（バックエンド等と統合する場合は、その本番Composeへ同じ`image:`設定を反映）
- `deploy/.env.production.example`を元に作成した`.env.production`
- 必要に応じて`deploy/vacaro-front.service`と`scripts/redeploy.sh`

`.env.production`のイメージは、各リポジトリのGitHub Actionsが発行した不変のコミットSHAタグへ固定します。

```env
VACARO_FRONT_IMAGE=ghcr.io/astalum/vacaro-front:sha-<40桁のcommit SHA>
VACARO_BACK_IMAGE=ghcr.io/astalum/vacaro-back:sha-<40桁のcommit SHA>
VACARO_MIGRATIONS_IMAGE=ghcr.io/astalum/vacaro-back:migrations-sha-<40桁のcommit SHA>
```

GHCRパッケージがprivateの場合のみ、VPSでread-onlyのPersonal Access Tokenを使って一度`docker login ghcr.io`を実行します。デプロイはVPS上で次の処理だけを行います。

```bash
DEPLOY_DIR=/opt/vacaro ./redeploy.sh
```

`redeploy.sh`はCompose設定の検証、`docker compose pull`、`docker compose up -d`、ヘルスチェックだけを実行します。新しい版へ更新するときは、`.env.production`のSHAタグを変更してから再実行します。これにより、VPSへGit、Node.js、npm、pnpm、TypeScript、コンパイラを置く必要はありません。

### VS Code Remote SSH

本番VPSは通常の開発ワークスペースとして開かない運用を推奨します。調査のために開く場合は、VS Codeの拡張機能ビューで`SSH: <VPS名> - Installed`を選び、TypeScript/JavaScript Language Features、ESLint、Prettier、Git関連など本番運用に不要な拡張をリモート側で`Disable (Workspace)`またはアンインストールします。ローカル側の拡張は無効化する必要はありません。

VPS上の`/opt/vacaro`にはCompose、環境ファイル、運用スクリプトだけを置き、アプリのソースディレクトリをRemote SSHで開かないようにします。秘密値を含む`.env.production`はGitへ追加せず、権限を`600`にしてください。

## ドキュメント

- [本番デプロイ手順](docs/production-deployment.md)
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
