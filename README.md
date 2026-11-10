# vacaro-front

参加可能な開始・終了日時を自由に登録する日程調整サービス「vacaro」のフロントエンドです。React 19、React Router 8 Framework Mode、TypeScript、Vite、Sass / Tailwind CSSを使用します。

## 開発環境

先に`vacaro-back`を`http://localhost:8081`で起動します。

```bash
cd ../vacaro-back
API_PORT=8081 PUBLIC_APP_URL=http://localhost:8080 docker compose up --build
```

フロントのディレクトリで、Linux版Node.js 24を使って起動します。

```bash
npm ci
npm run dev
```

ブラウザで`http://localhost:8080`を開きます。`/api/*`はバックエンドへプロキシされ、HttpOnlyセッションCookieを同一サイトで使用できます。WSLではWindows版ではなく、WSL内のLinux版Node.jsを使用してください。

Node.jsを直接インストールしない場合はDockerでも起動できます。

```bash
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose -f compose.dev.yaml up --build
```

終了時は`docker compose -f compose.dev.yaml down`を実行します。API接続先を変える場合は`.env.example`から`.env`を作成し、`VACARO_API_URL`を設定します。Docker内からの接続先は`DOCKER_VACARO_API_URL`で変更できます。Googleログインの設定は[アカウント](docs/account.md#googleの設定)を参照してください。

## ディレクトリと命名

```text
app/
  routes.ts                URLとルートモジュールの対応
  routes/                  ページ、loader / action（events・accountなどの機能単位）
  features/
    account/               アカウントのデータ型
    events/                回答計算、イベント入力検証、招待・再回答リンク、データ型
    calendars/             サービス選択、設定UI、取り込み対象・時間帯、データ型
  components/
    layout.tsx             ヘッダー・フッター・ページ枠
    ui/                    機能に依存しない入力部品・アイコン・表示部品
  lib/                     共通のAPI通信、日時・日付処理、メタ情報、汎用処理
  styles/                  共通スタイルと機能ごとの画面スタイル
test/                     routes・features・components・libはapp側の配置に対応
  browser/                 全ページ・操作・画面幅のWebKit検証
docs/                     アカウント・イベント・カレンダー・デプロイの4文書
deploy/                   本番用Compose・環境ファイル例・systemd設定
scripts/                  デプロイなどの実行スクリプト
```

- ファイル名は`kebab-case`、コンポーネント名は`PascalCase`、フックは`useXxx`に揃えます。`routes.ts`や`root.tsx`などフレームワークの規約名は維持します。
- `index.tsx`は機能ディレクトリの入口となるページに使います。実装を隠すだけの再エクスポート用ファイルは作らず、利用するモジュールから直接importします。
- 特定機能のUI・計算・保存処理・型は`features/<機能>/`、汎用UIは`components/ui/`、共通処理は`lib/`へ置きます。API通信のファイルへ機能固有の処理を追加しません。
- ページ固有のロジックと表示は同じTSX内で分離します。取得・更新はloader / action、状態・副作用・イベント処理は同じファイルの`useXxx`、状態を使わない計算は通常の関数、JSXは画面とセクションのコンポーネントにまとめます。
- そのページだけで使う部品やフックは同じファイルに置きます。複数ページで共有する、または独立した機能として責務がある場合にファイルを分けます。
- 旧URLの転送は`routes/account/calendar-redirect.ts`へまとめています。URLは`app/routes.ts`で明示し、ファイル移動で公開URLを変えません。
- スタイルは現在の機能別配置を維持し、`app/styles/app.scss`の読み込み順でカスケードを管理します。
- ドキュメントはこのREADMEを入口にし、機能の仕様・設定・検証を同じ文書にまとめます。修正ごとの経緯はGit履歴に残し、同内容のAPI・DB仕様のコピーや小さな作業記録を増やしません。

日付カレンダーはピッカーを開いたときに遅延読み込みします。回答画面は画面幅に合うレイアウトだけを描画し、回答状態は親のフックで保持します。重い集計は入力変更時に再計算し、結果の日付セルや参加者一覧は表示に必要な値だけを受け取ります。

## 検証とビルド

```bash
npm run typecheck
npm test
npm run build
npm run start
```

WebKitの表示・操作テストは次の手順で実行します。

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps webkit
pnpm test:layout
```

開発サーバーは自動起動し、APIはテストデータへ差し替えます。本番データは更新しません。初回は公開Google Fontsの取得に接続が必要で、取得済みフォントはOSの一時ディレクトリにキャッシュします。

全ページを320・375・390・430・667・768・1024・1440pxで検証し、680/681・720/721・900/901pxの境界幅も確認します。ログイン状態、長い文字列、カレンダーの各サービス、ピッカー、複数日入力、区間の選択・移動・削除を含みます。はみ出し・重なり・文字の見切れを計測し、意図したスクロール領域は区別します。LinuxのWebKitでの検証であり、Safari実機の確認とは別に扱います。

`LAYOUT_SCREENSHOTS=1 pnpm test:layout`で全ページのキャプチャを保存できます。レポートは`playwright-report/`、失敗時の画像・トレースは`test-results/`に出力します。どちらもGit管理対象外です。

## 機能・運用ドキュメント

- [アカウント・ログイン・ユーザー設定](docs/account.md)
- [イベント・招待・回答・集計](docs/events.md)
- [カレンダー連携（Google・iCloud・TimeTree）](docs/calendars.md)
- [本番デプロイと運用](docs/deployment.md)

GitHub Actionsは検証とGHCRへのイメージ発行を行います。VPSへの反映はデプロイ手順に従って行います。バックエンドのAPI・DBの詳細は各機能ドキュメントからバックエンド側の仕様を参照します。
