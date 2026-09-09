import { useState } from "react";
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
				? `共通候補 — ${loaderData.event.title} | vacaro`
				: "共通候補 | vacaro",
		},
	];
}
export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [event, candidates, availability] = await Promise.all([
		apiRequest<Event>(`/events/${params.eventId}`),
		apiRequest<Candidate[]>(`/events/${params.eventId}/candidates?limit=100`),
		apiRequest<ParticipantAvailability[]>(
			`/events/${params.eventId}/availability`,
		),
	]);
	return { event, candidates, availability };
}
clientLoader.hydrate = true as const;

function dateParts(value: string, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date(value));
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	const year = Number(get("year"));
	const month = Number(get("month"));
	const day = Number(get("day"));
	return {
		year,
		month,
		day,
		key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
	};
}

function monthKeysBetween(start: string, end: string, timeZone: string) {
	const first = dateParts(start, timeZone);
	const last = dateParts(end, timeZone);
	const months: string[] = [];
	const cursor = new Date(Date.UTC(first.year, first.month - 1, 1));
	const limit = new Date(Date.UTC(last.year, last.month - 1, 1));
	while (cursor <= limit) {
		months.push(
			`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
		);
		cursor.setUTCMonth(cursor.getUTCMonth() + 1);
	}
	return months;
}

function monthCells(monthKey: string) {
	const [year, month] = monthKey.split("-").map(Number);
	const first = new Date(Date.UTC(year, month - 1, 1));
	const start = new Date(first);
	start.setUTCDate(start.getUTCDate() - start.getUTCDay());
	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(start.getUTCDate() + index);
		return {
			key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`,
			day: date.getUTCDate(),
			inMonth: date.getUTCMonth() === month - 1,
		};
	});
}

function timeLabel(value: string, timeZone: string) {
	return new Intl.DateTimeFormat("ja-JP", {
		timeZone,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(new Date(value));
}
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
	const months = monthKeysBetween(
		event.window_start_at,
		event.window_end_at,
		event.time_zone,
	);
	const initialMonth = candidates[0]
		? dateParts(candidates[0].start_at, event.time_zone).key.slice(0, 7)
		: months[0];
	const [activeMonth, setActiveMonth] = useState(initialMonth);
	const [selectedCandidateKey, setSelectedCandidateKey] = useState(
		candidates[0] ? `${candidates[0].start_at}-${candidates[0].end_at}` : null,
	);
	const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
	const activeMonthIndex = months.indexOf(activeMonth);
	const startDateKey = dateParts(event.window_start_at, event.time_zone).key;
	const endDateKey = dateParts(event.window_end_at, event.time_zone).key;
	const candidatesByDate = new Map<string, Candidate[]>();
	for (const candidate of candidates) {
		const key = dateParts(candidate.start_at, event.time_zone).key;
		candidatesByDate.set(key, [
			...(candidatesByDate.get(key) ?? []),
			candidate,
		]);
	}
	const selectedCandidate = candidates.find(
		(candidate) =>
			`${candidate.start_at}-${candidate.end_at}` === selectedCandidateKey,
	);
	const selectedRank = selectedCandidate
		? candidates.indexOf(selectedCandidate) + 1
		: 0;
	const expandedCandidates = expandedDateKey
		? (candidatesByDate.get(expandedDateKey) ?? [])
		: [];
	const changeMonth = (nextIndex: number) => {
		const nextMonth = months[nextIndex];
		if (!nextMonth) return;
		setActiveMonth(nextMonth);
		setExpandedDateKey(null);
		const nextCandidate = candidates.find((candidate) =>
			dateParts(candidate.start_at, event.time_zone).key.startsWith(nextMonth),
		);
		setSelectedCandidateKey(
			nextCandidate
				? `${nextCandidate.start_at}-${nextCandidate.end_at}`
				: null,
		);
	};
	const monthTitle = new Intl.DateTimeFormat("ja-JP", {
		year: "numeric",
		month: "long",
		timeZone: "UTC",
	}).format(
		new Date(
			Date.UTC(
				Number(activeMonth.split("-")[0]),
				Number(activeMonth.split("-")[1]) - 1,
				1,
			),
		),
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
				<div className="schedule-calendar-shell">
					<div className="schedule-calendar-toolbar">
						<button
							type="button"
							aria-label="前の月"
							disabled={activeMonthIndex <= 0}
							onClick={() => changeMonth(activeMonthIndex - 1)}
						>
							<Icon name="back" size={18} />
						</button>
						<h3>{monthTitle}</h3>
						<button
							type="button"
							aria-label="次の月"
							disabled={activeMonthIndex >= months.length - 1}
							onClick={() => changeMonth(activeMonthIndex + 1)}
						>
							<Icon name="chevron" size={18} />
						</button>
					</div>
					<div className="schedule-calendar-scroll">
						<div className="schedule-calendar">
							{["日", "月", "火", "水", "木", "金", "土"].map(
								(weekday, index) => (
									<div
										className={`schedule-weekday weekday-${index}`}
										key={weekday}
									>
										{weekday}
									</div>
								),
							)}
							{monthCells(activeMonth).map((cell, cellIndex) => {
								const dayCandidates = cell.inMonth
									? (candidatesByDate.get(cell.key) ?? [])
									: [];
								const outsideWindow =
									cell.key < startDateKey || cell.key > endDateKey;
								return (
									<div
										className={`schedule-day ${!cell.inMonth ? "other-month" : ""} ${outsideWindow ? "outside-window" : ""}`}
										key={cell.key}
									>
										<span
											className={`schedule-day-number weekday-${cellIndex % 7}`}
										>
											{cell.day}
										</span>
										<div className="schedule-day-candidates">
											{dayCandidates.slice(0, 3).map((candidate) => {
												const key = `${candidate.start_at}-${candidate.end_at}`;
												const ratio =
													candidate.total_participant_count > 0
														? candidate.available_participant_count /
															candidate.total_participant_count
														: 0;
												return (
													<button
														className={`schedule-candidate ${ratio === 1 ? "all" : ratio >= 0.7 ? "high" : "partial"} ${selectedCandidateKey === key ? "selected" : ""}`}
														key={key}
														type="button"
														onClick={() => setSelectedCandidateKey(key)}
													>
														<strong>
															{timeLabel(candidate.start_at, event.time_zone)}
														</strong>
														<span>
															{candidate.available_participant_count}/
															{candidate.total_participant_count}人
														</span>
													</button>
												);
											})}
											{dayCandidates.length > 3 && (
												<button
													className="more-candidates"
													type="button"
													onClick={() => setExpandedDateKey(cell.key)}
												>
													ほか{dayCandidates.length - 3}件
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
					<div className="schedule-calendar-legend">
						<span>
							<i className="all" /> 全員参加可能
						</span>
						<span>
							<i className="high" /> 参加可能な人が多い
						</span>
						<span>
							<i className="partial" /> 一部が参加可能
						</span>
					</div>
				</div>
				{expandedDateKey && (
					<div className="daily-candidate-drawer">
						<div className="daily-candidate-heading">
							<div>
								<strong>
									{new Intl.DateTimeFormat("ja-JP", {
										month: "long",
										day: "numeric",
										weekday: "short",
										timeZone: "UTC",
									}).format(new Date(`${expandedDateKey}T00:00:00Z`))}
								</strong>
								<span>{expandedCandidates.length}件の候補</span>
							</div>
							<button type="button" onClick={() => setExpandedDateKey(null)}>
								閉じる
							</button>
						</div>
						<div className="daily-candidate-list">
							{expandedCandidates.map((candidate) => {
								const key = `${candidate.start_at}-${candidate.end_at}`;
								return (
									<button
										className={selectedCandidateKey === key ? "selected" : ""}
										key={key}
										type="button"
										onClick={() => setSelectedCandidateKey(key)}
									>
										<strong>
											{timeLabel(candidate.start_at, event.time_zone)}〜
											{timeLabel(candidate.end_at, event.time_zone)}
										</strong>
										<span>
											{candidate.available_participant_count} /{" "}
											{candidate.total_participant_count}人
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
				{selectedCandidate ? (
					<div className="selected-schedule-detail">
						<span className="selected-rank">
							{selectedRank === 1 ? (
								<Icon name="sparkle" size={15} />
							) : (
								`#${selectedRank}`
							)}
						</span>
						<div className="selected-schedule-date">
							<small>選択中の候補</small>
							<strong>
								{formatDateRange(
									selectedCandidate.start_at,
									selectedCandidate.end_at,
									event.time_zone,
								)}
							</strong>
						</div>
						<div className="selected-schedule-people">
							<b>{selectedCandidate.available_participant_count}</b>
							<span>
								/ {selectedCandidate.total_participant_count}人が参加可能
							</span>
							<small>
								{selectedCandidate.available_participant_ids
									.map((id) => participantById.get(id))
									.filter(Boolean)
									.join("、") || "該当する参加者はいません"}
							</small>
						</div>
					</div>
				) : (
					<div className="empty-state compact calendar-empty-state">
						<Icon name="clock" size={28} />
						<h3>この月の共通候補はまだありません</h3>
						<p>参加者の回答が増えると、カレンダーに候補が表示されます。</p>
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
