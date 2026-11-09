import { normalizeLocalDateTime } from "./time";

export type TimeRange = { id: string; start: string; end: string };
const DAY = 1440;
const wallMinute = (value: string) =>
	Date.parse(`${normalizeLocalDateTime(value)}Z`) / 60000;
const dateMinute = (date: string) => wallMinute(`${date}T00:00`);
const localValue = (minute: number) =>
	new Date(minute * 60000).toISOString().slice(0, 16);

// Move in the calendar's local dates and hours. UTC conversion remains at save.
export function moveAvailabilityRange(
	range: TimeRange,
	sourceDate: string,
	targetDate: string,
	minutes: number,
	firstDate: string,
	lastDate: string,
	dailyStart: number,
	dailyEnd: number,
): TimeRange {
	const start = wallMinute(range.start),
		end = wallMinute(range.end);
	const source = dateMinute(sourceDate);
	const visibleStart = Math.max(dailyStart, start - source);
	const visibleEnd = Math.min(dailyEnd, end - source);
	const vertical = Math.max(
		dailyStart - visibleStart,
		Math.min(dailyEnd - visibleEnd, Math.round(minutes / 30) * 30),
	);
	const minDay = Math.ceil(
		(dateMinute(firstDate) + dailyStart - start - vertical) / DAY,
	);
	const maxDay = Math.floor(
		(dateMinute(lastDate) + dailyEnd - end - vertical) / DAY,
	);
	if (minDay > maxDay) return range;
	const days = Math.max(
		minDay,
		Math.min(maxDay, (dateMinute(targetDate) - source) / DAY),
	);
	const shift = days * DAY + vertical;
	return {
		...range,
		start: localValue(start + shift),
		end: localValue(end + shift),
	};
}
