export interface ICloudCalendar {
	id: string;
	summary: string;
	background_color?: string;
	is_vacaro: boolean;
}
export interface ICloudCalendarOptions {
	calendars: ICloudCalendar[];
	account: string;
}
export const ICLOUD_CALENDAR_SELECTION_STORAGE_KEY =
	"vacaro.icloud-calendar-selection";

export function savedICloudCalendarIDs(calendars: ICloudCalendar[]) {
	const available = new Set(calendars.map((calendar) => calendar.id));
	try {
		const parsed: unknown = JSON.parse(
			window.localStorage.getItem(ICLOUD_CALENDAR_SELECTION_STORAGE_KEY) ??
				"null",
		);
		if (Array.isArray(parsed)) {
			const selected = parsed.filter(
				(id): id is string => typeof id === "string" && available.has(id),
			);
			if (selected.length > 0) return selected;
		}
	} catch {
		/* Storage can be disabled in private browsing. */
	}
	const initial =
		calendars.find((calendar) => !calendar.is_vacaro) ?? calendars[0];
	return initial ? [initial.id] : [];
}
export function saveICloudCalendarIDs(ids: string[]) {
	try {
		window.localStorage.setItem(
			ICLOUD_CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify(ids),
		);
		return true;
	} catch {
		return false;
	}
}
export function clearSavedICloudCalendarIDs() {
	try {
		window.localStorage.removeItem(ICLOUD_CALENDAR_SELECTION_STORAGE_KEY);
	} catch {
		/* Optional preferences. */
	}
}
