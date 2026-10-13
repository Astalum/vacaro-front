// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isTimeValue, TIME_INPUT_STEP_SECONDS } from "~/lib/time";

const timeInputFiles = [
	"../../app/routes/events/new.tsx",
	"../../app/routes/events/edit.tsx",
	"../../app/routes/events/availability.tsx",
	"../../app/routes/events/results.tsx",
	"../../app/routes/account.tsx",
	"../../app/components/ui/date-time-picker.tsx",
];
const legacyThirtyMinuteStep = `step={${30 * 60}}`;

describe("time input validation", () => {
	it("uses one-minute increments", () => {
		expect(TIME_INPUT_STEP_SECONDS).toBe(60);
	});

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
		"uses minute precision for every time input in %s",
		(file) => {
			const source = readFileSync(new URL(file, import.meta.url), "utf8");
			const timeInputCount = source.match(/type="time"/g)?.length ?? 0;
			const minuteStepCount =
				source.match(/step=\{TIME_INPUT_STEP_SECONDS\}/g)?.length ?? 0;

			expect(timeInputCount).toBeGreaterThan(0);
			expect(minuteStepCount).toBe(timeInputCount);
			expect(source).not.toContain(legacyThirtyMinuteStep);
		},
	);
});
