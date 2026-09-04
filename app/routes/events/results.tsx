import { Link } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	apiRequest,
	type Candidate,
	type Event,
	formatDateRange,
	minutesLabel,
	type ParticipantAvailability,
} from "../../lib/api";
import type { Route } from "./+types/results";

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{
			title: loaderData
				? `共通候補 — ${loaderData.event.title} | yotei`
				: "共通候補 | yotei",
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
export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">回答結果を集計しています…</div>
		</PageShell>
	);
}

export default function Results({ loaderData }: Route.ComponentProps) {
	const { event, candidates, availability } = loaderData;
	const submitted = availability.filter(
		(item) => item.participant.response_status === "submitted",
	).length;
	const participantById = new Map(
		availability.map((item) => [
			item.participant.id,
			item.participant.display_name,
		]),
	);
	return (
		<PageShell>
			<div className="share-page-head result-head">
				<span className="page-eyebrow">AVAILABILITY RESULTS</span>
				<div className="event-summary">
					<span className="status-pill">
						<i /> {event.status === "open" ? "回答受付中" : "日程確定"}
					</span>
					<h2>{event.title}</h2>
					<div className="event-meta">
						<span>
							<Icon name="calendar" size={17} />{" "}
							{formatDateRange(
								event.window_start_at,
								event.window_end_at,
								event.time_zone,
							)}
						</span>
						<span>
							<Icon name="clock" size={17} /> 必要時間：
							{minutesLabel(event.duration_minutes)}
						</span>
					</div>
				</div>
				<div className="head-links">
					<Link
						className="button button-ghost"
						to={`/events/${event.id}/availability`}
					>
						<Icon name="edit" size={17} /> 自分の回答を編集
					</Link>
				</div>
			</div>
			<section className="candidate-summary">
				<div className="section-title-row">
					<div>
						<span className="page-eyebrow">SUGGESTIONS</span>
						<h2>参加しやすい時間</h2>
						<p>必要時間を確保できる時間を、参加可能人数順に表示しています。</p>
					</div>
					<span className="response-count">
						<Icon name="users" size={16} /> {submitted} / {availability.length}
						人が回答
					</span>
				</div>
				{candidates.length === 0 ? (
					<div className="empty-state compact">
						<Icon name="clock" size={28} />
						<h3>共通候補はまだありません</h3>
						<p>参加者の回答が増えると、ここに候補が表示されます。</p>
					</div>
				) : (
					<div className="candidate-cards">
						{candidates.slice(0, 6).map((candidate, index) => (
							<article
								key={`${candidate.start_at}-${candidate.end_at}`}
								className={index === 0 ? "best" : ""}
							>
								{index === 0 && (
									<span className="best-label">
										<Icon name="sparkle" size={12} /> BEST
									</span>
								)}
								<span className="rank">{index + 1}</span>
								<h3>
									{
										formatDateRange(
											candidate.start_at,
											candidate.end_at,
											event.time_zone,
										).split(" 〜 ")[0]
									}
								</h3>
								<strong>
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
								</strong>
								<div className="candidate-count">
									<b>{candidate.available_participant_count}</b>
									<span>/ {candidate.total_participant_count}人が参加可能</span>
								</div>
								<p>
									{candidate.available_participant_ids
										.map((id) => participantById.get(id))
										.filter(Boolean)
										.join("、")}
								</p>
							</article>
						))}
					</div>
				)}
			</section>
			<section className="availability-board">
				<div className="section-title-row">
					<div>
						<span className="page-eyebrow">RESPONSES</span>
						<h2>みんなの参加可能時間</h2>
					</div>
				</div>
				<div className="participant-status availability-list">
					{availability.map(({ participant, intervals }) => (
						<div key={participant.id}>
							<span className="avatar navy">
								{participant.display_name.slice(0, 1)}
							</span>
							<strong>{participant.display_name}</strong>
							<small>
								{participant.response_status === "pending"
									? "まだ回答していません"
									: intervals.length === 0
										? "参加可能時間なし"
										: intervals
												.map((interval) =>
													formatDateRange(
														interval.start_at,
														interval.end_at,
														event.time_zone,
													),
												)
												.join(" / ")}
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
			</section>
			<p className="waiting-message">
				<Icon name="info" size={16} />{" "}
				共通候補はサーバーが登録された時間の重なりから自動計算しています。
			</p>
		</PageShell>
	);
}
