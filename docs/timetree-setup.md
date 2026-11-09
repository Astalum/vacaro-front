# TimeTreeで確定予定を表示する

表示手順はユーザー設定 `/account#timetree-guide` 内に表示する。カレンダー連携の設定と同じページで確認できる。

## 対応範囲

既存のGoogle・iCloud連携による確定予定の書き出しを使う。

`Vacaro → Google・iCloudの専用カレンダー「Vacaro」→ 端末の標準カレンダー → TimeTree`

TimeTree用の認証情報やAPI接続は追加しない。バックエンド変更・マイグレーション・追加のOAuthスコープは不要。Googleは既存の読み取り権限と `calendar.app.created` を引き続き要求する。「書き出しのみ」はTimeTree対応の範囲であり、Googleの認可方式を変更するものではない。

- Googleでログインして連携を接続する。ゲストはGoogleログインでイベントを引き継げる。iCloudはゲストでも接続可能。
- 接続後に確定した予定は専用カレンダーに自動登録される。以前に確定した予定は各確定画面から登録する。
- 端末の標準カレンダーで「Vacaro」が同期されていることを確認する。
- iPhoneでGoogleを使う場合はGoogleカレンダー同期設定でも「Vacaro」を有効にする。TimeTreeにカレンダーへのフルアクセスを許可する。
- AndroidはGoogleカレンダーのデータを他のアプリと共有する設定も確認する。
- TimeTreeのホームカレンダーの表示フィルターで「Vacaro」を選ぶ。

ホームカレンダーでの表示は個人用で、Google・iCloudの変更は端末の同期後に表示される。反映時間の即時性は保証しない。

TimeTreeの共有カレンダーへ共有する場合は、TimeTree側で外部カレンダーの予定を手動インポートする。共有先は自動更新されない。変更・削除はTimeTree側で整理が必要で、再インポートは重複を起こすことがある。Web版は外部カレンダーに対応しない。

## 取り込みの制限

TimeTree内の予定をGoogleへ自動同期・エクスポートする機能は公式には提供されていない。TimeTree内だけにある予定をVacaroが自動取得するとは案内しない。Google・iCloudにも保存した予定は、既存の回答画面から取り込める。

## 公式資料（2026年11月9日確認）

- [外部カレンダーの利用と制限](https://support.timetreeapp.com/hc/ja/articles/360000629341)
- [共有カレンダーへの手動インポート](https://support.timetreeapp.com/hc/ja/articles/360000639742)
- [Googleカレンダー同期設定](https://calendar.google.com/calendar/syncselect)
- [TimeTree API終了のお知らせ](https://timetreeapp.com/intl/ja/newsroom/2023-12-14/connect-app-api-202312)
