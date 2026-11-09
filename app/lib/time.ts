export function isTimeValue(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/.test(value)
	);
}

// Normalize the calendar date before applying a time zone. Adding 24 hours to
// an instant would give the wrong local midnight across daylight-saving changes.
export function normalizeLocalDateTime(value: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::([0-5]\d))?$/.exec(
		value,
	);
	if (!match) return null;
	const [, year, month, day, hour, minute, second] = match;
	if (
		!isTimeValue(`${hour}:${minute}`) ||
		(hour === "24" && Number(second ?? 0) !== 0)
	)
		return null;
	const date = new Date(0);
	date.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
	date.setUTCHours(0, 0, 0, 0);
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() !== Number(month) - 1 ||
		date.getUTCDate() !== Number(day)
	)
		return null;
	if (hour === "24") date.setUTCDate(date.getUTCDate() + 1);
	if (date.getUTCFullYear() > 9999) return null;
	return `${date.toISOString().slice(0, 10)}T${hour === "24" ? "00" : hour}:${minute}${second === undefined ? "" : `:${second}`}`;
}

// An event window ending at midnight includes the preceding date through 24:00.
export function endOfDayInput(value: string): string {
	if (!value.endsWith("T00:00") || !normalizeLocalDateTime(value)) return value;
	const date = new Date(`${value}:00Z`);
	date.setUTCDate(date.getUTCDate() - 1);
	return `${date.toISOString().slice(0, 10)}T24:00`;
}
