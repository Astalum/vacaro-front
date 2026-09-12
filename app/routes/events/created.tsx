import { useState } from "react";
import { Link } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	apiRequest,
	type Event,
	type EventWithInvite,
	formatDateRange,
	minutesLabel,
	savedEventInviteUrl,
	saveEventInviteUrl,
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
	let inviteUrl =
		new URL(request.url).searchParams.get("invite_url") ??
		savedEventInviteUrl(event.id);
	if (!inviteUrl) {
		const invitedEvent = await apiRequest<EventWithInvite>(
			`/events/${event.id}/invite-token`,
			{ method: "POST" },
		);
		inviteUrl = invitedEvent.invite_url;
	}
	saveEventInviteUrl(event.id, inviteUrl);
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
		await navigator.clipboard.writeText(inviteUrl);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1800);
	};
	return (
		<PageShell showPersistentInviteUrl={false}>
			<div className="success-hero">
				<div className="success-badge">
					<Icon name="check" size={32} />
				</div>
				<span className="page-eyebrow">EVENT CREATED</span>
				<h1>イベントを作成しました！</h1>
				<p>招待URLを参加者に送って、空いている時間を回答してもらいましょう。</p>
			</div>
			<div className="created-content-grid">
				<section className="share-panel">
					<div className="share-event">
						<div>
							<small>日程調整</small>
							<h2>{event.title}</h2>
							<div className="created-event-meta">
								<span>
									<Icon name="calendar" size={17} />
									<strong>
										{formatDateRange(
											event.window_start_at,
											event.window_end_at,
											event.time_zone,
										)}
									</strong>
								</span>
								<span>
									<Icon name="clock" size={17} />
									必要時間{" "}
									<strong>{minutesLabel(event.duration_minutes)}</strong>
								</span>
							</div>
						</div>
					</div>
					<div className="share-block">
						<span className="field-label">参加者用の招待URL</span>
						<div className="copy-field">
							<span title={inviteUrl}>{inviteUrl}</span>
							<button type="button" onClick={copy}>
								<Icon name={copied ? "check" : "copy"} size={18} />
								{copied ? "コピーしました" : "コピー"}
							</button>
						</div>
						<p>
							<Icon name="info" size={15} />{" "}
							このURLを知っている人がイベントへ参加できます。
						</p>
					</div>
				</section>
			</div>
			<div className="created-actions">
				<Link
					className="button button-primary button-large"
					to={`/events/${event.id}/availability`}
				>
					自分の空いている時間を回答 <Icon name="arrow" size={18} />
				</Link>
				<Link className="button button-ghost" to={`/events/${event.id}/manage`}>
					グループを設定
				</Link>
			</div>
		</PageShell>
	);
}
