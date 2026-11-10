import { describe, expect, it } from "vitest";
import {
	moveAvailabilityRange,
	type TimeRange,
} from "~/features/events/availability-range";
const range: TimeRange = {
	id: "range",
	start: "2026-11-11T11:00",
	end: "2026-11-11T13:00",
};
const move = (target: string, minutes: number) =>
	moveAvailabilityRange(
		range,
		"2026-11-11",
		target,
		minutes,
		"2026-11-10",
		"2026-11-15",
		540,
		1260,
	);
describe("availability range movement", () => {
	it("preserves duration when moving to another day and time", () =>
		expect(move("2026-11-13", 60)).toEqual({
			...range,
			start: "2026-11-13T12:00",
			end: "2026-11-13T14:00",
		}));
	it("stops at daily bounds without shortening the interval", () => {
		expect(move("2026-11-12", -999)).toMatchObject({
			start: "2026-11-12T09:00",
			end: "2026-11-12T11:00",
		});
		expect(move("2026-11-12", 999)).toMatchObject({
			start: "2026-11-12T19:00",
			end: "2026-11-12T21:00",
		});
	});
	it("stops at the event dates", () => {
		expect(move("2026-11-01", 0).start).toBe("2026-11-10T11:00");
		expect(move("2026-11-30", 0).start).toBe("2026-11-15T11:00");
	});
	it("retains midnight at the end of a day", () => {
		const late = {
			...range,
			start: "2026-11-11T22:00",
			end: "2026-11-12T00:00",
		};
		expect(
			moveAvailabilityRange(
				late,
				"2026-11-11",
				"2026-11-12",
				60,
				"2026-11-10",
				"2026-11-15",
				540,
				1440,
			),
		).toMatchObject({ start: "2026-11-12T22:00", end: "2026-11-13T00:00" });
	});
	it("moves local hours across a summer-time boundary", () => {
		const local = {
			...range,
			start: "2026-10-31T11:00",
			end: "2026-10-31T13:00",
		};
		expect(
			moveAvailabilityRange(
				local,
				"2026-10-31",
				"2026-11-01",
				0,
				"2026-10-25",
				"2026-11-10",
				540,
				1260,
			),
		).toMatchObject({ start: "2026-11-01T11:00", end: "2026-11-01T13:00" });
	});
});
