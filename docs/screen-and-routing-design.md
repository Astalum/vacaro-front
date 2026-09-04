# vacaro-front 画面・ルーティング設計

## 1. サービスの前提

vacaroは、主催者が候補枠を事前に列挙する日程調整サービスではない。

主催者は次の条件だけを設定する。

- 日程を調整する対象期間
- イベントに必要な時間
- 回答期限

参加者は対象期間内で、自分が参加できる開始・終了日時を自由に複数登録する。サーバーは全参加者の参加可能時間を重ね合わせ、必要時間を満たす共通候補日時を算出する。

```text
主催者が調整期間と必要時間を設定
  → 招待URLを共有
    → 参加者が空いている時間帯を自由に登録
      → サーバーが重なりを集計して共通候補を提示
        → 主催者が開催日時を確定
```

時間区間はAPI仕様と同じく、開始を含み終了を含まない `[start_at, end_at)` として扱う。

## 2. 利用フロー

### 主催者

1. イベント名、調整対象期間、必要時間、回答期限を入力する。
2. 発行された招待URLを参加者へ共有する。
3. 自分の参加可能時間も登録する。
4. 回答状況と、参加可能人数順に算出された共通候補を確認する。
5. 共通候補または任意の対象期間内の時間から開催日時を確定する。

### 参加者

1. 招待URLを開き、イベント内容を確認する。
2. 表示名を入力してイベントへ参加する。
3. 対象期間内で参加できる開始・終了日時を複数登録する。
4. 必要に応じてGoogleカレンダーから空き時間を取り込む。
5. 回答を送信し、共通候補と回答状況を確認する。

## 3. 画面一覧

| 区分 | 画面 | ルート | 主な役割 |
| --- | --- | --- | --- |
| 共通 | トップ | `/` | サービス説明、イベント作成への導線 |
| 共通 | アカウント設定 | `/account` | Googleログイン、ログアウト、カレンダー連携管理 |
| 主催者 | イベント作成 | `/events/new` | 調整対象期間と必要時間を設定 |
| 主催者 | 作成完了 | `/events/:eventId/created` | 招待URLを共有 |
| 共通 | イベント一覧 | `/events` | 自分が参加しているイベントを表示 |
| 招待 | 招待確認・参加 | `/invitations/:inviteToken` | イベント内容の確認と参加登録 |
| 参加者 | 参加可能時間入力 | `/events/:eventId/availability` | 自由な開始・終了日時を複数登録 |
| 参加者 | 集計結果 | `/events/:eventId/results` | 共通候補と全参加者の空き時間を確認 |
| 主催者 | イベント管理 | `/events/:eventId/manage` | 回答状況の確認と開催日時の確定 |
| 主催者 | イベント編集 | `/events/:eventId/edit` | イベント条件を変更 |
| 共通 | 確定結果 | `/events/:eventId/confirmed` | 確定した日時を確認 |
| 共通 | Not Found | `*` | 無効なURLや存在しないイベントを案内 |

## 4. 画面要件

### 4.1 イベント作成 `/events/new`

入力項目：

- イベント名（必須、1～200文字）
- 説明（任意、最大5,000文字）
- タイムゾーン（必須）
- 調整期間の開始日時 `window_start_at`（必須）
- 調整期間の終了日時 `window_end_at`（必須）
- イベントに必要な時間 `duration_minutes`（必須、5～1,440分）
- 回答期限 `response_deadline_at`（任意）

この画面では個別の候補日時を作成しない。作成成功後は `/events/:eventId/created` へ遷移する。

### 4.1.1 アカウント設定 `/account`

- 未認証ユーザーとゲストユーザーにGoogleログインを案内
- ゲストで作成・参加済みのイベントはGoogleログイン後のユーザーへ引き継ぐ
- Google認証済みユーザーの表示名とメールアドレスを表示
- Googleカレンダーの接続・再接続・解除
- セッションからのログアウト

Google OAuthの開始URLはAPIの`GET /api/v1/auth/google/start`を通常のブラウザ遷移で開く。成功後はトップの`?google_login=success`を検出して完了メッセージを表示する。Googleカレンダー接続完了時も`?google_calendar=connected`を検出する。

### 4.2 作成完了 `/events/:eventId/created`

- イベント概要
- 調整対象期間と必要時間
- APIから返された `invite_url` の表示とコピー
- 管理画面、参加可能時間入力画面への導線

生の招待トークンは作成時と再発行時だけ取得できるため、再読み込み時の扱いを別途考慮する。

### 4.3 招待確認・参加 `/invitations/:inviteToken`

- 認証不要で公開招待情報を取得
- イベント名、説明、調整対象期間、必要時間、回答期限を表示
- 未認証なら表示名を入力してゲストセッションを作成
- イベント参加処理
- 参加後は `/events/:eventId/availability` へ遷移

無効な招待トークンまたは取消済みイベントは404として扱う。

### 4.4 参加可能時間入力 `/events/:eventId/availability`

- イベントの調整対象期間と必要時間を表示
- 開始日時と終了日時を1組とする入力行を複数追加・削除
- 入力した時間帯を日別タイムラインでも可視化
- Googleカレンダーから空き時間をプレビューして取り込む導線
- 空配列を「参加可能時間なし」として送信できる操作
- 既存回答がある場合は編集として表示

バリデーション：

- 各区間が調整対象期間内であること
- `start_at < end_at` であること
- 区間同士が重複しないこと
- 最大100区間であること

隣接する区間はAPI側で統合される。送信は `PUT /api/v1/events/:eventId/my-availability` により全件置換する。

### 4.5 集計結果 `/events/:eventId/results`

- 必要時間を満たす共通候補を参加可能人数順に表示
- 各候補の開始・終了日時、参加可能人数、対象参加者を表示
- 未回答者を含む参加者全体の回答状況
- 日別タイムライン上で各参加者の参加可能時間を表示
- 自分の回答を編集する導線

候補は `GET /api/v1/events/:eventId/candidates` の結果を表示し、フロント側で独自再計算しない。

### 4.6 イベント管理 `/events/:eventId/manage`

- イベント条件と回答人数を表示
- 共通候補ランキングを表示
- 候補を選択して開催日時を確定
- 招待URLの再発行
- イベント編集、取消

確定する時間区間の長さは `duration_minutes` と一致し、調整対象期間内でなければならない。

### 4.7 イベント編集 `/events/:eventId/edit`

- イベント名、説明、タイムゾーン
- 調整対象期間
- 必要時間
- 回答期限

変更後の期間が登録済みの参加可能時間を除外する場合、APIは422を返すため、影響を説明するエラーを表示する。

### 4.8 確定結果 `/events/:eventId/confirmed`

- 確定した開始・終了日時
- イベント名と説明
- 参加者一覧
- Googleカレンダーへ追加する導線

## 5. ルーティング

APIの招待URLと認証境界に合わせ、公開招待と参加後のイベント画面を分離する。

```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("account", "routes/account.tsx"),
  route("events", "routes/events/index.tsx"),
  route("events/new", "routes/events/new.tsx"),
  route("events/:eventId/created", "routes/events/created.tsx"),
  route("events/:eventId/availability", "routes/events/availability.tsx"),
  route("events/:eventId/results", "routes/events/results.tsx"),
  route("events/:eventId/manage", "routes/events/manage.tsx"),
  route("events/:eventId/edit", "routes/events/edit.tsx"),
  route("events/:eventId/confirmed", "routes/events/confirmed.tsx"),
  route("invitations/:inviteToken", "routes/invitations/join.tsx"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
```

## 6. 画面とAPIの対応

| 画面 | 主なAPI |
| --- | --- |
| アカウント設定 | `GET /api/v1/me`、`GET /api/v1/auth/google/start`、`DELETE /api/v1/session`、Googleカレンダー連携API |
| イベント作成 | `POST /api/v1/events` |
| 作成完了 | 作成レスポンスの `invite_url` |
| 招待確認 | `GET /api/v1/invitations/:inviteToken` |
| イベント参加 | `POST /api/v1/guest-sessions`、`POST /api/v1/invitations/:inviteToken/participants` |
| 参加可能時間入力 | `GET` / `PUT /api/v1/events/:eventId/my-availability` |
| カレンダー取込 | `POST /api/v1/events/:eventId/google-calendar-availability/preview` |
| 集計結果 | `GET /api/v1/events/:eventId/availability`、`GET /api/v1/events/:eventId/candidates` |
| イベント管理 | 参加者・回答・候補API、`PUT /api/v1/events/:eventId/confirmation` |
| イベント編集 | `PATCH /api/v1/events/:eventId` |
| 確定結果 | `GET /api/v1/events/:eventId` |

## 7. MVPの実装範囲

1. イベント作成
2. 作成完了と招待URL共有
3. 招待確認・ゲスト参加
4. 参加可能時間の手動入力・編集
5. 共通候補と回答状況の表示
6. 主催者による日時確定

Google認証、Googleカレンダー連携、イベント一覧まで実装済み。別イベントからの回答コピーはMVP後でもよい。

## 8. イベント状態

API実装に合わせ、イベント状態は次の3つとする。

| 状態 | 説明 | 参加・回答・編集 |
| --- | --- | --- |
| `open` | 回答受付中 | 可能 |
| `confirmed` | 開催日時確定済み | 不可。確定結果を表示 |
| `cancelled` | 取消済み | 不可。中止案内を表示 |

`draft` と `closed` は現在のAPIには存在しない。回答期限超過時の入力可否は、APIの実装と合わせて判定する。

## 9. エラー・例外時の扱い

- セッションがない場合はゲストセッション作成またはログインへ誘導する。
- イベント未参加者がイベントIDの画面へアクセスした場合は404として扱う。
- `event_not_open` では回答受付が終了したことを案内する。
- 重複区間や期間外の入力は該当入力行の近くに表示する。
- 回答保存に失敗しても入力内容を保持し、再試行できるようにする。
- 確定済みイベントでは参加可能時間入力より確定結果を優先する。
