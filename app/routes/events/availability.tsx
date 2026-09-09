import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { data, Form, useNavigation } from "react-router";
import { Icon, PageShell } from "../../components/ui";
import {
	ApiError,
	type AvailabilityInterval,
	apiErrorData,
	apiRequest,
	type Event,
	formatDateRange,
	minutesLabel,
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
	const [event, availability] = await Promise.all([
		apiRequest<Event>(`/events/${params.eventId}`),
		apiRequest<{ response_status: string; intervals: AvailabilityInterval[] }>(
			`/events/${params.eventId}/my-availability`,
		),
	]);
	return { event, availability };
}
clientLoader.hydrate = true as const;

export async function clientAction({
	params,
	request,
}: Route.ClientActionArgs) {
	const formData = await request.formData();
	try {
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
	const { event, availability } = loaderData;
	const navigation = useNavigation();
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

	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const startMinute = days.includes(firstDate)
			? minutes(windowStart)
			: 8 * 60;
		scroller.scrollTop = (startMinute / DAY_MINUTES) * 1248;
	}, [days, firstDate, windowStart]);

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
			start: `${drag.date}T${time(drag.start)}`,
			end: `${drag.date}T${time(drag.end)}`,
		};
		setRanges((current) => mergeRanges(current, added));
		setDrag(null);
	};
	const updateTime = (id: string, field: "start" | "end", value: string) =>
		setRanges((current) =>
			current.map((range) =>
				range.id === id
					? { ...range, [field]: `${range[field].slice(0, 10)}T${value}` }
					: range,
			),
		);

	const selectedRanges = ranges.filter((range) =>
		segmentOnDate(range, selectedDate),
	);
	const totalMinutes = ranges.reduce(
		(total, range) =>
			total +
			Math.max(
				0,
				(new Date(range.end).getTime() - new Date(range.start).getTime()) /
					60000,
			),
		0,
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
				<section className="schedule-main">
					<div className="schedule-guide">
						カレンダーをドラッグして、空いている時間を追加してください
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
											{!enabled && (
												<span className="schedule-outside-label">範囲外</span>
											)}
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
							<Icon name="calendar" size={15} />
							<div>
								<span>調整期間</span>
								<strong>
									{formatDateRange(
										event.window_start_at,
										event.window_end_at,
										event.time_zone,
									)}
								</strong>
							</div>
						</div>
						<div className="schedule-meta">
							<Icon name="clock" size={15} />
							<div>
								<span>所要時間</span>
								<strong>
									必要時間：{minutesLabel(event.duration_minutes)}
								</strong>
							</div>
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
										updateTime(range.id, "start", event.target.value)
									}
								/>
								<span>〜</span>
								<input
									type="time"
									aria-label="終了時刻"
									value={range.end.slice(11, 16)}
									onChange={(event) =>
										updateTime(range.id, "end", event.target.value)
									}
								/>
								<button
									type="button"
									aria-label="削除"
									onClick={() =>
										setRanges((current) =>
											current.filter((item) => item.id !== range.id),
										)
									}
								>
									<Icon name="trash" size={14} />
								</button>
							</div>
						))}
					</section>
					{actionData?.kind === "saved" && (
						<p className="schedule-message success">回答を保存しました</p>
					)}
					{actionData?.kind === "error" && (
						<p className="schedule-message error">{actionData.error.message}</p>
					)}
					<footer className="schedule-submit">
						<div>
							<span>回答内容</span>
							<strong>
								空き時間 {ranges.length}件・合計 {minutesLabel(totalMinutes)}
							</strong>
						</div>
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
