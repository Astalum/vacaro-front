// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { endOfDayInput, isTimeValue, normalizeLocalDateTime } from "~/lib/time";

const timeInputFiles = [
	"../../app/routes/events/new.tsx",
	"../../app/routes/events/edit.tsx",
	"../../app/routes/events/availability.tsx",
	"../../app/routes/events/results.tsx",
	"../../app/routes/calendars.tsx",
	"../../app/components/ui/date-time-picker.tsx",
];
describe("time input validation", () => {
	it.each(["00:00", "09:17", "12:34", "23:59", "24:00"])(
		"accepts valid clock time %s",
		(value) => {
			expect(isTimeValue(value)).toBe(true);
		},
	);

	it.each(["", "9:17", "24:01", "24:59", "25:00", "12:60", "12:34:56"])(
		"rejects invalid clock time %s",
		(value) => {
			expect(isTimeValue(value)).toBe(false);
		},
	);

	it.each(timeInputFiles)(
		"uses the custom time picker instead of native time inputs in %s",
		(file) => {
			const source = readFileSync(new URL(file, import.meta.url), "utf8");

			expect(source).toContain("TimePicker");
			expect(source).not.toContain('type="time"');
		},
	);

	it("offers every minute in the custom time picker", () => {
		const source = readFileSync(
			new URL("../../app/components/ui/time-picker.tsx", import.meta.url),
			"utf8",
		);
		expect(source).toContain("length: 60");
	});
});

describe("local end-of-day boundaries", () => {
	it.each([
		["2026-12-31T24:00", "2027-01-01T00:00"],
		["2028-02-29T24:00:00", "2028-03-01T00:00:00"],
		["2026-06-14T23:59:59", "2026-06-14T23:59:59"],
	])("normalizes %s before time zone conversion", (input, expected) => {
		expect(normalizeLocalDateTime(input)).toBe(expected);
	});
	it.each([
		"2026-02-30T24:00",
		"2026-06-14T24:01",
		"2026-06-14T24:00:01",
		"2026-06-14T25:00",
		"9999-12-31T24:00",
	])("rejects invalid boundaries: %s", (value) => {
		expect(normalizeLocalDateTime(value)).toBeNull();
	});
	it("restores an event window's inclusive end date for editing", () => {
		expect(endOfDayInput("2027-01-01T00:00")).toBe("2026-12-31T24:00");
		expect(endOfDayInput("2026-06-14T21:00")).toBe("2026-06-14T21:00");
	});
});
