import { type PointerEvent, useEffect, useMemo, useState } from "react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { Icon, PageShell, WeekendText } from "~/components/app";
import { TimePicker } from "~/components/ui/time-picker";
import { ValidationMessage } from "~/components/ui/validation-message";
import {
	ApiError,
	type AvailabilityInterval,
	apiErrorData,
	apiRequest,
	apiRequestWithMeta,
	type CalendarAvailabilityWindow,
	type Event,
	formatDateRange,
	type GoogleCalendar,
	localDateTimeToIso,
	minutesLabel,
	savedCalendarAvailabilityWindow,
	savedCalendarIDs,
	type User,
} from "~/lib/api";
import type { Route } from "./+types/availability";

type TimeRange = { id: string; start: string; end: string };
type EntryMode = "available" | "unavailable";
type DragState = {
	date: string;
	pointerId: number;
	anchor: number;
	start: number;
	end: number;
};

const DAY_MINUTES = 24 * 60;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
type EventsPageMeta = { next_cursor: string | null };

async function listCopySourceEvents(targetEventID: string) {
	const events: Event[] = [];
	let cursor: string | null = null;
	do {
		const query = new URLSearchParams({ limit: "100" });
		if (cursor) query.set("cursor", cursor);
		const page = await apiRequestWithMeta<Event[], EventsPageMeta>(
			`/events?${query}`,
		);
		events.push(...page.data.filter((event) => event.id !== targetEventID));
		cursor = page.meta?.next_cursor ?? null;
	} while (cursor);
	return events;
}

function weekendClassName(day: number) {
	if (day === 0) return "weekday-sunday";
	if (day === 6) return "weekday-saturday";
	return undefined;
}

export function meta({ loaderData }: Route.MetaArgs) {
	return [
		{ title: `${loaderData?.event.title ?? "参加可能時間を回答"} | vacaro` },
	];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
	const [event, availability, calendarOptions, user, copySources] =
		await Promise.all([
			apiRequest<Event>(`/events/${params.eventId}`),
			apiRequest<{
				response_status: string;
				intervals: AvailabilityInterval[];
			}>(`/events/${params.eventId}/my-availability`),
			apiRequest<{ calendars: GoogleCalendar[] }>(
				"/integrations/google-calendar/calendars",
			)
				.then((result) => ({ calendars: result.calendars, error: null }))
				.catch((error: unknown) => ({
					calendars: [] as GoogleCalendar[],
					error: apiErrorData(error),
				})),
			apiRequest<User>("/me"),
			listCopySourceEvents(params.eventId)
				.then((events) => ({ events, error: null }))
				.catch((error: unknown) => ({
					events: [] as Event[],
					error: apiErrorData(error),
				})),
		]);
	return {
		event,
		availability,
		calendarOptions,
		user,
		copySourceEvents: copySources.events,
		copySourceEventsError: copySources.error,
	};
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	const intent = String(formData.get("intent") ?? "");
	try {
		if (intent === "copy-availability") {
			const result = await apiRequest<{
				response_status: string;
				intervals: AvailabilityInterval[];
			}>(`/events/${params.eventId}/my-availability/copy`, {
				method: "POST",
				body: JSON.stringify({
					source_event_id: String(formData.get("source_event_id") ?? ""),
				}),
			});
			return { kind: "copied" as const, intervals: result.intervals };
		}
		if (intent === "calendar-preview") {
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
			intent === "none"
				? []
				: (JSON.parse(
						String(formData.get("intervals") ?? "[]"),
					) as TimeRange[]);
		const timeZone = String(formData.get("time_zone") ?? "Asia/Tokyo");
		const intervals = ranges.map((range) => ({
			start_at: localDateTimeToIso(range.start, timeZone),
			end_at: localDateTimeToIso(range.end, timeZone),
		}));
		if (intervals.some((interval) => !interval.start_at || !interval.end_at)) {
			return data(
				{
					kind: "error" as const,
					error: {
						code: "invalid_time_zone_datetime",
						message: "イベントのタイムゾーンで日時を解釈できませんでした",
					},
				},
				{ status: 422 },
			);
		}
		await apiRequest<{
			response_status: string;
			intervals: AvailabilityInterval[];
		}>(`/events/${params.eventId}/my-availability`, {
			method: "PUT",
			body: JSON.stringify({ intervals }),
		});
		return redirect("/events");
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

export function invertRangesForWindow(
	ranges: TimeRange[],
	firstDate: string,
	lastDate: string,
	dailyStartMinute: number,
	dailyEndMinute: number,
) {
	const inverted: TimeRange[] = [];
	let key = firstDate;

	while (key <= lastDate) {
		const segments = ranges
			.map((range) => segmentOnDate(range, key))
			.filter((segment): segment is { start: number; end: number } =>
				Boolean(segment),
			)
			.map((segment) => ({
				start: Math.max(segment.start, dailyStartMinute),
				end: Math.min(segment.end, dailyEndMinute),
			}))
			.filter((segment) => segment.end > segment.start)
			.sort((a, b) => a.start - b.start);
		let cursor = dailyStartMinute;

		for (const segment of segments) {
			if (segment.start > cursor) {
				inverted.push({
					id: `inverse-${key}-${cursor}-${segment.start}`,
					start: dateTimeAtMinute(key, cursor),
					end: dateTimeAtMinute(key, segment.start),
				});
			}
			cursor = Math.max(cursor, segment.end);
		}

		if (cursor < dailyEndMinute) {
			inverted.push({
				id: `inverse-${key}-${cursor}-${dailyEndMinute}`,
				start: dateTimeAtMinute(key, cursor),
				end: dateTimeAtMinute(key, dailyEndMinute),
			});
		}
		key = addDays(key, 1);
	}

	return inverted;
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

function pointerMinutes(
	clientY: number,
	target: HTMLElement,
	visibleStart: number,
	visibleEnd: number,
) {
	const bounds = target.getBoundingClientRect();
	const visibleMinutes = visibleEnd - visibleStart;
	const value =
		visibleStart + ((clientY - bounds.top) / bounds.height) * visibleMinutes;
	return Math.max(
		visibleStart,
		Math.min(visibleEnd - 30, Math.floor(value / 30) * 30),
	);
}

function timeAxisMarks(start: number, end: number) {
	const marks = [start];
	let cursor = (Math.floor(start / 60) + 1) * 60;
	while (cursor < end) {
		marks.push(cursor);
		cursor += 60;
	}
	if (marks.at(-1) !== end) marks.push(end);
	return marks;
}

export function HydrateFallback() {
	return (
		<PageShell fullScreen showHeader showPersistentInviteUrl={false}>
			<div className="schedule-loading">回答内容を読み込んでいます…</div>
		</PageShell>
	);
}

export default function AvailabilityPage({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const {
		event,
		availability,
		calendarOptions,
		user,
		copySourceEvents,
		copySourceEventsError,
	} = loaderData;
	const navigation = useNavigation();
	const [calendarWindow] = useState(() => savedCalendarAvailabilityWindow());
	const selectedCalendarIDs = useMemo(
		() => savedCalendarIDs(calendarOptions.calendars),
		[calendarOptions.calendars],
	);
	const windowStart = localDateTime(event.window_start_at, event.time_zone);
	const windowEnd = localDateTime(event.window_end_at, event.time_zone);
	const dailyStartMinute = minutes(windowStart);
	const dailyEndMinute = windowEnd.endsWith("T00:00")
		? DAY_MINUTES
		: minutes(windowEnd);
	const dailyStartTime = time(dailyStartMinute);
	const dailyEndTime = time(dailyEndMinute);
	const importWindow = useMemo(
		() => ({
			start:
				calendarWindow.start > dailyStartTime
					? calendarWindow.start
					: dailyStartTime,
			end:
				calendarWindow.end < dailyEndTime ? calendarWindow.end : dailyEndTime,
		}),
		[calendarWindow.end, calendarWindow.start, dailyEndTime, dailyStartTime],
	);
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
	const [entryMode, setEntryMode] = useState<EntryMode>("available");
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
	const activeWeek = weekOptions[weekIndex] ?? weekStart(firstDate);
	const days = useMemo(
		() => Array.from({ length: 7 }, (_, index) => addDays(activeWeek, index)),
		[activeWeek],
	);
	const eventDates = useMemo(() => {
		const result: string[] = [];
		let cursor = firstDate;
		while (cursor <= lastDate) {
			result.push(cursor);
			cursor = addDays(cursor, 1);
		}
		return result;
	}, [firstDate, lastDate]);
	const copyCandidates = useMemo(
		() =>
			copySourceEvents.filter(
				(source) =>
					source.window_start_at < event.window_end_at &&
					source.window_end_at > event.window_start_at,
			),
		[copySourceEvents, event.window_end_at, event.window_start_at],
	);
	const [sourceEventID, setSourceEventID] = useState(
		() => copyCandidates[0]?.id ?? "",
	);
	const importedRanges = useMemo(() => {
		if (actionData?.kind === "preview") {
			return clipCalendarIntervals(
				actionData.intervals,
				event.time_zone,
				importWindow,
				windowStart,
				windowEnd,
			);
		}
		if (actionData?.kind === "copied") {
			return actionData.intervals.map((interval) => ({
				id: interval.id ?? crypto.randomUUID(),
				start: localDateTime(interval.start_at, event.time_zone),
				end: localDateTime(interval.end_at, event.time_zone),
			}));
		}
		return [];
	}, [actionData, event.time_zone, importWindow, windowEnd, windowStart]);

	useEffect(() => {
		if (actionData?.kind !== "preview" && actionData?.kind !== "copied") return;
		setEntryMode("available");
		setRanges(importedRanges);
		if (importedRanges[0]) {
			const importedDate = importedRanges[0].start.slice(0, 10);
			setSelectedDate(importedDate);
			setWeekIndex(Math.max(0, weekOptions.indexOf(weekStart(importedDate))));
		}
	}, [actionData, importedRanges, weekOptions]);

	const submissionRanges = useMemo(
		() =>
			entryMode === "available"
				? ranges
				: invertRangesForWindow(
						ranges,
						firstDate,
						lastDate,
						dailyStartMinute,
						dailyEndMinute,
					),
		[dailyEndMinute, dailyStartMinute, entryMode, firstDate, lastDate, ranges],
	);
	const changeEntryMode = (nextMode: EntryMode) => {
		if (nextMode === entryMode) return;
		setRanges((current) =>
			invertRangesForWindow(
				current,
				firstDate,
				lastDate,
				dailyStartMinute,
				dailyEndMinute,
			),
		);
		setEntryMode(nextMode);
		setDrag(null);
	};

	const allowedRange = (_key: string) => ({
		start: dailyStartMinute,
		end: dailyEndMinute,
	});
	const beginDrag = (pointer: PointerEvent<HTMLButtonElement>, key: string) => {
		if (pointer.button !== 0 || key < firstDate || key > lastDate) return;
		const value = pointerMinutes(
			pointer.clientY,
			pointer.currentTarget,
			dailyStartMinute,
			dailyEndMinute,
		);
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
		const value = pointerMinutes(
			pointer.clientY,
			pointer.currentTarget,
			dailyStartMinute,
			dailyEndMinute,
		);
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
				range.id === id
					? {
							...range,
							[field]:
								field === "end" && (value === "00:00" || value === "24:00")
									? `${addDays(key, 1)}T00:00`
									: `${key}T${value}`,
						}
					: range,
			),
		);

	const addDailyRange = () => {
		const allowed = allowedRange(selectedDate);
		const start = allowed.start;
		const end = allowed.end;
		if (end <= start) return;

		setRanges((current) =>
			mergeRanges(current, {
				id: crypto.randomUUID(),
				start: dateTimeAtMinute(selectedDate, start),
				end: dateTimeAtMinute(selectedDate, end),
			}),
		);
	};
	const selectedRanges = ranges.filter((range) =>
		segmentOnDate(range, selectedDate),
	);
	const visibleMinutes = Math.max(30, dailyEndMinute - dailyStartMinute);
	const scheduleGridHeight = Math.max(260, (visibleMinutes / 60) * 52);
	const mobileGridHeight = Math.max(360, (visibleMinutes / 60) * 42);
	const axisMarks = timeAxisMarks(dailyStartMinute, dailyEndMinute);
	const weekTitle = `${new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(dateFromKey(days[0]))} — ${new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric" }).format(dateFromKey(days[6]))}`;
	const selectedTitle = new Intl.DateTimeFormat("ja-JP", {
		month: "numeric",
		day: "numeric",
		weekday: "short",
	}).format(dateFromKey(selectedDate));
	const submitting = navigation.state === "submitting";
	const submittingIntent = navigation.formData?.get("intent");
	const renderCopyControl = (scope: "mobile" | "desktop") => (
		<section className="schedule-copy-control">
			<strong>別イベントの回答をコピー</strong>
			{user.account_type !== "registered" ? (
				<p>
					Googleログインすると、日時が重なる別イベントの回答をコピーできます。
					<a href="/api/v1/auth/google/start">Googleでログイン</a>
				</p>
			) : copySourceEventsError ? (
				<p>コピー元イベントを読み込めませんでした。</p>
			) : copyCandidates.length === 0 ? (
				<p>日時が重なるコピー元イベントはありません。</p>
			) : (
				<div>
					<label htmlFor={`copy-source-${scope}`}>コピー元</label>
					<select
						id={`copy-source-${scope}`}
						value={sourceEventID}
						onChange={(inputEvent) =>
							setSourceEventID(inputEvent.currentTarget.value)
						}
					>
						{copyCandidates.map((source) => (
							<option key={source.id} value={source.id}>
								{source.title}（
								{formatDateRange(
									source.window_start_at,
									source.window_end_at,
									source.time_zone,
								)}
								）
							</option>
						))}
					</select>
					<button
						type="submit"
						name="intent"
						value="copy-availability"
						disabled={submitting || !sourceEventID}
						title="現在の回答を残したまま、重なる日時の回答を追加します"
					>
						<Icon name="copy" size={15} />
						{submittingIntent === "copy-availability"
							? "コピー中…"
							: "回答をコピー"}
					</button>
				</div>
			)}
		</section>
	);

	return (
		<PageShell fullScreen showHeader showPersistentInviteUrl={false}>
			<Form method="post" className="schedule-page">
				<input
					type="hidden"
					name="intervals"
					value={JSON.stringify(submissionRanges)}
				/>
				<input
					type="hidden"
					name="calendar_ids"
					value={JSON.stringify(selectedCalendarIDs)}
				/>
				<input type="hidden" name="time_zone" value={event.time_zone} />
				<input type="hidden" name="source_event_id" value={sourceEventID} />

				<div className="schedule-mobile">
					<section className="schedule-mobile-event">
						<div className="schedule-mobile-event-heading">
							<span>日程調整</span>
							<h1>{event.title}</h1>
						</div>
						{event.description && <p>{event.description}</p>}
						<div className="schedule-mobile-summary">
							<div className="is-wide">
								<Icon name="calendar" size={17} />
								<span>調整期間</span>
								<strong>
									<WeekendText>
										{formatDateRange(
											event.window_start_at,
											event.window_end_at,
											event.time_zone,
										)}
									</WeekendText>
								</strong>
							</div>
							<div>
								<Icon name="clock" size={17} />
								<span>回答受付</span>
								<strong>
									{dailyStartTime}〜{dailyEndTime}
								</strong>
							</div>
							<div>
								<span>所要時間</span>
								<strong>{minutesLabel(event.duration_minutes)}</strong>
							</div>
						</div>
					</section>

					<section className="schedule-mobile-controls">
						<fieldset
							className="schedule-entry-mode"
							aria-label="回答する時間の選び方"
						>
							<button
								type="button"
								aria-pressed={entryMode === "available"}
								onClick={() => changeEntryMode("available")}
							>
								都合がいい時間
							</button>
							<button
								type="button"
								className="is-unavailable"
								aria-pressed={entryMode === "unavailable"}
								onClick={() => changeEntryMode("unavailable")}
							>
								都合が悪い時間
							</button>
						</fieldset>
						{calendarOptions.calendars.length > 0 ? (
							<button
								type="submit"
								name="intent"
								value="calendar-preview"
								className="schedule-import"
								disabled={submitting}
							>
								<Icon name="calendar" size={16} />
								{submittingIntent === "calendar-preview"
									? "読込中…"
									: "予定取込"}
							</button>
						) : (
							<Link
								className="schedule-settings-link"
								to="/account#calendar-settings"
							>
								カレンダー設定
							</Link>
						)}
					</section>
					{renderCopyControl("mobile")}

					<nav className="schedule-mobile-dates" aria-label="回答する日付">
						{eventDates.map((key) => {
							const date = dateFromKey(key);
							return (
								<button
									key={key}
									type="button"
									className={
										selectedDate === key
											? "schedule-mobile-date is-selected"
											: "schedule-mobile-date"
									}
									aria-pressed={selectedDate === key}
									onClick={() => {
										setSelectedDate(key);
										setWeekIndex(
											Math.max(0, weekOptions.indexOf(weekStart(key))),
										);
									}}
								>
									<small className={weekendClassName(date.getDay())}>
										{WEEKDAYS[date.getDay()]}
									</small>
									<strong>{date.getDate()}</strong>
								</button>
							);
						})}
					</nav>

					<div className="schedule-mobile-answer-grid">
						<section className="schedule-mobile-timeline">
							<header>
								<div>
									<span>
										{entryMode === "available"
											? "都合がいい時間"
											: "都合が悪い時間"}
										を選択
									</span>
								</div>
								<small>タップまたはドラッグ</small>
							</header>
							<div
								className="schedule-mobile-grid"
								style={{ height: mobileGridHeight }}
							>
								<div
									className="schedule-time-axis schedule-mobile-axis"
									aria-hidden="true"
								>
									{axisMarks.map((mark) => (
										<span
											key={mark}
											style={{
												top:
													((mark - dailyStartMinute) / visibleMinutes) * 100 +
													"%",
											}}
										>
											{time(mark)}
										</span>
									))}
								</div>
								<button
									type="button"
									className="schedule-day-column schedule-mobile-day"
									aria-label={
										selectedDate +
										"の" +
										(entryMode === "available" ? "都合がいい" : "都合が悪い") +
										"時間を選択"
									}
									onPointerDown={(pointerEvent) =>
										beginDrag(pointerEvent, selectedDate)
									}
									onPointerMove={moveDrag}
									onPointerUp={finishDrag}
									onPointerCancel={() => setDrag(null)}
								>
									{ranges.map((range) => {
										const segment = segmentOnDate(range, selectedDate);
										if (!segment) return null;
										const visibleStart = Math.max(
											segment.start,
											dailyStartMinute,
										);
										const visibleEnd = Math.min(segment.end, dailyEndMinute);
										if (visibleEnd <= visibleStart) return null;
										return (
											<i
												key={range.id}
												className={
													entryMode === "unavailable"
														? "schedule-range is-unavailable"
														: "schedule-range"
												}
												style={{
													top:
														((visibleStart - dailyStartMinute) /
															visibleMinutes) *
															100 +
														"%",
													height:
														((visibleEnd - visibleStart) / visibleMinutes) *
															100 +
														"%",
												}}
											/>
										);
									})}
									{drag?.date === selectedDate && (
										<i
											className={
												entryMode === "unavailable"
													? "schedule-range preview is-unavailable"
													: "schedule-range preview"
											}
											style={{
												top:
													((drag.start - dailyStartMinute) / visibleMinutes) *
														100 +
													"%",
												height: `${((drag.end - drag.start) / visibleMinutes) * 100}%`,
											}}
										/>
									)}
								</button>
							</div>
						</section>

						<section className="schedule-mobile-editor">
							<div className="schedule-editor-heading">
								<div>
									<span>選択中の日付</span>
									<h2>
										<WeekendText>{selectedTitle}</WeekendText>
									</h2>
								</div>
								{selectedRanges.length === 0 && (
									<button type="button" onClick={addDailyRange}>
										<Icon name="plus" size={15} />
										時間を設定
									</button>
								)}
							</div>
							{selectedRanges.length === 0 && (
								<p>
									この日の
									{entryMode === "available"
										? "都合がいい時間"
										: "都合が悪い時間"}
									を設定してください
								</p>
							)}
							{selectedRanges.map((range) => (
								<div className="schedule-time-row" key={range.id}>
									<TimePicker
										id={`desktop-range-${range.id}-start`}
										className="schedule-time-picker"
										aria-label="開始時刻"
										min={dailyStartTime}
										max={dailyEndTime}
										value={range.start.slice(11, 16)}
										onValueChange={(value) =>
											updateTime(range.id, "start", value, selectedDate)
										}
									/>
									<span>〜</span>
									<div
										className={
											endsAtDayBoundary(range, selectedDate)
												? "schedule-time-input is-end-of-day"
												: "schedule-time-input"
										}
									>
										<TimePicker
											id={`desktop-range-${range.id}-end`}
											className="schedule-time-picker"
											aria-label={
												endsAtDayBoundary(range, selectedDate)
													? "終了時刻 24:00"
													: "終了時刻"
											}
											min={dailyStartTime}
											max={dailyEndTime}
											allowEndOfDay={dailyEndTime === "24:00"}
											value={
												endsAtDayBoundary(range, selectedDate)
													? "24:00"
													: range.end.slice(11, 16)
											}
											onValueChange={(value) =>
												updateTime(range.id, "end", value, selectedDate)
											}
										/>
									</div>
									<button
										className="schedule-time-remove"
										type="button"
										aria-label="削除"
										onClick={() =>
											setRanges((current) =>
												current.filter((item) => item.id !== range.id),
											)
										}
									>
										<Icon name="trash" size={19} />
									</button>
								</div>
							))}
						</section>
					</div>

					{actionData?.kind === "preview" && (
						<p className="schedule-message success">
							予定から{importedRanges.length}件を取り込みました
						</p>
					)}
					{actionData?.kind === "copied" && (
						<p className="schedule-message success">
							別イベントの回答をコピーしました
						</p>
					)}
					{actionData?.kind === "error" && (
						<ValidationMessage compact title={actionData.error.message}>
							回答時間を確認して、もう一度お試しください。
						</ValidationMessage>
					)}

					<footer className="schedule-submit schedule-mobile-submit">
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
				</div>

				<section className="schedule-main">
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
										<span className={weekendClassName(index)}>
											{WEEKDAYS[index]}
										</span>
										<strong>{dateFromKey(key).getDate()}</strong>
									</button>
								);
							})}
						</div>
						<div className="schedule-scroll">
							<div
								className="schedule-grid"
								style={{ height: `${scheduleGridHeight}px` }}
							>
								<div className="schedule-time-axis" aria-hidden="true">
									{axisMarks.map((mark) => (
										<span
											key={mark}
											style={{
												top: `${((mark - dailyStartMinute) / visibleMinutes) * 100}%`,
											}}
										>
											{time(mark)}
										</span>
									))}
								</div>
								{days.map((key) => {
									const enabled = key >= firstDate && key <= lastDate;
									return (
										<button
											key={key}
											type="button"
											className="schedule-day-column"
											disabled={!enabled}
											aria-label={`${key}の${entryMode === "available" ? "都合がいい" : "都合が悪い"}時間を選択`}
											onPointerDown={(event) => beginDrag(event, key)}
											onPointerMove={moveDrag}
											onPointerUp={finishDrag}
											onPointerCancel={() => setDrag(null)}
										>
											{ranges.map((range) => {
												const segment = segmentOnDate(range, key);
												if (!segment) return null;
												const visibleStart = Math.max(
													segment.start,
													dailyStartMinute,
												);
												const visibleEnd = Math.min(
													segment.end,
													dailyEndMinute,
												);
												if (visibleEnd <= visibleStart) return null;
												return (
													<i
														key={range.id}
														className={`schedule-range${entryMode === "unavailable" ? " is-unavailable" : ""}`}
														style={{
															top: `${((visibleStart - dailyStartMinute) / visibleMinutes) * 100}%`,
															height: `${((visibleEnd - visibleStart) / visibleMinutes) * 100}%`,
														}}
													/>
												);
											})}
											{drag?.date === key && (
												<i
													className={`schedule-range preview${entryMode === "unavailable" ? " is-unavailable" : ""}`}
													style={{
														top: `${((drag.start - dailyStartMinute) / visibleMinutes) * 100}%`,
														height: `${((drag.end - drag.start) / visibleMinutes) * 100}%`,
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
								<WeekendText>
									{formatDateRange(
										event.window_start_at,
										event.window_end_at,
										event.time_zone,
									)}
								</WeekendText>
							</strong>
						</div>
						<div className="schedule-meta-pair">
							<div className="schedule-meta">
								<div className="schedule-meta-label">
									<Icon name="clock" size={18} />
									<span>回答受付</span>
								</div>
								<strong>
									{dailyStartTime}〜{dailyEndTime}
								</strong>
							</div>
							<div className="schedule-meta schedule-meta-duration">
								<div className="schedule-meta-label">
									<span>所要時間</span>
								</div>
								<strong className="schedule-duration-value">
									{minutesLabel(event.duration_minutes)}
								</strong>
							</div>
						</div>
					</section>
					<div className="schedule-guide">
						<fieldset
							className="schedule-entry-mode"
							aria-label="回答する時間の選び方"
						>
							<button
								type="button"
								aria-pressed={entryMode === "available"}
								onClick={() => changeEntryMode("available")}
							>
								都合がいい時間
							</button>
							<button
								type="button"
								className="is-unavailable"
								aria-pressed={entryMode === "unavailable"}
								onClick={() => changeEntryMode("unavailable")}
							>
								都合が悪い時間
							</button>
						</fieldset>
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
									: "予定を取り込む"}
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
					{renderCopyControl("desktop")}
					<section className="schedule-editor">
						<div className="schedule-editor-heading">
							<h2>
								<WeekendText>{selectedTitle}</WeekendText>
							</h2>
							{selectedRanges.length === 0 && (
								<button type="button" onClick={addDailyRange}>
									<Icon name="plus" size={15} />
									{entryMode === "available"
										? "都合がいい時間"
										: "都合が悪い時間"}
									を設定
								</button>
							)}
						</div>
						{selectedRanges.length === 0 && (
							<p>
								この日の
								{entryMode === "available"
									? "都合がいい時間"
									: "都合が悪い時間"}
								を設定してください
							</p>
						)}
						{selectedRanges.map((range) => (
							<div className="schedule-time-row" key={range.id}>
								<TimePicker
									id={`mobile-range-${range.id}-start`}
									className="schedule-time-picker"
									aria-label="開始時刻"
									min={dailyStartTime}
									max={dailyEndTime}
									value={range.start.slice(11, 16)}
									onValueChange={(value) =>
										updateTime(range.id, "start", value, selectedDate)
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
									<TimePicker
										id={`mobile-range-${range.id}-end`}
										className="schedule-time-picker"
										aria-label={
											endsAtDayBoundary(range, selectedDate)
												? "終了時刻 24:00"
												: "終了時刻"
										}
										min={dailyStartTime}
										max={dailyEndTime}
										allowEndOfDay={dailyEndTime === "24:00"}
										value={
											endsAtDayBoundary(range, selectedDate)
												? "24:00"
												: range.end.slice(11, 16)
										}
										onValueChange={(value) =>
											updateTime(range.id, "end", value, selectedDate)
										}
									/>
								</div>
								<button
									className="schedule-time-remove"
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

					{actionData?.kind === "preview" && (
						<p className="schedule-message success">
							{calendarWindow.start}〜{calendarWindow.end}の範囲から
							{importedRanges.length}件を取り込みました
						</p>
					)}
					{actionData?.kind === "copied" && (
						<p className="schedule-message success">
							別イベントの回答をコピーしました
						</p>
					)}
					{actionData?.kind === "error" && (
						<ValidationMessage compact title={actionData.error.message}>
							回答時間を確認して、もう一度お試しください。
						</ValidationMessage>
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
