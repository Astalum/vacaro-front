const DEFAULT_TIME_ZONE = "Asia/Tokyo";

type DatePart = "year" | "month" | "day";

const pad = (value: number) => String(value).padStart(2, "0");

function datePartsInTimeZone(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(date);

	return Object.fromEntries(
		parts
			.filter((part): part is Intl.DateTimeFormatPart & { type: DatePart } =>
				["year", "month", "day"].includes(part.type),
			)
			.map((part) => [part.type, Number(part.value)]),
	) as Record<DatePart, number>;
}

function localDateTimeAfterDays(
	now: Date,
	days: number,
	time: `${number}:${number}`,
) {
	const { year, month, day } = datePartsInTimeZone(now, DEFAULT_TIME_ZONE);
	const target = new Date(Date.UTC(year, month - 1, day + days));

	return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}T${time}`;
}

export function getNewEventDefaults(now = new Date()) {
	return {
		windowStartAt: localDateTimeAfterDays(now, 7, "09:00"),
		windowEndAt: localDateTimeAfterDays(now, 14, "21:00"),
		responseDeadlineAt: localDateTimeAfterDays(now, 3, "23:59"),
	};
}
