import { Link } from "react-router";
import { PageIntro, PageShell } from "../components/ui";

export function meta() {
	return [
		{ title: "プライバシーポリシー | vacaro" },
		{
			name: "description",
			content: "vacaroにおける個人情報とGoogleユーザーデータの取扱い方針です。",
		},
	];
}

export default function PrivacyPolicy() {
	return (
		<PageShell showPersistentInviteUrl={false}>
			<div className="legal-main mx-auto">
				<PageIntro
					eyebrow="PRIVACY POLICY"
					title="プライバシーポリシー"
					description="vacaroでお預かりする情報と、その取扱いについて説明します。"
					backTo="/"
					backLabel="トップへ戻る"
				/>

				<article className="legal-document">
					<p className="legal-updated">制定日：2026年9月16日</p>

					<section>
						<h2>1. 基本方針</h2>
						<p>
							vacaro（以下「本サービス」といいます。）の運営者（以下「運営者」といいます。）は、本サービスの提供に必要な範囲で利用者の情報を取得し、本ポリシーに従って適切に取り扱います。
						</p>
					</section>

					<section>
						<h2>2. 取得する情報</h2>
						<ul>
							<li>
								表示名、メールアドレス、Googleアカウントを識別するための情報
							</li>
							<li>
								イベント名、説明、候補期間、回答期限、参加状況および空き時間など、利用者が本サービスへ入力する情報
							</li>
							<li>
								Googleカレンダー連携時の認可情報、付与された権限およびカレンダー一覧
							</li>
							<li>
								Googleカレンダーの予定の有無を示す時間帯情報（FreeBusy情報）
							</li>
							<li>
								Cookie、セッション情報、ブラウザ内のローカルストレージに保存される設定
							</li>
							<li>
								IPアドレス、アクセス日時、リクエスト先、エラー情報などのサーバーログ
							</li>
						</ul>
					</section>

					<section>
						<h2>3. 利用目的</h2>
						<ul>
							<li>日程調整、イベント管理および参加者間での回答共有のため</li>
							<li>
								Googleログインによる本人識別と、複数端末でのデータ利用を可能にするため
							</li>
							<li>Googleカレンダーの予定をもとに空き時間候補を作成するため</li>
							<li>
								不正利用の防止、障害調査、セキュリティ確保およびサービス改善のため
							</li>
							<li>利用者からの問い合わせへ対応するため</li>
						</ul>
					</section>

					<section>
						<h2>4. Googleユーザーデータの取扱い</h2>
						<p>
							本サービスは、利用者の明示的な同意に基づき、Googleログインに必要なプロフィール情報と、Googleカレンダーの一覧および予定の有無を示す情報へアクセスします。取得したGoogleユーザーデータは、ログイン、カレンダー選択および空き時間候補の作成以外の目的には使用しません。
						</p>
						<p>
							Googleユーザーデータを広告目的で使用、第三者へ販売することはありません。また、法令に基づく場合、セキュリティ対応または利用者の依頼によるサポートに必要な場合を除き、人がGoogleユーザーデータを閲覧することはありません。
						</p>
						<p>
							Google APIから受け取った情報の利用および他のアプリへの転送は、
							<a
								href="https://developers.google.com/terms/api-services-user-data-policy"
								target="_blank"
								rel="noreferrer"
							>
								Google API Services User Data Policy
							</a>
							（Limited Use要件を含みます）に従います。
						</p>
					</section>

					<section>
						<h2>5. 保存と安全管理</h2>
						<p>
							Googleカレンダー連携に用いる認可トークンは暗号化して保存します。運営者は、アクセス制御、通信の暗号化、必要なログの監視など、漏えい・滅失・改ざんを防ぐために合理的な安全管理措置を講じます。情報は利用目的に必要な期間に限って保持します。
						</p>
					</section>

					<section>
						<h2>6. 第三者提供と外部サービス</h2>
						<p>
							法令に基づく場合または利用者の同意がある場合を除き、個人情報を第三者へ提供しません。本サービスの提供に必要な範囲で、GoogleのOAuthおよびGoogle
							Calendar
							API、サーバー・データベース等のインフラサービスを利用することがあります。
						</p>
					</section>

					<section>
						<h2>7. Cookieとローカルストレージ</h2>
						<p>
							本サービスは、ログイン状態の維持、OAuth認証の安全性確保、招待URLおよびカレンダー選択設定の保存にCookieまたはローカルストレージを使用します。無効化すると、一部機能を利用できない場合があります。
						</p>
					</section>

					<section>
						<h2>8. 利用者による管理と削除</h2>
						<p>
							Googleカレンダー連携は、ユーザー設定画面からいつでも解除できます。Googleアカウント側の権限管理画面から本サービスへのアクセス権を取り消すこともできます。その他の保有情報の確認、訂正または削除を希望する場合は、第10項の窓口へご連絡ください。
						</p>
					</section>

					<section>
						<h2>9. 本ポリシーの変更</h2>
						<p>
							法令やサービス内容の変更に応じて、本ポリシーを改定することがあります。重要な変更は、本サービス上で分かりやすい方法によりお知らせします。
						</p>
					</section>

					<section>
						<h2>10. お問い合わせ</h2>
						<p>
							本ポリシーおよび個人情報の取扱いに関するお問い合わせは、Google
							OAuth同意画面に表示される本サービスのユーザーサポートメールへご連絡ください。
						</p>
						<p>
							本サービスの利用条件については、<Link to="/terms">利用規約</Link>
							をご確認ください。
						</p>
					</section>
				</article>
			</div>
		</PageShell>
	);
}
