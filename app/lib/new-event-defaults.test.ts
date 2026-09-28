import { describe, expect, it } from "vitest";
import { getNewEventDefaults } from "./new-event-defaults";

describe("getNewEventDefaults", () => {
	it("uses the current date in Asia/Tokyo and applies the requested offsets", () => {
		const defaults = getNewEventDefaults(new Date("2026-09-25T15:30:00Z"));

		expect(defaults).toEqual({
			windowStartAt: "2026-10-03T09:00",
			windowEndAt: "2026-10-10T21:00",
			responseDeadlineAt: "2026-09-29T23:59",
		});
	});

	it("handles month and year boundaries", () => {
		const defaults = getNewEventDefaults(new Date("2026-12-27T03:00:00Z"));

		expect(defaults).toEqual({
			windowStartAt: "2027-01-03T09:00",
			windowEndAt: "2027-01-10T21:00",
			responseDeadlineAt: "2026-12-30T23:59",
		});
	});
});
