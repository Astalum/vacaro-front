// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isTimeValue } from "~/lib/time";

const timeInputFiles = [
	"../../app/routes/events/new.tsx",
	"../../app/routes/events/edit.tsx",
	"../../app/routes/events/availability.tsx",
	"../../app/routes/events/results.tsx",
	"../../app/routes/account.tsx",
	"../../app/components/ui/date-time-picker.tsx",
];
describe("time input validation", () => {
	it.each(["00:00", "09:17", "12:34", "23:59"])(
		"accepts valid clock time %s",
		(value) => {
			expect(isTimeValue(value)).toBe(true);
		},
	);

	it.each(["", "9:17", "24:00", "12:60", "12:34:56"])(
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
