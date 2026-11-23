import { useEffect, useState } from "react";
import {
	Link,
	redirect,
	useLocation,
	useNavigate,
	useSearchParams,
} from "react-router";
import { AppHeader, SiteFooter } from "~/components/layout";
import { Icon } from "~/components/ui/icon";
import { createPageMeta } from "~/lib/meta";
import type { Route } from "./+types/home";

export function meta() {
	return createPageMeta();
}

export function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	if (url.searchParams.get("google_calendar") === "connected") {
		return redirect("/account?google_calendar=connected#calendar-settings");
	}
	return null;
}

function useHome() {
	const [searchParams] = useSearchParams();
	const { hash } = useLocation();
	const navigate = useNavigate();
	const [loginSucceeded, setLoginSucceeded] = useState(false);
	const googleLogin = searchParams.get("google_login");

	useEffect(() => {
		if (googleLogin !== "success") return;
		setLoginSucceeded(true);
		const nextParams = new URLSearchParams(searchParams);
		nextParams.delete("google_login");
		void navigate(
			{ search: nextParams.toString(), hash },
			{ replace: true, preventScrollReset: true },
		);
	}, [googleLogin, searchParams, hash, navigate]);

	const notice =
		googleLogin === "success" || loginSucceeded
			? {
					kind: "success" as const,
					message: "Googleログインが完了しました。",
				}
			: googleLogin === "error"
				? {
						kind: "error" as const,
						message:
							"Googleログインを完了できませんでした。もう一度お試しください。",
					}
				: searchParams.get("logout") === "success"
					? { kind: "success" as const, message: "ログアウトしました。" }
					: null;

	function dismissNotice() {
		setLoginSucceeded(false);
		const nextParams = new URLSearchParams(searchParams);
		nextParams.delete("google_login");
		nextParams.delete("logout");
		void navigate(
			{ search: nextParams.toString(), hash },
			{ replace: true, preventScrollReset: true },
		);
	}

	return { notice, dismissNotice };
}

export default function Home() {
	const { notice, dismissNotice } = useHome();

	return (
		<div className="site-shell landing-shell">
			<AppHeader />
			<main>
				{notice && (
					<div
						className={`home-notice wrap ${notice.kind === "error" ? "home-notice-error" : ""}`}
						role={notice.kind === "error" ? "alert" : "status"}
					>
						<Icon name={notice.kind === "error" ? "info" : "check"} size={18} />
						<span>{notice.message}</span>
						<button type="button" onClick={dismissNotice}>
							閉じる
						</button>
					</div>
				)}
				<section className="hero wrap">
					<div className="hero-copy">
						<span className="eyebrow">
							<span />
							日程調整をもっと柔軟に
						</span>
						<h1>
							みんなの予定が、
							<br />
							<em>ひとつになる。</em>
						</h1>
						<p className="hero-lead">
							期間を決めて、空いている時間を集めるだけ。
							<br className="desktop-only" />
							面倒な日程調整を、3分で終わらせよう。
						</p>
						<div className="hero-actions">
							<Link
								className="button button-primary event-create-button button-large"
								to="/events/new"
							>
								イベントを作る <Icon name="arrow" size={18} />
							</Link>
							<a className="text-link" href="#how">
								使い方を見る <Icon name="down" size={16} />
							</a>
						</div>
						<div>
							<p className="hero-note">
								<Icon name="check" size={14} />{" "}
								アカウント登録なし・無料で使えます！
							</p>
							<p className="hero-note">
								<Icon name="check" size={14} />{" "}
								アカウント登録でGoogleカレンダー連携も！
							</p>
						</div>
					</div>
					<div
						className="hero-visual"
						role="img"
						aria-label="日程調整画面のイメージ"
					>
						<div className="sun-shape" />
						<div className="mock-window">
							<div className="mock-top">
								<i />
								<i />
								<i />
								<span>vacaro.astalum.dev/events/results</span>
							</div>
							<div className="mock-body">
								<div className="mock-event-head">
									<span className="mini-label">日程調整</span>
									<strong>プロジェクト打ち上げ 🎉</strong>
									<small>5人が回答しました</small>
								</div>
								<div className="mock-free-grid">
									<div className="mock-hours">
										<span />
										<b>16時</b>
										<b>18時</b>
										<b>20時</b>
										<b>22時</b>
									</div>
									<div>
										<strong>田中</strong>
										<span>
											<i style={{ left: "25%", width: "66%" }} />
										</span>
									</div>
									<div>
										<strong>佐藤</strong>
										<span>
											<i style={{ left: "42%", width: "50%" }} />
										</span>
									</div>
									<div>
										<strong>鈴木</strong>
										<span>
											<i style={{ left: "33%", width: "59%" }} />
										</span>
									</div>
									<div>
										<strong>あなた</strong>
										<span>
											<i style={{ left: "17%", width: "75%" }} />
										</span>
									</div>
								</div>
								<div className="mock-recommend">
									<Icon name="sparkle" size={15} />{" "}
									19:00〜22:00なら4人が参加できます
								</div>
							</div>
						</div>
						<span className="float-card float-one">
							<Icon name="users" size={18} /> 4 / 5人が回答
						</span>
						<span className="float-card float-two">
							<Icon name="check" size={18} /> 回答しました！
						</span>
					</div>
				</section>
				<section className="how-section" id="how">
					<div className="wrap">
						<div className="section-heading">
							<span className="section-kicker">HOW IT WORKS</span>
							<h2>使い方は、かんたん3ステップ</h2>
						</div>
						<div className="steps-grid">
							<article>
								<span className="step-no">01</span>
								<div className="feature-icon coral">
									<Icon name="calendar" />
								</div>
								<h3>期間を決める</h3>
								<p>
									イベント名、調整したい期間、毎日の回答受付時間、必要時間を登録します。
								</p>
							</article>
							<article>
								<span className="step-no">02</span>
								<div className="feature-icon yellow">
									<Icon name="link" />
								</div>
								<h3>URLをシェア</h3>
								<p>
									招待URLを参加者へ送ります。参加者は表示名を入力して、都合のいい時間を回答します。
								</p>
							</article>
							<article>
								<span className="step-no">03</span>
								<div className="feature-icon mint">
									<Icon name="chart" />
								</div>
								<h3>結果を見て決定</h3>
								<p>
									参加できる人数とメンバーを確認し、主催者が日付と開始時刻を選んで確定します。
								</p>
							</article>
						</div>
						<UsageGuide />
						<aside className="group-feature">
							<div className="group-feature-icon">
								<Icon name="users" size={32} />
							</div>
							<div className="group-feature-copy">
								<span className="section-kicker">GROUP SCHEDULING</span>
								<h3>グループごとの日程も、まとめて調整</h3>
								<p>
									管理画面の「グループを追加」から、チームや役割ごとにメンバーを選んで小グループを作れます。結果画面で「全体」と各グループを切り替えると、同じ回答を使ってグループごとに日程を確定できます。
								</p>
								<p className="group-feature-note">
									1人が複数のグループに所属することもできます。確定済みのグループを変更するときは、先に確定を取り消してください。
								</p>
							</div>
						</aside>
						<UsageFaq />
					</div>
				</section>
			</main>
			<SiteFooter />
		</div>
	);
}

function UsageGuide() {
	return (
		<div className="usage-guide">
			<nav className="usage-guide-nav" aria-label="使い方の目次">
				<a href="#guide-organizer">主催者の手順</a>
				<a href="#guide-participant">参加者の手順</a>
				<a href="#guide-results">結果の見方</a>
				<a href="#guide-calendar">カレンダー連携</a>
				<a href="#guide-faq">よくある質問</a>
			</nav>
			<div className="usage-guide-columns">
				<section
					className="usage-guide-card"
					id="guide-organizer"
					aria-labelledby="guide-organizer-title"
				>
					<span className="usage-guide-label">主催者の方へ</span>
					<h3 id="guide-organizer-title">イベントを作って、日程を決める</h3>
					<ol className="usage-guide-steps">
						<li>
							<strong>期間と必要時間を設定</strong>
							<p>
								「イベントを作る」から、イベント名、調整期間、毎日の回答受付時間、必要時間を入力します。必要時間は、会議や集まりに何分必要かを表します。回答期限も設定できます。
							</p>
						</li>
						<li>
							<strong>招待URLを共有</strong>
							<p>
								作成完了画面の招待URLをコピーし、メッセージやメールで参加者に送ります。主催者自身の参加可能時間も回答してください。
							</p>
						</li>
						<li>
							<strong>回答が集まったら結果を確認</strong>
							<p>
								結果画面で日付を選び、集まれる時間帯とメンバーを確認します。「みんなの参加可能時間」では、未回答の人や各自の回答も確認できます。
							</p>
						</li>
						<li>
							<strong>開始時刻を入力して確定</strong>
							<p>
								カレンダーで開催日を選び、「最終時刻を入力」で開始時刻を指定して「この日時で確定」を押します。終了時刻は設定した必要時間から自動で決まります。
							</p>
						</li>
					</ol>
					<Link className="text-link" to="/events/new">
						イベントを作る <Icon name="arrow" size={16} />
					</Link>
				</section>
				<section
					className="usage-guide-card"
					id="guide-participant"
					aria-labelledby="guide-participant-title"
				>
					<span className="usage-guide-label">参加者の方へ</span>
					<h3 id="guide-participant-title">都合のいい時間を回答する</h3>
					<ol className="usage-guide-steps">
						<li>
							<strong>招待URLから参加</strong>
							<p>
								主催者から届いたURLを開き、イベントの内容と期間を確認します。表示名を入力して「参加して回答へ進む」を押します。アカウント登録なしでも参加できます。
							</p>
						</li>
						<li>
							<strong>入力する時間の種類を選択</strong>
							<p>
								参加できる時間が少ないときは「都合がいい時間」、忙しい時間が少ないときは「都合が悪い時間」を選び、その時間帯を入力します。
							</p>
						</li>
						<li>
							<strong>時間帯を追加・調整</strong>
							<p>
								カレンダーをタップまたはドラッグして時間帯を追加します。スマートフォンでは先に日付を選び、開始・終了時刻の欄で細かく調整できます。複数の日や時間帯も回答できます。
							</p>
						</li>
						<li>
							<strong>最後に「回答を保存」</strong>
							<p>
								入力を終えたら「回答を保存」を押してください。「回答を保存しました」と表示されたら完了です。変更するときは、編集後に「回答を更新」を押します。
							</p>
						</li>
					</ol>
					<p className="usage-guide-tip">
						ゲストの方は、回答画面の「再回答用リンク」も保存しておくと、別の端末から回答を変更できます。
					</p>
				</section>
			</div>
			<section
				className="usage-guide-card usage-results-guide"
				id="guide-results"
				aria-labelledby="guide-results-title"
			>
				<div>
					<span className="usage-guide-label">結果の見方</span>
					<h3 id="guide-results-title">
						人数だけでなく、参加するメンバーも確認
					</h3>
					<p>
						カレンダーの各日には、参加可能人数が多い順に候補が表示されます。同じ人数なら早い時間が先です。日付を選ぶと、その日のすべての時間帯と参加できる人の名前を確認できます。
					</p>
					<p>
						「5 /
						6人」は、回答済みの6人のうち5人が参加できるという意味です。未回答の人は人数の母数に含めません。同じ人数でも途中でメンバーが入れ替わる場合は、時間ごとに名前が表示されます。
					</p>
				</div>
				<dl className="usage-color-legend">
					<div className="usage-color-all">
						<dt>緑：回答者全員が参加可能</dt>
						<dd>回答済みの全員が参加できる時間帯です。</dd>
					</div>
					<div className="usage-color-high">
						<dt>黄：参加できる人が多い</dt>
						<dd>回答済みの人の7割以上が参加できる時間帯です。</dd>
					</div>
					<div className="usage-color-partial">
						<dt>赤：一部の人が参加可能</dt>
						<dd>
							回答済みの人のうち参加できる人は7割未満です。メンバーを確認して検討します。
						</dd>
					</div>
				</dl>
			</section>
			<section
				className="usage-guide-card"
				id="guide-calendar"
				aria-labelledby="guide-calendar-title"
			>
				<span className="usage-guide-label">入力をもっと簡単に</span>
				<h3 id="guide-calendar-title">
					Google・iCloudの予定から空き時間を取り込む
				</h3>
				<ol className="usage-calendar-steps">
					<li>
						Googleログイン後、ユーザー設定の「カレンダー設定」で、使うサービスを選んで保存し、接続します。
					</li>
					<li>
						取り込み対象のカレンダーと、毎日取り込む時間帯を選んで保存します。
					</li>
					<li>
						回答画面で「Googleから取込」または「iCloudから取込」を押し、内容を確認してから回答を保存します。
					</li>
				</ol>
				<p className="usage-calendar-sync">
					日程が確定すると、対象の参加者が選んだサービスの専用カレンダーに予定が登録されます。
				</p>
				<p className="usage-guide-tip">
					取り込みは入力中の回答を置き換えます。TimeTree（Google経由）は、確定した予定の書き出しに対応しています。TimeTree内の予定の取り込みには対応していません。
				</p>
				<div className="usage-guide-links">
					<Link className="text-link" to="/account#calendar-settings">
						カレンダー設定を開く <Icon name="arrow" size={16} />
					</Link>
					<Link className="text-link" to="/account#timetree-guide">
						TimeTreeの表示手順を見る <Icon name="arrow" size={16} />
					</Link>
				</div>
			</section>
		</div>
	);
}

const usageFaqs = [
	{
		question: "アカウント登録は必要ですか？",
		answer:
			"イベントの作成・参加は、アカウント登録なしで利用できます。ゲストの利用状態が有効な同じブラウザでGoogleログインすると、そのゲストで作成・参加したイベントを引き継げます。Cookieの削除や期限切れ後、別のブラウザからのログインでは自動で引き継げません。",
	},
	{
		question: "回答をあとから変更できますか？",
		answer:
			"調整中のイベントは、回答画面で時間帯を編集し、「回答を更新」で保存できます。ゲストの方は再回答用リンクを保存しておくと、別の端末やブラウザからも変更できます。",
	},
	{
		question: "参加できる時間がないときは？",
		answer:
			"「都合がいい時間」モードで時間帯をすべて削除してから回答を保存すると、参加可能時間なしとして回答できます。「都合が悪い時間」モードでは、入力していない時間は参加可能として扱われるので、選択中のモードを確認してください。",
	},
	{
		question: "全員が集まれる候補が見つからないときは？",
		answer:
			"まず未回答の人がいないか確認してください。全員が参加できる時間がなくても、一部の人が参加できる候補を確認できます。メンバーごとの参加可能時間を見ながら相談し、必要に応じて主催者が調整期間や必要時間を見直します。",
	},
	{
		question: "回答結果が表示されないのはなぜですか？",
		answer:
			"主催者が回答結果を非公開にしている場合、参加者は結果を閲覧できません。公開するかどうかは、主催者が結果画面の「回答者への公開」で設定できます。",
	},
	{
		question: "確定した日時を変更するには？",
		answer:
			"主催者が結果画面で「確定を取り消す」を押し、開催日と開始時刻を選び直して「この日時で確定」を押します。小グループごとに確定した場合は、変更するグループを選んで操作してください。",
	},
];

function UsageFaq() {
	return (
		<section
			className="usage-faq"
			id="guide-faq"
			aria-labelledby="guide-faq-title"
		>
			<span className="usage-guide-label">困ったときに</span>
			<h3 id="guide-faq-title">よくある質問</h3>
			<div className="usage-faq-list">
				{usageFaqs.map(({ question, answer }) => (
					<details key={question}>
						<summary>{question}</summary>
						<p>{answer}</p>
					</details>
				))}
			</div>
			<a className="text-link usage-back-to-top" href="#how">
				使い方の先頭へ <Icon name="arrow" size={16} />
			</a>
		</section>
	);
}
