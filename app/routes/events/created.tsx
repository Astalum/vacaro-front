import { useState } from "react";
import { Link } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	apiRequest,
	type Event,
	formatDateRange,
	minutesLabel,
} from "../../lib/api";
import type { Route } from "./+types/created";

export function meta() {
	return [{ title: "イベントを作成しました | vacaro" }];
}

export async function clientLoader({
	params,
	request,
}: Route.ClientLoaderArgs) {
	const event = await apiRequest<Event>(`/events/${params.eventId}`);
	const inviteUrl = new URL(request.url).searchParams.get("invite_url");
	return { event, inviteUrl };
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">イベントを準備しています…</div>
		</PageShell>
	);
}

export default function Created({ loaderData }: Route.ComponentProps) {
	const { event, inviteUrl } = loaderData;
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		if (!inviteUrl) return;
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1800);
	};
	return (
		<PageShell>
			<div className="success-hero">
				<div className="success-badge">
					<Icon name="check" size={32} />
				</div>
				<span className="page-eyebrow">EVENT CREATED</span>
				<h1>イベントを作成しました！</h1>
				<p>招待URLを参加者に送って、空いている時間を回答してもらいましょう。</p>
			</div>
			<section className="share-panel">
				<div className="share-event">
					<span className="date-tile">
						<b>{new Date(event.window_start_at).getDate()}</b>
						<small>START</small>
					</span>
					<div>
						<small>日程調整</small>
						<h2>{event.title}</h2>
						<p>
							{formatDateRange(
								event.window_start_at,
								event.window_end_at,
								event.time_zone,
							)}{" "}
							・ 必要時間 {minutesLabel(event.duration_minutes)}
						</p>
					</div>
				</div>
				<div className="share-block">
					<span className="field-label">参加者用の招待URL</span>
					{inviteUrl ? (
						<>
							<div className="copy-field">
								<span>{inviteUrl}</span>
								<button type="button" onClick={copy}>
									<Icon name={copied ? "check" : "copy"} size={18} />
									{copied ? "コピーしました" : "コピー"}
								</button>
							</div>
							<p>
								<Icon name="info" size={15} />{" "}
								このURLを知っている人がイベントへ参加できます。
							</p>
						</>
					) : (
						<div className="form-error">
							<Icon name="info" size={17} />
							<span>
								<strong>招待URLを再表示できません</strong>
								招待URLは作成時だけ表示されます。管理画面から再発行してください。
							</span>
						</div>
					)}
				</div>
			</section>
			<section className="admin-url">
				<div className="admin-icon">
					<Icon name="lock" />
				</div>
				<div>
					<h3>このブラウザからイベントを管理できます</h3>
					<p>
						ゲストセッションは7日間有効です。継続して管理する場合はGoogleアカウント連携をご利用ください。
					</p>
				</div>
			</section>
			<div className="created-actions">
				<Link
					className="button button-primary button-large"
					to={`/events/${event.id}/availability`}
				>
					自分の空いている時間を回答 <Icon name="arrow" size={18} />
				</Link>
				<Link className="button button-ghost" to={`/events/${event.id}/manage`}>
					イベント管理へ
				</Link>
				{inviteUrl && (
					<Link className="text-link" to={new URL(inviteUrl).pathname}>
						参加者画面をプレビュー <Icon name="external" size={15} />
					</Link>
				)}
			</div>
		</PageShell>
	);
}
