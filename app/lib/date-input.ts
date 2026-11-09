export function parseDateInput(value?: string) {
	const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return undefined;
	const [, year, month, day] = match;
	const date = new Date(0);
	date.setFullYear(Number(year), Number(month) - 1, Number(day));
	date.setHours(0, 0, 0, 0);
	return date.getFullYear() === Number(year) &&
		date.getMonth() === Number(month) - 1 &&
		date.getDate() === Number(day)
		? date
		: undefined;
}

export function serializeDateInput(date?: Date) {
	const pad = (value: number) => String(value).padStart(2, "0");
	return date
		? `${String(date.getFullYear()).padStart(4, "0")}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
		: "";
}

const weekdayFormatter = new Intl.DateTimeFormat("ja-JP", { weekday: "short" });

export function dateInputLabel(date: Date) {
	return `${String(date.getFullYear()).padStart(4, "0")}年${date.getMonth() + 1}月${date.getDate()}日(${weekdayFormatter.format(date)})`;
}
