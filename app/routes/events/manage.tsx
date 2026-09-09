import { useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type Candidate,
	type Event,
	type EventWithInvite,
	formatDateRange,
	minutesLabel,
	type ParticipantAvailability,
} from "../../lib/api";
import type { Route } from "./+types/manage";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `イベント管理 — ${loaderData.event.title} | vacaro`
				: "イベント管理 | vacaro",
		},
	];
}
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [event, candidates, availability] = await Promise.all([
		apiRequest<Event>(`/events/${params.eventId}`),
		apiRequest<Candidate[]>(`/events/${params.eventId}/candidates?limit=20`),
		apiRequest<ParticipantAvailability[]>(
			`/events/${params.eventId}/availability`,
		),
	]);
	return { event, candidates, availability };
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	try {
		if (formData.get("intent") === "invite") {
			const result = await apiRequest<EventWithInvite>(
				`/events/${params.eventId}/invite-token`,
				{ method: "POST" },
			);
			return { inviteUrl: result.invite_url };
		}
		const startAt = String(formData.get("start_at") ?? "");
		const endAt = String(formData.get("end_at") ?? "");
		await apiRequest<Event>(`/events/${params.eventId}/confirmation`, {
			method: "PUT",
			body: JSON.stringify({ start_at: startAt, end_at: endAt }),
		});
		return redirect(`/events/${params.eventId}/confirmed`);
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
			<div className="page-loading">イベントを集計しています…</div>
		</PageShell>
	);
}

export default function ManageEvent({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { event, candidates, availability } = loaderData;
	const [selected, setSelected] = useState(0);
	const navigation = useNavigation();
	const selectedCandidate = candidates[selected];
	const submitting = navigation.state === "submitting";
	const submittedCount = availability.filter(
		(item) => item.participant.response_status === "submitted",
	).length;
	return (
		<PageShell>
			<div className="manage-heading">
				<div>
					<Link className="back-link" to="/events">
						<Icon name="back" size={17} /> イベント一覧へ
					</Link>
					<div className="manage-title">
						<span className="status-pill">
							<i /> {event.status === "open" ? "回答受付中" : "日程確定"}
						</span>
						<h1>{event.title}</h1>
					</div>
					<p>
						{formatDateRange(
							event.window_start_at,
							event.window_end_at,
							event.time_zone,
						)}{" "}
						・ 必要時間 {minutesLabel(event.duration_minutes)}
					</p>
				</div>
				<div className="manage-actions">
					<Link className="button button-ghost" to={`/events/${event.id}/edit`}>
						<Icon name="edit" size={17} /> 編集
					</Link>
					<Form method="post">
						<button
							className="button button-dark"
							type="submit"
							name="intent"
							value="invite"
						>
							<Icon name="link" size={17} /> 招待URLを再発行
						</button>
					</Form>
				</div>
			</div>
			{actionData && "inviteUrl" in actionData && (
				<div className="confirm-banner">
					<Icon name="link" />
					<div>
						<strong>新しい招待URLを発行しました</strong>
						<span>{actionData.inviteUrl}</span>
					</div>
					<button
						className="text-button"
						type="button"
						onClick={() => navigator.clipboard.writeText(actionData.inviteUrl)}
					>
						コピー
					</button>
				</div>
			)}
			{actionData && "error" in actionData && (
				<div className="form-error">
					<Icon name="info" size={17} />
					<span>
						<strong>{actionData.error.message}</strong>
						{actionData.error.fields &&
							Object.values(actionData.error.fields).join(" / ")}
					</span>
				</div>
			)}
			<div className="stats-row">
				<article>
					<span className="stat-icon coral">
						<Icon name="users" />
					</span>
					<div>
						<b>
							{submittedCount} / {availability.length}
						</b>
						<small>回答済み</small>
					</div>
				</article>
				<article>
					<span className="stat-icon yellow">
						<Icon name="sparkle" />
					</span>
					<div>
						<b>{candidates.length}</b>
						<small>共通候補</small>
					</div>
				</article>
				<article>
					<span className="stat-icon mint">
						<Icon name="clock" />
					</span>
					<div>
						<b>{minutesLabel(event.duration_minutes)}</b>
						<small>イベントの必要時間</small>
					</div>
				</article>
			</div>
			<section className="manage-grid">
				<div className="results-panel candidate-panel">
					<div className="panel-heading">
						<div>
							<span className="page-eyebrow">BEST WINDOWS</span>
							<h2>参加可能人数が多い時間</h2>
						</div>
						<Link to={`/events/${event.id}/results`}>
							集計の詳細 <Icon name="external" size={15} />
						</Link>
					</div>
					{candidates.length === 0 ? (
						<div className="empty-state compact">
							<Icon name="clock" size={28} />
							<h3>候補はまだありません</h3>
							<p>参加者から回答が届くと表示されます。</p>
						</div>
					) : (
						<div className="candidate-ranking">
							{candidates.map((candidate, index) => (
								<button
									type="button"
									key={`${candidate.start_at}-${candidate.end_at}`}
									className={selected === index ? "selected" : ""}
									onClick={() => setSelected(index)}
								>
									<span className="rank">{index + 1}</span>
									<span className="candidate-date">
										<strong>
											{
												formatDateRange(
													candidate.start_at,
													candidate.end_at,
													event.time_zone,
												).split(" 〜 ")[0]
											}
										</strong>
										<small>
											{new Intl.DateTimeFormat("ja-JP", {
												timeZone: event.time_zone,
												hour: "2-digit",
												minute: "2-digit",
											}).format(new Date(candidate.start_at))}
											〜
											{new Intl.DateTimeFormat("ja-JP", {
												timeZone: event.time_zone,
												hour: "2-digit",
												minute: "2-digit",
											}).format(new Date(candidate.end_at))}
										</small>
									</span>
									<span className="candidate-people">
										<b>{candidate.available_participant_count}</b>
										<small>/ {candidate.total_participant_count}人</small>
									</span>
									{index === 0 && (
										<em>
											<Icon name="sparkle" size={12} /> 最多
										</em>
									)}
								</button>
							))}
						</div>
					)}
					<div className="participant-status">
						<h3>参加者の回答状況</h3>
						{availability.map(({ participant, intervals }) => (
							<div key={participant.id}>
								<span className="avatar navy">
									{participant.display_name.slice(0, 1)}
								</span>
								<strong>{participant.display_name}</strong>
								<small>
									{participant.response_status === "submitted"
										? `参加可能時間 ${intervals.length}件`
										: "まだ回答していません"}
								</small>
								<em
									className={
										participant.response_status === "submitted"
											? "done"
											: "pending"
									}
								>
									{participant.response_status === "submitted"
										? "回答済み"
										: "未回答"}
								</em>
							</div>
						))}
					</div>
				</div>
				<aside className="decision-panel">
					<span className="page-eyebrow">CONFIRM</span>
					<h2>開催日時を確定する</h2>
					<p>共通候補からひとつ選択してください。</p>
					{selectedCandidate ? (
						<Form method="post">
							<input
								type="hidden"
								name="start_at"
								value={selectedCandidate.start_at}
							/>
							<input
								type="hidden"
								name="end_at"
								value={selectedCandidate.end_at}
							/>
							<div className="selected-slot">
								<Icon name="calendar" />
								<span>
									<strong>
										{
											formatDateRange(
												selectedCandidate.start_at,
												selectedCandidate.end_at,
												event.time_zone,
											).split(" 〜 ")[0]
										}
									</strong>
									<b>
										{new Intl.DateTimeFormat("ja-JP", {
											timeZone: event.time_zone,
											hour: "2-digit",
											minute: "2-digit",
										}).format(new Date(selectedCandidate.start_at))}
										〜
									</b>
									<small>
										{selectedCandidate.available_participant_count}人が参加可能
									</small>
								</span>
							</div>
							<button
								type="submit"
								className="button button-primary full"
								disabled={submitting || event.status !== "open"}
							>
								{submitting ? "確定しています…" : "この時間で確定する"}
							</button>
						</Form>
					) : (
						<div className="selected-slot empty">
							<Icon name="info" />
							<span>確定できる候補がありません</span>
						</div>
					)}
					<p className="decision-note">
						<Icon name="info" size={14} /> 確定する時間は
						{minutesLabel(event.duration_minutes)}です
					</p>
				</aside>
			</section>
		</PageShell>
	);
}
