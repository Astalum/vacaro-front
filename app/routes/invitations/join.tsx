import { data, Form, redirect, useNavigation } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type Event,
	formatDateRange,
	minutesLabel,
	type Participant,
	type User,
} from "../../lib/api";
import type { Route } from "./+types/join";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `招待 — ${loaderData.title} | yotei`
				: "イベントへの招待 | yotei",
		},
	];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	return apiRequest<Event>(`/invitations/${params.inviteToken}`);
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	const displayName = String(formData.get("display_name") ?? "").trim();
	try {
		const event = await apiRequest<Event>(`/invitations/${params.inviteToken}`);
		try {
			const me = await apiRequest<User>("/me");
			if (me.display_name !== displayName)
				await apiRequest<User>("/me", {
					method: "PATCH",
					body: JSON.stringify({ display_name: displayName }),
				});
		} catch (error) {
			if (!(error instanceof ApiError) || error.status !== 401) throw error;
			await apiRequest<User>("/guest-sessions", {
				method: "POST",
				body: JSON.stringify({ display_name: displayName }),
			});
		}
		try {
			await apiRequest<Participant>(
				`/invitations/${params.inviteToken}/participants`,
				{ method: "POST", body: JSON.stringify({ display_name: displayName }) },
			);
		} catch (error) {
			if (!(error instanceof ApiError) || error.code !== "already_joined")
				throw error;
		}
		return redirect(`/events/${event.id}/availability`);
	} catch (error) {
		return data(
			{ error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export function HydrateFallback() {
	return (
		<PageShell narrow>
			<div className="page-loading">招待情報を読み込んでいます…</div>
		</PageShell>
	);
}

export default function JoinEvent({
	loaderData: event,
	actionData,
}: Route.ComponentProps) {
	const navigation = useNavigation();
	const joining = navigation.state === "submitting";
	return (
		<PageShell narrow>
			<div className="invite-heading">
				<span className="page-eyebrow">YOU'RE INVITED</span>
				<div className="invite-icon">
					<Icon name="mail" size={27} />
				</div>
				<h1>イベントに招待されています</h1>
			</div>
			<section className="invite-card">
				<div className="invite-card-main">
					<span className="status-pill">
						<i /> {event.status === "open" ? "回答受付中" : "受付終了"}
					</span>
					<h2>{event.title}</h2>
					{event.description && <p>{event.description}</p>}
				</div>
				<dl className="condition-list">
					<div>
						<dt>
							<Icon name="calendar" />
							調整する期間
						</dt>
						<dd>
							{formatDateRange(
								event.window_start_at,
								event.window_end_at,
								event.time_zone,
							)}
						</dd>
					</div>
					<div>
						<dt>
							<Icon name="clock" />
							イベントの長さ
						</dt>
						<dd>{minutesLabel(event.duration_minutes)}</dd>
					</div>
					<div>
						<dt>
							<Icon name="clock" />
							回答期限
						</dt>
						<dd>
							{event.response_deadline_at
								? formatDateRange(
										event.response_deadline_at,
										event.response_deadline_at,
										event.time_zone,
									).split(" 〜 ")[0]
								: "指定なし"}
						</dd>
					</div>
				</dl>
			</section>
			<Form className="join-form" method="post">
				<div>
					<h2>このイベントに参加する</h2>
					<p>表示名を入力すると、空いている時間を回答できます。</p>
				</div>
				{actionData?.error && (
					<div className="form-error">
						<Icon name="info" size={17} />
						<span>{actionData.error.message}</span>
					</div>
				)}
				<div className="field">
					<label htmlFor="join-name">
						お名前 <em>必須</em>
					</label>
					<input
						id="join-name"
						name="display_name"
						placeholder="例）高橋 花子"
						required
						minLength={1}
						maxLength={100}
					/>
				</div>
				<button
					className="button button-primary full"
					type="submit"
					disabled={joining || event.status !== "open"}
				>
					{joining ? "参加しています…" : "参加して回答へ進む"}
					<Icon name="arrow" size={17} />
				</button>
				<small>
					<Icon name="lock" size={13} /> アカウント登録なしで参加できます
				</small>
			</Form>
		</PageShell>
	);
}
