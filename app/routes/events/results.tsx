import { useEffect, useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type Candidate,
	type Event,
	formatDateRange,
	localDateTimeToIso,
	minutesLabel,
	type ParticipantAvailability,
	type SchedulingGroup,
	type User,
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
export async function clientLoader({
	params,
	request,
}: Route.ClientLoaderArgs) {
	const [event, user] = await Promise.all([
		apiRequest<Event>(`/events/${params.eventId}`),
		apiRequest<User>("/me"),
	]);
	const groups =
		event.scheduling_mode === "groups"
			? await apiRequest<SchedulingGroup[]>(`/events/${event.id}/groups`)
			: [];
	const searchParams = new URL(request.url).searchParams;
	const requestedGroupID = searchParams.get("group_id");
	const showWholeEvent =
		event.scheduling_mode === "whole_event" ||
		searchParams.get("scope") === "whole" ||
		!requestedGroupID ||
		groups.length === 0;
	const activeGroup =
		(showWholeEvent
			? null
			: (groups.find((group) => group.id === requestedGroupID) ?? groups[0])) ??
		null;
	if (
		!showWholeEvent &&
		requestedGroupID &&
		activeGroup &&
		requestedGroupID !== activeGroup.id
	) {
		return redirect(`/events/${event.id}/results?group_id=${activeGroup.id}`);
	}
	const basePath = activeGroup
		? `/events/${event.id}/groups/${activeGroup.id}`
		: `/events/${event.id}`;
	const [candidates, availability] = await Promise.all([
		apiRequest<Candidate[]>(`${basePath}/candidates?limit=100`),
		apiRequest<ParticipantAvailability[]>(`${basePath}/availability`),
	]);
	return { event, user, groups, activeGroup, candidates, availability };
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	const groupID = String(formData.get("group_id") ?? "");
	const confirmationPath = groupID
		? `/events/${params.eventId}/groups/${groupID}/confirmation`
		: `/events/${params.eventId}/confirmation`;
	try {
		if (intent === "unconfirm") {
			await apiRequest(confirmationPath, { method: "DELETE" });
			return { success: "確定を取り消しました" };
		}
		if (intent === "confirm") {
			const confirmationDate = String(formData.get("confirmation_date") ?? "");
			const confirmationTime = String(formData.get("confirmation_time") ?? "");
			const validDate = /^\d{4}-\d{2}-\d{2}$/.test(confirmationDate);
			const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(confirmationTime);
			const startAt =
				validDate && validTime
					? localDateTimeToIso(`${confirmationDate}T${confirmationTime}`)
					: null;
			const durationMinutes = Number(formData.get("duration_minutes"));
			if (
				!startAt ||
				!Number.isInteger(durationMinutes) ||
				durationMinutes < 5 ||
				durationMinutes > 1440
			) {
				return data(
					{
						error: {
							code: "invalid_confirmation_time",
							message: "カレンダーで日付を選び、開始時刻を入力してください",
						},
					},
					{ status: 400 },
				);
			}
			const endAt = new Date(
				new Date(startAt).getTime() + durationMinutes * 60_000,
			).toISOString();
			await apiRequest(confirmationPath, {
				method: "PUT",
				body: JSON.stringify({
					start_at: startAt,
					end_at: endAt,
				}),
			});
			return { success: "開催日時を確定しました" };
		}
		return data(
			{ error: { code: "invalid_intent", message: "操作を確認してください" } },
			{ status: 400 },
		);
	} catch (error) {
		return data(
			{ error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

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

function candidateAvailabilityLevel(candidate: Candidate) {
	const ratio =
		candidate.total_participant_count > 0
			? candidate.available_participant_count /
				candidate.total_participant_count
			: 0;
	if (ratio === 1) return "all";
	if (ratio >= 0.7) return "high";
	return "partial";
}

export function mergeCandidateIntervals(candidates: Candidate[]) {
	const sorted = [...candidates].sort(
		(left, right) =>
			new Date(left.start_at).getTime() - new Date(right.start_at).getTime(),
	);
	const intervals: Candidate[] = [];
	for (const candidate of sorted) {
		const previous = intervals.at(-1);
		const sameParticipants =
			previous &&
			previous.available_participant_count ===
				candidate.available_participant_count &&
			previous.total_participant_count === candidate.total_participant_count &&
			[...previous.available_participant_ids].sort().join("\u0000") ===
				[...candidate.available_participant_ids].sort().join("\u0000");
		if (
			previous &&
			sameParticipants &&
			new Date(candidate.start_at).getTime() <=
				new Date(previous.end_at).getTime()
		) {
			if (
				new Date(candidate.end_at).getTime() >
				new Date(previous.end_at).getTime()
			) {
				previous.end_at = candidate.end_at;
			}
			continue;
		}
		intervals.push({
			...candidate,
			available_participant_ids: [...candidate.available_participant_ids],
		});
	}
	return intervals;
}

export function HydrateFallback() {
	return (
		<PageShell showPersistentInviteUrl={false}>
			<div className="page-loading">回答結果を集計しています…</div>
		</PageShell>
	);
}

export default function Results({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { event, user, groups, activeGroup, candidates, availability } =
		loaderData;
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";
	const isOrganizer = event.created_by_user_id === user.id;
	const submitted = availability.filter(
		(item) => item.participant.response_status === "submitted",
	).length;
	const confirmedStart = activeGroup
		? activeGroup.confirmed_start_at
		: event.confirmed_start_at;
	const confirmedEnd = activeGroup
		? activeGroup.confirmed_end_at
		: event.confirmed_end_at;
	const resultStatus = activeGroup
		? event.status === "cancelled"
			? "cancelled"
			: confirmedStart
				? "confirmed"
				: "open"
		: event.status;
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
	const initialCandidate =
		candidates.find(
			(candidate) =>
				candidate.start_at === confirmedStart &&
				candidate.end_at === confirmedEnd,
		) ?? candidates[0];
	const initialMonth = initialCandidate
		? dateParts(initialCandidate.start_at, event.time_zone).key.slice(0, 7)
		: months[0];
	const [activeMonth, setActiveMonth] = useState(initialMonth);
	const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
	const selectionContext = `${activeGroup?.id ?? "whole-event"}\u0000${initialMonth}`;
	useEffect(() => {
		const [, nextMonth] = selectionContext.split("\u0000");
		setActiveMonth(nextMonth);
		setExpandedDateKey(null);
	}, [selectionContext]);
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
	const intervalsByDate = new Map(
		[...candidatesByDate].map(([key, dayCandidates]) => [
			key,
			mergeCandidateIntervals(dayCandidates),
		]),
	);
	const expandedIntervals = expandedDateKey
		? (intervalsByDate.get(expandedDateKey) ?? [])
		: [];
	const changeMonth = (nextIndex: number) => {
		const nextMonth = months[nextIndex];
		if (!nextMonth) return;
		setActiveMonth(nextMonth);
		setExpandedDateKey(null);
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
		<PageShell showPersistentInviteUrl={false}>
			<section className="share-page-head result-head">
				<div className="result-head-topline">
					<div className="result-head-labels">
						<span className="page-eyebrow">AVAILABILITY RESULTS</span>
						<span className={`status-pill status-${resultStatus}`}>
							<i />{" "}
							{resultStatus === "open"
								? "回答受付中"
								: resultStatus === "confirmed"
									? "日程確定"
									: "中止"}
						</span>
					</div>
				</div>
				<div className="result-head-main">
					<div className="event-summary">
						<strong className="active-group-name">
							{activeGroup?.name ?? "全体"}
						</strong>
						<h2>{event.title}</h2>
						<div className="event-meta">
							<span>
								<Icon name="calendar" size={18} />
								<strong>
									{formatDateRange(
										event.window_start_at,
										event.window_end_at,
										event.time_zone,
									)}
								</strong>
							</span>
							<span>
								<Icon name="clock" size={18} />
								<span>必要時間</span>
								<strong>
									{minutesLabel(
										activeGroup?.duration_minutes ?? event.duration_minutes,
									)}
								</strong>
							</span>
						</div>
					</div>
					<nav className="head-links" aria-label="イベント操作">
						{isOrganizer && (
							<Link
								className="button result-manage-link"
								to={`/events/${event.id}/manage`}
							>
								<Icon name="users" size={17} /> イベント管理
							</Link>
						)}
						<Link
							className="button button-ghost"
							to={`/events/${event.id}/availability`}
						>
							<Icon name="edit" size={17} /> 回答を編集
						</Link>
					</nav>
				</div>
			</section>
			<section className="result-group-selector">
				<div className="result-group-title">
					<strong>グループを選択</strong>
					<span>{groups.length + 1}件のグループ</span>
				</div>
				<nav className="result-group-tabs" aria-label="小グループを切り替え">
					<Link
						className={activeGroup === null ? "active" : ""}
						to="?scope=whole"
					>
						<span>全体</span>
						<small>全参加者</small>
					</Link>
					{groups.map((group) => (
						<Link
							key={group.id}
							className={activeGroup?.id === group.id ? "active" : ""}
							to={`?group_id=${group.id}`}
						>
							<span>{group.name}</span>
							<small>{group.members.length}人</small>
							{group.confirmed_start_at && <Icon name="check" size={14} />}
						</Link>
					))}
				</nav>
			</section>
			<div className="results-two-column">
				<div className="results-left-column">
					<section className="candidate-summary candidate-calendar-panel">
						<div className="section-title-row">
							<div>
								<span className="page-eyebrow">SUGGESTIONS</span>
								<h2>参加しやすい時間</h2>
							</div>
							<span className="response-count">
								<Icon name="users" size={16} /> {submitted} /{" "}
								{availability.length}
								人が回答
							</span>
							<p className="candidate-calendar-description">
								参加者が集まれる連続した時間帯を、日付ごとに表示しています。
							</p>
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
										const dayIntervals = cell.inMonth
											? (intervalsByDate.get(cell.key) ?? [])
											: [];
										const outsideWindow =
											cell.key < startDateKey || cell.key > endDateKey;
										const clickableDate = cell.inMonth && !outsideWindow;
										const openDateCandidates = () => {
											if (!clickableDate) return;
											setExpandedDateKey(cell.key);
										};
										return (
											<div
												className={`schedule-day ${!cell.inMonth ? "other-month" : ""} ${outsideWindow ? "outside-window" : ""} ${expandedDateKey === cell.key ? "date-expanded" : ""} ${clickableDate ? "clickable-date" : ""}`}
												key={cell.key}
											>
												{clickableDate && (
													<button
														type="button"
														className="schedule-day-hit-area"
														aria-label={`${cell.key}${dayIntervals.length > 0 ? "の時間帯を表示" : "を選択（時間帯なし）"}`}
														onClick={openDateCandidates}
													/>
												)}
												<span
													className={`schedule-day-number weekday-${cellIndex % 7}`}
												>
													{cell.day}
												</span>
												<div className="schedule-day-candidates">
													{dayIntervals.slice(0, 2).map((interval) => (
														<div
															className={`schedule-gathering-interval ${candidateAvailabilityLevel(interval)}`}
															key={`${interval.start_at}-${interval.end_at}-${interval.available_participant_ids.join("-")}`}
														>
															<strong>
																{timeLabel(interval.start_at, event.time_zone)}
																〜{timeLabel(interval.end_at, event.time_zone)}
															</strong>
															<span>
																{interval.available_participant_count}/
																{interval.total_participant_count}人
															</span>
														</div>
													))}
													{dayIntervals.length > 2 && (
														<span className="more-candidates">
															ほか{dayIntervals.length - 2}区間
														</span>
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
					</section>
				</div>
				<div className="results-right-column">
					<section className="candidate-summary candidate-options-panel">
						<div className="section-title-row">
							<div>
								<span className="page-eyebrow">TIME RANGES</span>
								<h2>集まれる時間帯</h2>
								<p>日付を選ぶと、連続して集まれる時間帯を確認できます。</p>
							</div>
						</div>
						{expandedDateKey ? (
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
										<span>{expandedIntervals.length}件の時間帯</span>
									</div>
									<button
										type="button"
										onClick={() => setExpandedDateKey(null)}
									>
										閉じる
									</button>
								</div>
								<div className="daily-interval-list">
									{expandedIntervals.length === 0 ? (
										<p className="daily-candidate-empty">
											この日に集まれる時間帯はありません
										</p>
									) : (
										expandedIntervals.map((interval) => (
											<div
												className={`daily-interval-row ${candidateAvailabilityLevel(interval)}`}
												key={`${interval.start_at}-${interval.end_at}-${interval.available_participant_ids.join("-")}`}
											>
												<i />
												<div>
													<strong>
														{timeLabel(interval.start_at, event.time_zone)}〜
														{timeLabel(interval.end_at, event.time_zone)}
													</strong>
													<small>
														{interval.available_participant_ids
															.map((id) => participantById.get(id))
															.filter(Boolean)
															.join("、") || "該当する参加者はいません"}
													</small>
												</div>
												<b>
													{interval.available_participant_count} /{" "}
													{interval.total_participant_count}人
												</b>
											</div>
										))
									)}
								</div>
							</div>
						) : (
							<div className="empty-state compact calendar-empty-state">
								<Icon name="clock" size={28} />
								<h3>カレンダーから日付を選択</h3>
								<p>
									{activeGroup && activeGroup.members.length === 0
										? "時間帯を集計するには、グループへ参加者を割り当ててください。"
										: "選択した日の、参加者が集まれる時間帯を表示します。"}
								</p>
								{isOrganizer &&
									activeGroup &&
									activeGroup.members.length === 0 && (
										<Link
											className="button button-secondary"
											to={`/events/${event.id}/manage`}
										>
											メンバーを割り当てる
										</Link>
									)}
							</div>
						)}
						{isOrganizer && (
							<div className="manual-confirmation-panel">
								<div className="manual-confirmation-heading">
									<span className="page-eyebrow">FINAL SCHEDULE</span>
									<h2>最終時刻を入力</h2>
									<p>
										日付は左のカレンダーから反映されます。開始時刻だけを入力してください。
									</p>
								</div>
								{confirmedStart && confirmedEnd ? (
									<div className="manual-confirmation-current">
										<strong>
											{formatDateRange(
												confirmedStart,
												confirmedEnd,
												event.time_zone,
											)}
										</strong>
										<Form method="post">
											<input
												type="hidden"
												name="group_id"
												value={activeGroup?.id ?? ""}
											/>
											<button
												className="button button-ghost cancel-confirmation-button"
												type="submit"
												name="intent"
												value="unconfirm"
												disabled={submitting}
											>
												{submitting ? "取り消しています…" : "確定を取り消す"}
											</button>
										</Form>
									</div>
								) : (
									<Form
										key={expandedDateKey ?? "no-date"}
										method="post"
										className="manual-confirmation-form"
									>
										<input
											type="hidden"
											name="group_id"
											value={activeGroup?.id ?? ""}
										/>
										<input
											type="hidden"
											name="duration_minutes"
											value={
												activeGroup?.duration_minutes ?? event.duration_minutes
											}
										/>
										<input
											type="hidden"
											name="confirmation_date"
											value={expandedDateKey ?? ""}
										/>
										<div className="manual-confirmation-date">
											<span>開催日</span>
											<strong>
												{expandedDateKey
													? new Intl.DateTimeFormat("ja-JP", {
															year: "numeric",
															month: "long",
															day: "numeric",
															weekday: "short",
															timeZone: "UTC",
														}).format(new Date(`${expandedDateKey}T00:00:00Z`))
													: "カレンダーから日付を選択"}
											</strong>
										</div>
										<label htmlFor="confirmation-time">開始時刻</label>
										<input
											id="confirmation-time"
											className="manual-confirmation-time"
											name="confirmation_time"
											type="text"
											inputMode="numeric"
											placeholder="例：19:00"
											pattern="(?:[01]\\d|2[0-3]):[0-5]\\d"
											autoComplete="off"
											required
										/>
										<small>
											必要時間：
											{minutesLabel(
												activeGroup?.duration_minutes ?? event.duration_minutes,
											)}
										</small>
										<button
											className="button button-primary"
											type="submit"
											name="intent"
											value="confirm"
											disabled={
												submitting ||
												event.status === "cancelled" ||
												!expandedDateKey
											}
										>
											{submitting ? "確定しています…" : "この日時で確定"}
										</button>
									</Form>
								)}
							</div>
						)}
					</section>
					<section className="availability-board">
						<div className="section-title-row">
							<div>
								<span className="page-eyebrow">RESPONSES</span>
								<h2>みんなの参加可能時間</h2>
							</div>
							<span className="response-count">
								<Icon name="users" size={16} /> {submitted} /{" "}
								{availability.length}
								人が回答
							</span>
						</div>
						<div className="participant-status availability-list">
							{availability.map(({ participant, intervals }) => (
								<article
									className="participant-availability-card"
									key={participant.id}
								>
									<div className="participant-identity">
										<span className="avatar navy">
											{participant.display_name.slice(0, 1)}
										</span>
										<div>
											<strong>{participant.display_name}</strong>
											<small>
												{participant.role === "organizer" ? "主催者" : "参加者"}
											</small>
										</div>
									</div>
									<div className="participant-availability-slots">
										<span>参加可能時間</span>
										<div className="availability-slot-list">
											{participant.response_status === "pending" ? (
												<small className="availability-empty">
													まだ回答していません
												</small>
											) : intervals.length === 0 ? (
												<small className="availability-empty">
													参加可能時間なし
												</small>
											) : (
												intervals.map((interval) => (
													<time
														key={`${interval.start_at}-${interval.end_at}`}
														dateTime={interval.start_at}
													>
														<Icon name="clock" size={14} />
														{formatDateRange(
															interval.start_at,
															interval.end_at,
															event.time_zone,
														)}
													</time>
												))
											)}
										</div>
									</div>
									<em
										className={
											participant.response_status === "submitted"
												? "participant-response-state done"
												: "participant-response-state pending"
										}
									>
										{participant.response_status === "submitted" && (
											<Icon name="check" size={14} />
										)}
										{participant.response_status === "submitted"
											? "回答済み"
											: "未回答"}
									</em>
								</article>
							))}
						</div>
					</section>
				</div>
			</div>
			{actionData && "error" in actionData && (
				<div className="form-error result-confirmation-message">
					<Icon name="info" size={17} />
					<strong>{actionData.error.message}</strong>
				</div>
			)}
			{actionData && "success" in actionData && (
				<div className="confirm-banner compact-banner result-confirmation-message">
					<Icon name="check" size={18} />
					<strong>{actionData.success}</strong>
				</div>
			)}
		</PageShell>
	);
}
