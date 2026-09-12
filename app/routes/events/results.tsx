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
			await apiRequest(confirmationPath, {
				method: "PUT",
				body: JSON.stringify({
					start_at: String(formData.get("start_at") ?? ""),
					end_at: String(formData.get("end_at") ?? ""),
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
	const [selectedCandidateKey, setSelectedCandidateKey] = useState(
		initialCandidate
			? `${initialCandidate.start_at}-${initialCandidate.end_at}`
			: null,
	);
	const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
	const firstCandidateKey = initialCandidate
		? `${initialCandidate.start_at}-${initialCandidate.end_at}`
		: null;
	const selectionContext = `${activeGroup?.id ?? "whole-event"}\u0000${initialMonth}\u0000${firstCandidateKey ?? ""}`;
	useEffect(() => {
		const [, nextMonth, nextCandidateKey] = selectionContext.split("\u0000");
		setActiveMonth(nextMonth);
		setSelectedCandidateKey(nextCandidateKey || null);
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
	const selectedCandidate = candidates.find(
		(candidate) =>
			`${candidate.start_at}-${candidate.end_at}` === selectedCandidateKey,
	);
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
								必要時間を確保できる時間を、参加可能人数順に表示しています。
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
										const dayCandidates = cell.inMonth
											? (candidatesByDate.get(cell.key) ?? [])
											: [];
										const outsideWindow =
											cell.key < startDateKey || cell.key > endDateKey;
										const clickableDate = cell.inMonth && !outsideWindow;
										const openDateCandidates = () => {
											if (!clickableDate) return;
											setExpandedDateKey(cell.key);
											if (dayCandidates.length === 0) {
												setSelectedCandidateKey(null);
												return;
											}
											const selectedOnThisDate = dayCandidates.some(
												(candidate) =>
													`${candidate.start_at}-${candidate.end_at}` ===
													selectedCandidateKey,
											);
											if (!selectedOnThisDate) {
												const [firstCandidate] = dayCandidates;
												if (firstCandidate) {
													setSelectedCandidateKey(
														`${firstCandidate.start_at}-${firstCandidate.end_at}`,
													);
												}
											}
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
														aria-label={`${cell.key}${dayCandidates.length > 0 ? "の候補を表示" : "を選択（候補なし）"}`}
														onClick={openDateCandidates}
													/>
												)}
												<span
													className={`schedule-day-number weekday-${cellIndex % 7}`}
												>
													{cell.day}
												</span>
												<div className="schedule-day-candidates">
													{dayCandidates.slice(0, 3).map((candidate) => {
														const key = `${candidate.start_at}-${candidate.end_at}`;
														return (
															<button
																className={`schedule-candidate ${candidateAvailabilityLevel(candidate)} ${selectedCandidateKey === key ? "selected" : ""}`}
																key={key}
																type="button"
																onClick={(clickEvent) => {
																	clickEvent.stopPropagation();
																	setSelectedCandidateKey(key);
																}}
															>
																<strong>
																	{timeLabel(
																		candidate.start_at,
																		event.time_zone,
																	)}
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
															onClick={(clickEvent) => {
																clickEvent.stopPropagation();
																openDateCandidates();
															}}
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
					</section>
				</div>
				<div className="results-right-column">
					<section className="candidate-summary candidate-options-panel">
						<div className="section-title-row">
							<div>
								<span className="page-eyebrow">CANDIDATES</span>
								<h2>候補を確認</h2>
								<p>日付を選ぶと、その日の候補を一覧で確認できます。</p>
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
									<button
										type="button"
										onClick={() => setExpandedDateKey(null)}
									>
										閉じる
									</button>
								</div>
								<div className="daily-candidate-list">
									{expandedCandidates.length === 0 ? (
										<p className="daily-candidate-empty">
											この日の候補はありません
										</p>
									) : (
										expandedCandidates.map((candidate) => {
											const key = `${candidate.start_at}-${candidate.end_at}`;
											return (
												<button
													className={
														selectedCandidateKey === key ? "selected" : ""
													}
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
										})
									)}
								</div>
							</div>
						)}
						{selectedCandidate ? (
							<div
								className={`selected-schedule-detail ${candidateAvailabilityLevel(selectedCandidate)}`}
							>
								<div className="selected-schedule-date">
									<small>
										{selectedCandidate.start_at === confirmedStart &&
										selectedCandidate.end_at === confirmedEnd
											? "確定した候補"
											: "選択中の候補"}
									</small>
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
								{isOrganizer && (
									<Form method="post" className="confirm-candidate-form">
										<input
											type="hidden"
											name="group_id"
											value={activeGroup?.id ?? ""}
										/>
										{confirmedStart ? (
											<button
												className="button button-ghost cancel-confirmation-button"
												type="submit"
												name="intent"
												value="unconfirm"
												disabled={submitting}
											>
												{submitting ? "取り消しています…" : "確定を取り消す"}
											</button>
										) : (
											<>
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
												<button
													className="button button-primary"
													type="submit"
													name="intent"
													value="confirm"
													disabled={submitting || event.status === "cancelled"}
												>
													{submitting ? "確定しています…" : "この候補で確定"}
												</button>
											</>
										)}
									</Form>
								)}
							</div>
						) : (
							<div className="empty-state compact calendar-empty-state">
								<Icon name="clock" size={28} />
								<h3>
									{activeGroup && activeGroup.members.length === 0
										? "このグループにはメンバーがいません"
										: expandedDateKey
											? "この日の共通候補はありません"
											: "この月の共通候補はまだありません"}
								</h3>
								<p>
									{activeGroup && activeGroup.members.length === 0
										? "候補を集計するには、グループへ参加者を割り当ててください。"
										: "参加者の回答が増えると、カレンダーに候補が表示されます。"}
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
			{isOrganizer && confirmedStart && (
				<section className="result-confirmation-panel result-confirmation-footer">
					<div>
						<span className="page-eyebrow">CONFIRM</span>
						<h2>{activeGroup ? `${activeGroup.name}の日程` : "開催日時"}</h2>
						<p>
							{confirmedStart && confirmedEnd
								? formatDateRange(confirmedStart, confirmedEnd, event.time_zone)
								: "候補を選択して開催日時を確定してください。"}
						</p>
					</div>
					<Form method="post">
						<input
							type="hidden"
							name="group_id"
							value={activeGroup?.id ?? ""}
						/>
						<button
							className="button button-ghost"
							type="submit"
							name="intent"
							value="unconfirm"
							disabled={submitting}
						>
							{submitting ? "取り消しています…" : "確定を取り消す"}
						</button>
					</Form>
				</section>
			)}
		</PageShell>
	);
}
