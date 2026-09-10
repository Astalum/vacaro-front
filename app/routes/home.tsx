import { Link, useSearchParams } from "react-router";
import { AppHeader, Icon } from "../components/ui";

export function meta() {
	return [
		{ title: "Vacaro — みんなの予定が、ひとつになる" },
		{ name: "description", content: "シンプルな日程調整アプリ" },
	];
}

export default function Home() {
	const [searchParams, setSearchParams] = useSearchParams();
	const notice =
		searchParams.get("google_login") === "success"
			? "Googleログインが完了しました。現在のイベントと回答を引き継いでいます。"
			: searchParams.get("google_calendar") === "connected"
				? "Googleカレンダーを接続しました。参加可能時間の入力画面から空き時間を取り込めます。"
				: searchParams.get("logout") === "success"
					? "ログアウトしました。"
					: null;
	return (
		<div className="site-shell landing-shell">
			<AppHeader />
			<main>
				{notice && (
					<div className="home-notice wrap" role="status">
						<Icon name="check" size={18} />
						<span>{notice}</span>
						<button
							type="button"
							onClick={() => setSearchParams({}, { replace: true })}
						>
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
								className="button button-primary button-large"
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
								<Icon name="check" size={14} /> アカウント登録なし・無料で使えます！
							</p>
							<p className="hero-note">
								<Icon name="check" size={14} /> アカウント登録でGoogleカレンダー連携も！
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
								<span>vacaro.app/invitations/7ka92</span>
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
								<p>日程を調整したい期間と、必要な時間を登録します。</p>
							</article>
							<article>
								<span className="step-no">02</span>
								<div className="feature-icon yellow">
									<Icon name="link" />
								</div>
								<h3>URLをシェア</h3>
								<p>発行されたURLを、参加者に送るだけ。登録は不要です。</p>
							</article>
							<article>
								<span className="step-no">03</span>
								<div className="feature-icon mint">
									<Icon name="chart" />
								</div>
								<h3>結果を見て決定</h3>
								<p>
									空き時間の重なりから、みんなが集まりやすい時間を見つけます。
								</p>
							</article>
						</div>
					</div>
				</section>
			</main>
			<footer className="footer wrap">
				<Link className="brand" to="/">
					<span className="brand-mark">
						<i />
						<i />
						<i />
					</span>
					vacaro
				</Link>
				<span>© 2026 vacaro</span>
			</footer>
		</div>
	);
}
