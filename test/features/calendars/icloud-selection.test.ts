import { afterEach, describe, expect, it } from "vitest";
import {
	ICLOUD_CALENDAR_SELECTION_STORAGE_KEY,
	savedICloudCalendarIDs,
	saveICloudCalendarIDs,
} from "~/features/calendars/icloud-selection";
const calendars = [
	{ id: "personal", summary: "個人", is_vacaro: false },
	{ id: "vacaro", summary: "Vacaro", is_vacaro: true },
];
afterEach(() => window.localStorage.clear());
describe("iCloud calendar selections", () => {
	it("starts with a personal calendar and preserves a saved selection", () => {
		expect(savedICloudCalendarIDs(calendars)).toEqual(["personal"]);
		saveICloudCalendarIDs(["personal", "vacaro"]);
		expect(savedICloudCalendarIDs(calendars)).toEqual(["personal", "vacaro"]);
	});
	it("does not mix Google selections or retain unavailable calendars", () => {
		window.localStorage.setItem(
			"vacaro.calendar-selection",
			JSON.stringify(["google"]),
		);
		window.localStorage.setItem(
			ICLOUD_CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify(["old", "vacaro"]),
		);
		expect(savedICloudCalendarIDs(calendars)).toEqual(["vacaro"]);
		expect(window.localStorage.getItem("vacaro.calendar-selection")).toBe(
			JSON.stringify(["google"]),
		);
	});
});
