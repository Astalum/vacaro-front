import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { data, Form, Link, useNavigation } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	ApiError,
	type AvailabilityInterval,
	apiErrorData,
	apiRequest,
	type CalendarAvailabilityWindow,
	type Event,
	formatDateRange,
	type GoogleCalendar,
	minutesLabel,
	savedCalendarAvailabilityWindow,
	savedCalendarIDs,
} from "../../lib/api";
import type { Route } from "./+types/availability";

type TimeRange = { id: string; start: string; end: string };
type DragState = {
	date: string;
	pointerId: number;
	anchor: number;
	start: number;
	end: number;
};

const DAY_MINUTES = 24 * 60;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{ title: `${loaderData?.event.title ?? "参加可能時間を回答"} | vacaro` },
	];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [event, availability, calendarOptions] = await Promise.all([
		apiRequest<Event>(`/events/${params.eventId}`),
		apiRequest<{ response_status: string; intervals: AvailabilityInterval[] }>(
			`/events/${params.eventId}/my-availability`,
		),
		apiRequest<{ calendars: GoogleCalendar[] }>(
			"/integrations/google-calendar/calendars",
		)
			.then((result) => ({ calendars: result.calendars, error: null }))
			.catch((error: unknown) => ({
				calendars: [] as GoogleCalendar[],
				error: apiErrorData(error),
			})),
	]);
	return { event, availability, calendarOptions };
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	try {
		if (formData.get("intent") === "calendar-preview") {
			const parsedCalendarIDs = JSON.parse(
				String(formData.get("calendar_ids") ?? "[]"),
			) as unknown;
			const calendarIDs = Array.isArray(parsedCalendarIDs)
				? parsedCalendarIDs.filter(
						(calendarID): calendarID is string =>
							typeof calendarID === "string" && calendarID.length > 0,
					)
				: [];
			const result = await apiRequest<{ intervals: AvailabilityInterval[] }>(
				`/events/${params.eventId}/google-calendar-availability/preview`,
				{
					method: "POST",
					body: JSON.stringify({
						calendar_ids: calendarIDs.length > 0 ? calendarIDs : ["primary"],
					}),
				},
			);
			return { kind: "preview" as const, intervals: result.intervals };
		}
		const ranges =
			formData.get("intent") === "none"
				? []
				: (JSON.parse(
						String(formData.get("intervals") ?? "[]"),
					) as TimeRange[]);
		const result = await apiRequest<{
			response_status: string;
			intervals: AvailabilityInterval[];
		}>(`/events/${params.eventId}/my-availability`, {
			method: "PUT",
			body: JSON.stringify({
				intervals: ranges.map((range) => ({
					start_at: new Date(range.start).toISOString(),
					end_at: new Date(range.end).toISOString(),
				})),
			}),
		});
		return { kind: "saved" as const, count: result.intervals.length };
	} catch (error) {
		return data(
			{ kind: "error" as const, error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

function localDateTime(value: string, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(value));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? "";
	return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function dateFromKey(key: string) {
	const [year, month, day] = key.split("-").map(Number);
	return new Date(year, month - 1, day, 12);
}

function dateKey(date: Date) {
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(key: string, days: number) {
	const date = dateFromKey(key);
	date.setDate(date.getDate() + days);
	return dateKey(date);
}

function weekStart(key: string) {
	const date = dateFromKey(key);
	date.setDate(date.getDate() - date.getDay());
	return dateKey(date);
}

function weeksBetween(start: string, end: string) {
	const result: string[] = [];
	let cursor = weekStart(start);
	const last = weekStart(end);
	while (cursor <= last) {
		result.push(cursor);
		cursor = addDays(cursor, 7);
	}
	return result;
}

function minutes(value: string) {
	const [hour, minute] = value.slice(11, 16).split(":").map(Number);
	return hour * 60 + minute;
}

function time(value: number) {
	return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

function dateTimeAtMinute(key: string, value: number) {
	return value === DAY_MINUTES
		? `${addDays(key, 1)}T00:00`
		: `${key}T${time(value)}`;
}

function endsAtDayBoundary(range: TimeRange, key: string) {
	return (
		range.end === `${key}T24:00` || range.end === `${addDays(key, 1)}T00:00`
	);
}

function segmentOnDate(range: TimeRange, key: string) {
	const startOfDay = `${key}T00:00`;
	const nextDay = `${addDays(key, 1)}T00:00`;
	if (range.start >= nextDay || range.end <= startOfDay) return null;
	const start = range.start <= startOfDay ? 0 : minutes(range.start);
	const end = range.end >= nextDay ? DAY_MINUTES : minutes(range.end);
	return end > start ? { start, end } : null;
}

function mergeRanges(ranges: TimeRange[], added: TimeRange) {
	let merged = added;
	let pending = ranges;
	let found = true;
	while (found) {
		found = false;
		const untouched: TimeRange[] = [];
		for (const range of pending) {
			if (range.start <= merged.end && range.end >= merged.start) {
				merged = {
					...merged,
					start: range.start < merged.start ? range.start : merged.start,
					end: range.end > merged.end ? range.end : merged.end,
				};
				found = true;
			} else untouched.push(range);
		}
		pending = untouched;
	}
	return [...pending, merged].sort((a, b) => a.start.localeCompare(b.start));
}

function clipCalendarIntervals(
	intervals: AvailabilityInterval[],
	timeZone: string,
	dailyWindow: CalendarAvailabilityWindow,
	eventStart: string,
	eventEnd: string,
) {
	const clipped: TimeRange[] = [];
	for (const interval of intervals) {
		const intervalStart = localDateTime(interval.start_at, timeZone);
		const intervalEnd = localDateTime(interval.end_at, timeZone);
		let key = intervalStart.slice(0, 10);
		const finalKey = intervalEnd.slice(0, 10);

		while (key <= finalKey) {
			const dailyStart = `${key}T${dailyWindow.start}`;
			const dailyEnd = `${key}T${dailyWindow.end}`;
			const start = [intervalStart, dailyStart, eventStart].reduce(
				(latest, value) => (value > latest ? value : latest),
			);
			const end = [intervalEnd, dailyEnd, eventEnd].reduce((earliest, value) =>
				value < earliest ? value : earliest,
			);
			if (start < end) {
				clipped.push({ id: crypto.randomUUID(), start, end });
			}
			key = addDays(key, 1);
		}
	}

	return clipped.sort((a, b) => a.start.localeCompare(b.start));
}

function pointerMinutes(clientY: number, target: HTMLElement) {
	const bounds = target.getBoundingClientRect();
	const value = ((clientY - bounds.top) / bounds.height) * DAY_MINUTES;
	return Math.max(0, Math.min(DAY_MINUTES - 30, Math.floor(value / 30) * 30));
}

export function HydrateFallback() {
	return (
		<PageShell fullScreen>
			<div className="schedule-loading">回答内容を読み込んでいます…</div>
		</PageShell>
	);
}

export default function AvailabilityPage({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { event, availability, calendarOptions } = loaderData;
	const navigation = useNavigation();
	const [calendarWindow] = useState(() => savedCalendarAvailabilityWindow());
	const selectedCalendarIDs = useMemo(
		() => savedCalendarIDs(calendarOptions.calendars),
		[calendarOptions.calendars],
	);
	const windowStart = localDateTime(event.window_start_at, event.time_zone);
	const windowEnd = localDateTime(event.window_end_at, event.time_zone);
	const firstDate = windowStart.slice(0, 10);
	const rawLastDate = windowEnd.slice(0, 10);
	const lastDate = windowEnd.endsWith("T00:00")
		? addDays(rawLastDate, -1)
		: rawLastDate;
	const [ranges, setRanges] = useState<TimeRange[]>(() =>
		availability.intervals.map((interval) => ({
			id: interval.id ?? crypto.randomUUID(),
			start: localDateTime(interval.start_at, event.time_zone),
			end: localDateTime(interval.end_at, event.time_zone),
		})),
	);
	const [selectedDate, setSelectedDate] = useState(
		() => ranges[0]?.start.slice(0, 10) ?? firstDate,
	);
	const weekOptions = useMemo(
		() => weeksBetween(firstDate, lastDate),
		[firstDate, lastDate],
	);
	const [weekIndex, setWeekIndex] = useState(() =>
		Math.max(0, weekOptions.indexOf(weekStart(selectedDate))),
	);
	const [drag, setDrag] = useState<DragState | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const activeWeek = weekOptions[weekIndex] ?? weekStart(firstDate);
	const days = useMemo(
		() => Array.from({ length: 7 }, (_, index) => addDays(activeWeek, index)),
		[activeWeek],
	);
	const importedRanges = useMemo(
		() =>
			actionData?.kind === "preview"
				? clipCalendarIntervals(
						actionData.intervals,
						event.time_zone,
						calendarWindow,
						windowStart,
						windowEnd,
					)
				: [],
		[actionData, calendarWindow, event.time_zone, windowEnd, windowStart],
	);

	useEffect(() => {
		if (actionData?.kind !== "preview") return;
		setRanges(importedRanges);
		if (importedRanges[0]) {
			const importedDate = importedRanges[0].start.slice(0, 10);
			setSelectedDate(importedDate);
			setWeekIndex(Math.max(0, weekOptions.indexOf(weekStart(importedDate))));
		}
	}, [actionData, importedRanges, weekOptions]);

	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const startMinute = days.includes(firstDate)
			? Math.max(
					minutes(windowStart),
					minutes(`2000-01-01T${calendarWindow.start}`),
				)
			: minutes(`2000-01-01T${calendarWindow.start}`);
		scroller.scrollTop = (startMinute / DAY_MINUTES) * 1248;
	}, [calendarWindow.start, days, firstDate, windowStart]);

	const allowedRange = (key: string) => ({
		start: key === firstDate ? minutes(windowStart) : 0,
		end:
			key === lastDate
				? windowEnd.endsWith("T00:00")
					? DAY_MINUTES
					: minutes(windowEnd)
				: DAY_MINUTES,
	});
	const beginDrag = (pointer: PointerEvent<HTMLButtonElement>, key: string) => {
		if (pointer.button !== 0 || key < firstDate || key > lastDate) return;
		const value = pointerMinutes(pointer.clientY, pointer.currentTarget);
		const allowed = allowedRange(key);
		if (value < allowed.start || value >= allowed.end) return;
		pointer.preventDefault();
		pointer.currentTarget.setPointerCapture(pointer.pointerId);
		setSelectedDate(key);
		setDrag({
			date: key,
			pointerId: pointer.pointerId,
			anchor: value,
			start: value,
			end: Math.min(value + 30, allowed.end),
		});
	};
	const moveDrag = (pointer: PointerEvent<HTMLButtonElement>) => {
		if (!drag || drag.pointerId !== pointer.pointerId) return;
		const value = pointerMinutes(pointer.clientY, pointer.currentTarget);
		const allowed = allowedRange(drag.date);
		setDrag((current) =>
			current
				? {
						...current,
						start: Math.max(allowed.start, Math.min(current.anchor, value)),
						end: Math.min(allowed.end, Math.max(current.anchor, value) + 30),
					}
				: null,
		);
	};
	const finishDrag = (pointer: PointerEvent<HTMLButtonElement>) => {
		if (!drag || drag.pointerId !== pointer.pointerId) return;
		const added = {
			id: crypto.randomUUID(),
			start: dateTimeAtMinute(drag.date, drag.start),
			end: dateTimeAtMinute(drag.date, drag.end),
		};
		setRanges((current) => mergeRanges(current, added));
		setDrag(null);
	};
	const updateTime = (
		id: string,
		field: "start" | "end",
		value: string,
		key: string,
	) =>
		setRanges((current) =>
			current.map((range) =>
				range.id === id ? { ...range, [field]: `${key}T${value}` } : range,
			),
		);

	const selectedRanges = ranges.filter((range) =>
		segmentOnDate(range, selectedDate),
	);
	const weekTitle = `${new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(dateFromKey(days[0]))} — ${new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric" }).format(dateFromKey(days[6]))}`;
	const selectedTitle = new Intl.DateTimeFormat("ja-JP", {
		month: "numeric",
		day: "numeric",
		weekday: "short",
	}).format(dateFromKey(selectedDate));
	const submitting = navigation.state === "submitting";
	const submittingIntent = navigation.formData?.get("intent");

	return (
		<PageShell fullScreen>
			<Form method="post" className="schedule-page">
				<input type="hidden" name="intervals" value={JSON.stringify(ranges)} />
				<input
					type="hidden"
					name="calendar_ids"
					value={JSON.stringify(selectedCalendarIDs)}
				/>
				<section className="schedule-main">
					<div className="schedule-guide">
						<span>
							カレンダーをドラッグして、空いている時間を追加してください
						</span>
						{calendarOptions.calendars.length > 0 ? (
							<button
								type="submit"
								name="intent"
								value="calendar-preview"
								className="schedule-import"
								disabled={submitting}
								title="現在の入力を、Googleカレンダーから読み取った空き時間で置き換えます"
							>
								<Icon name="calendar" size={16} />
								{submittingIntent === "calendar-preview"
									? "読み取り中…"
									: `${calendarWindow.start}〜${calendarWindow.end}を取り込む`}
							</button>
						) : (
							<Link
								className="schedule-settings-link"
								to="/account#calendar-settings"
							>
								カレンダー設定
							</Link>
						)}
					</div>
					<div className="schedule-calendar">
						<header className="schedule-toolbar">
							<button
								type="button"
								aria-label="前の週"
								disabled={weekIndex === 0}
								onClick={() => setWeekIndex((value) => value - 1)}
							>
								<Icon name="back" size={12} />
							</button>
							<strong>{weekTitle}</strong>
							<button
								type="button"
								aria-label="次の週"
								disabled={weekIndex === weekOptions.length - 1}
								onClick={() => setWeekIndex((value) => value + 1)}
							>
								<Icon name="chevron" size={12} />
							</button>
						</header>
						<div className="schedule-week-head">
							<div />
							{days.map((key, index) => {
								const enabled = key >= firstDate && key <= lastDate;
								return (
									<button
										key={key}
										type="button"
										className={selectedDate === key ? "is-selected" : ""}
										disabled={!enabled}
										onClick={() => setSelectedDate(key)}
									>
										<span>{WEEKDAYS[index]}</span>
										<strong>{dateFromKey(key).getDate()}</strong>
									</button>
								);
							})}
						</div>
						<div className="schedule-scroll" ref={scrollRef}>
							<div className="schedule-grid">
								<div className="schedule-time-axis" aria-hidden="true">
									{Array.from({ length: 24 }, (_, hour) => (
										<span
											key={time(hour * 60)}
											style={{ top: `${(hour / 24) * 100}%` }}
										>
											{time(hour * 60)}
										</span>
									))}
								</div>
								{days.map((key) => {
									const enabled = key >= firstDate && key <= lastDate;
									const allowed = allowedRange(key);
									return (
										<button
											key={key}
											type="button"
											className="schedule-day-column"
											disabled={!enabled}
											aria-label={`${key}の空き時間を選択`}
											onPointerDown={(event) => beginDrag(event, key)}
											onPointerMove={moveDrag}
											onPointerUp={finishDrag}
											onPointerCancel={() => setDrag(null)}
										>
											{enabled && allowed.start > 0 && (
												<i
													className="schedule-mask top"
													style={{
														height: `${(allowed.start / DAY_MINUTES) * 100}%`,
													}}
												/>
											)}
											{enabled && allowed.end < DAY_MINUTES && (
												<i
													className="schedule-mask bottom"
													style={{
														height: `${((DAY_MINUTES - allowed.end) / DAY_MINUTES) * 100}%`,
													}}
												/>
											)}
											{ranges.map((range) => {
												const segment = segmentOnDate(range, key);
												return segment ? (
													<i
														key={range.id}
														className="schedule-range"
														style={{
															top: `${(segment.start / DAY_MINUTES) * 100}%`,
															height: `${((segment.end - segment.start) / DAY_MINUTES) * 100}%`,
														}}
													/>
												) : null;
											})}
											{drag?.date === key && (
												<i
													className="schedule-range preview"
													style={{
														top: `${(drag.start / DAY_MINUTES) * 100}%`,
														height: `${((drag.end - drag.start) / DAY_MINUTES) * 100}%`,
													}}
												/>
											)}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				</section>

				<aside className="schedule-sidebar">
					<section className="schedule-event">
						<h1>{event.title}</h1>
						{event.description && <p>{event.description}</p>}
						<div className="schedule-meta">
							<div className="schedule-meta-label">
								<Icon name="calendar" size={18} />
								<span>調整期間</span>
							</div>
							<strong>
								{formatDateRange(
									event.window_start_at,
									event.window_end_at,
									event.time_zone,
								)}
							</strong>
						</div>
						<div className="schedule-meta">
							<div className="schedule-meta-label">
								<Icon name="clock" size={18} />
								<span>所要時間</span>
							</div>
							<strong className="schedule-duration-value">
								{minutesLabel(event.duration_minutes)}
							</strong>
						</div>
					</section>
					<section className="schedule-editor">
						<h2>{selectedTitle}</h2>
						{selectedRanges.length === 0 && <p>この日の空き時間はありません</p>}
						{selectedRanges.map((range) => (
							<div className="schedule-time-row" key={range.id}>
								<input
									type="time"
									aria-label="開始時刻"
									value={range.start.slice(11, 16)}
									onChange={(event) =>
										updateTime(
											range.id,
											"start",
											event.target.value,
											selectedDate,
										)
									}
								/>
								<span>〜</span>
								<div
									className={`schedule-time-input${
										endsAtDayBoundary(range, selectedDate)
											? " is-end-of-day"
											: ""
									}`}
								>
									<input
										type="time"
										aria-label={
											endsAtDayBoundary(range, selectedDate)
												? "終了時刻 24:00"
												: "終了時刻"
										}
										value={
											endsAtDayBoundary(range, selectedDate)
												? "00:00"
												: range.end.slice(11, 16)
										}
										onChange={(event) =>
											updateTime(
												range.id,
												"end",
												event.target.value,
												selectedDate,
											)
										}
									/>
									{endsAtDayBoundary(range, selectedDate) && (
										<span aria-hidden="true">24:00</span>
									)}
								</div>
								<button
									type="button"
									aria-label="削除"
									onClick={() =>
										setRanges((current) =>
											current.filter((item) => item.id !== range.id),
										)
									}
								>
									<Icon name="trash" size={20} />
								</button>
							</div>
						))}
					</section>
					{actionData?.kind === "saved" && (
						<p className="schedule-message success">回答を保存しました</p>
					)}
					{actionData?.kind === "preview" && (
						<p className="schedule-message success">
							{calendarWindow.start}〜{calendarWindow.end}の範囲から
							{importedRanges.length}件を取り込みました
						</p>
					)}
					{actionData?.kind === "error" && (
						<p className="schedule-message error">{actionData.error.message}</p>
					)}
					<footer className="schedule-submit">
						<button
							type="submit"
							name="intent"
							value="save"
							className="schedule-save"
							disabled={submitting || event.status !== "open"}
						>
							{submittingIntent === "save"
								? "保存しています…"
								: availability.response_status === "submitted"
									? "回答を更新"
									: "回答を保存"}
							<Icon name="arrow" size={13} />
						</button>
						<button
							type="submit"
							name="intent"
							value="none"
							className="schedule-none"
							disabled={submitting}
						>
							空き時間なしで回答
						</button>
					</footer>
				</aside>
			</Form>
		</PageShell>
	);
}
