import { useState } from "react";
import { data, Link, useNavigation } from "react-router";
import {
	Icon,
	InviteUrlReissue,
	PageShell,
	WeekendText,
} from "~/components/app";
import { ValidationMessage } from "~/components/ui/validation-message";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type Event,
	formatDateRange,
	minutesLabel,
	reissueEventInviteUrl,
	savedEventInviteUrl,
	saveEventInviteUrl,
} from "~/lib/api";
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
	if (inviteUrl) {
		inviteUrl = saveEventInviteUrl(event.id, inviteUrl);
	}
	return { event, inviteUrl };
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	if (formData.get("intent") !== "reissue-invite-url") {
		return data(
			{
				error: {
					code: "invalid_intent",
					message: "操作を確認してください",
				},
			},
			{ status: 400 },
		);
	}
	try {
		const inviteUrl = await reissueEventInviteUrl(params.eventId);
		return { success: "招待URLを再発行しました", inviteUrl };
	} catch (error) {
		return data(
			{ error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">イベントを準備しています…</div>
		</PageShell>
	);
}

export default function Created({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { event, inviteUrl } = loaderData;
	const navigation = useNavigation();
	const reissuingInviteUrl =
		navigation.state === "submitting" &&
		navigation.formData?.get("intent") === "reissue-invite-url";
	const currentInviteUrl =
		actionData && "inviteUrl" in actionData ? actionData.inviteUrl : inviteUrl;
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		if (!currentInviteUrl) return;
		await navigator.clipboard.writeText(currentInviteUrl);
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
										<WeekendText>
											{formatDateRange(
												event.window_start_at,
												event.window_end_at,
												event.time_zone,
											)}
										</WeekendText>
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
						{currentInviteUrl && (
							<>
								<div className="copy-field">
									<span title={currentInviteUrl}>{currentInviteUrl}</span>
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
						)}
						{actionData && "error" in actionData && (
							<ValidationMessage title={actionData.error.message} compact>
								招待URLの状態を確認して、もう一度お試しください。
							</ValidationMessage>
						)}
						<InviteUrlReissue
							hasInviteUrl={Boolean(currentInviteUrl)}
							canReissue={event.status === "open"}
							busy={reissuingInviteUrl}
						/>
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
