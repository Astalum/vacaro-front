export function isTimeValue(value: unknown): value is string {
	return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
