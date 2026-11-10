import { normalizeLocalDateTime } from "./time";

export const DEFAULT_TIME_ZONE = "Asia/Tokyo";

export function formatDateTime(value: string, timeZone = DEFAULT_TIME_ZONE) {
	return new Intl.DateTimeFormat("ja-JP", {
		timeZone,
		month: "long",
		day: "numeric",
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

export function formatDateRange(
	start: string,
	end: string,
	timeZone = DEFAULT_TIME_ZONE,
) {
	return `${formatDateTime(start, timeZone)} 〜 ${formatDateTime(end, timeZone)}`;
}

export function minutesLabel(minutes: number) {
	if (minutes < 60) return `${minutes}分`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours}時間${rest}分` : `${hours}時間`;
}

export const COMMON_TIME_ZONES = [
	"UTC",
	"Pacific/Honolulu",
	"America/Los_Angeles",
	"America/Denver",
	"America/Chicago",
	"America/New_York",
	"America/Toronto",
	"America/Sao_Paulo",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Africa/Johannesburg",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Bangkok",
	"Asia/Singapore",
	"Asia/Hong_Kong",
	"Asia/Shanghai",
	"Asia/Seoul",
	"Asia/Tokyo",
	"Australia/Perth",
	"Australia/Sydney",
	"Pacific/Auckland",
] as const;

export function isValidTimeZone(timeZone: string) {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format();
		return true;
	} catch {
		return false;
	}
}

function localDateTimeParts(value: string) {
	const normalized = normalizeLocalDateTime(value);
	if (!normalized) return null;
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
		normalized,
	);
	if (!match) return null;
	const [, year, month, day, hour, minute, second = "00"] = match;
	const values = [year, month, day, hour, minute, second].map(Number);
	const date = new Date(0);
	date.setUTCFullYear(values[0], values[1] - 1, values[2]);
	date.setUTCHours(values[3], values[4], values[5], 0);
	if (
		date.getUTCFullYear() !== values[0] ||
		date.getUTCMonth() !== values[1] - 1 ||
		date.getUTCDate() !== values[2] ||
		date.getUTCHours() !== values[3] ||
		date.getUTCMinutes() !== values[4] ||
		date.getUTCSeconds() !== values[5]
	) {
		return null;
	}
	return { values, wallClockUtc: date.getTime() };
}

function zonedParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((item) => item.type === type)?.value ?? "");
	return [
		part("year"),
		part("month"),
		part("day"),
		part("hour"),
		part("minute"),
		part("second"),
	];
}

export function localDateTimeToIso(
	value: FormDataEntryValue | null,
	timeZone = DEFAULT_TIME_ZONE,
) {
	if (typeof value !== "string" || !value) return null;
	const parsed = localDateTimeParts(value);
	if (!parsed || !isValidTimeZone(timeZone)) return null;

	let instant = parsed.wallClockUtc;
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const displayed = zonedParts(new Date(instant), timeZone);
		const offset =
			Date.UTC(
				displayed[0],
				displayed[1] - 1,
				displayed[2],
				displayed[3],
				displayed[4],
				displayed[5],
			) - instant;
		const adjusted = parsed.wallClockUtc - offset;
		if (adjusted === instant) break;
		instant = adjusted;
	}

	const date = new Date(instant);
	if (
		!zonedParts(date, timeZone).every(
			(part, index) => part === parsed.values[index],
		)
	) {
		return null;
	}
	return date.toISOString();
}

export function isoToLocalDateTime(
	value: string | null,
	timeZone = DEFAULT_TIME_ZONE,
) {
	if (!value || !isValidTimeZone(timeZone)) return "";
	const parts = zonedParts(new Date(value), timeZone);
	if (parts.some((part) => !Number.isFinite(part))) return "";
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}T${pad(parts[3])}:${pad(parts[4])}`;
}
