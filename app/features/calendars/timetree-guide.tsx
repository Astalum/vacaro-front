import { Link } from "react-router";
export default function TimeTreeGuide() {
	return (
		<div>
			<div className="account-stack timetree-guide">
				<section className="account-card">
					<h2>Googleカレンダーを使う</h2>
					<ol>
						<li>
							VacaroにGoogleでログインし、このページのサービス選択で「TimeTree（Google経由）」を保存してGoogleカレンダーを接続します。専用カレンダーの作成・管理を許可してください。
						</li>
						<li>
							接続後に日程が確定すると、Googleの専用カレンダー「Vacaro」に予定が自動登録されます。すでに確定済みの予定は、各イベントの確定画面から「Googleカレンダーに追加」を押してください。
						</li>
						<li>
							同じGoogleアカウントを端末の標準カレンダーに追加し、「Vacaro」を同期対象にします。
						</li>
						<li>
							TimeTreeに端末のカレンダーへのアクセスを許可し、ホームカレンダーの表示フィルターで「Vacaro」を選択します。
						</li>
					</ol>
					<Link
						className="button button-primary"
						to="/account#calendar-settings"
					>
						Googleカレンダーの接続設定
					</Link>
					<p className="timetree-device-help">
						iPhoneでは、下記のGoogleカレンダー同期設定でも「Vacaro」を選択してください。TimeTreeのカレンダー権限はフルアクセスを許可します。Androidでは、Googleカレンダーアプリの「Googleカレンダーのデータを他のアプリと共有する」をオンにしてください。
					</p>
					<a href="https://calendar.google.com/calendar/syncselect">
						Googleカレンダー同期設定を開く
					</a>
				</section>
				<section className="account-card">
					<h2>iPhoneでiCloudを使う場合</h2>
					<p>
						Googleの代わりにiCloudを接続しても利用できます。iPhoneの標準カレンダーに専用カレンダー「Vacaro」が表示されることを確認し、TimeTreeにカレンダーへのアクセスを許可して、ホームカレンダーの表示対象に追加してください。
					</p>
					<Link className="button button-ghost" to="/account#calendar-settings">
						iCloudの接続設定
					</Link>
				</section>
				<section className="account-card">
					<h2>表示と共有の違い</h2>
					<p>
						ホームカレンダーで表示する方法では、Google・iCloud側の予定の変更を同期後に確認できます。TimeTree内の共有カレンダーのメンバーには共有されません。
					</p>
					<p>
						メンバーへ共有する場合は、TimeTreeの共有カレンダーで「外部カレンダーの予定をインポート」を使ってください。この方法は自動更新されず、日時変更・削除の際はTimeTree側でも整理が必要です。変更後の再インポートで予定が重複することがあります。
					</p>
					<a href="https://support.timetreeapp.com/hc/ja/articles/360000639742">
						TimeTree公式：共有カレンダーへのインポート手順
					</a>
				</section>
				<section className="account-card">
					<h2>空き時間をVacaroに取り込むには</h2>
					<p>
						Google・iCloudに保存されている予定は、Vacaroの回答画面から取り込めます。TimeTree内だけに保存された予定は取り込めません。必要な予定はGoogle・iCloudにも保存し、Vacaroの取り込み対象カレンダーに選択してください。
					</p>
					<p>
						この対応はVacaroの確定予定の書き出しです。TimeTreeからGoogleへの自動同期や、TimeTreeとの双方向同期は行いません。外部カレンダーの表示・インポートはTimeTreeのスマートフォンアプリで設定してください。
					</p>
					<a href="https://support.timetreeapp.com/hc/ja/articles/360000629341">
						TimeTree公式：外部カレンダーの利用方法
					</a>
				</section>
			</div>
		</div>
	);
}
