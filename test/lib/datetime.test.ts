import { describe, expect, it } from "vitest";
import {
	DEFAULT_TIME_ZONE,
	formatDateTime,
	isoToLocalDateTime,
	isValidTimeZone,
	localDateTimeToIso,
} from "~/lib/datetime";

describe("IANA time zone conversion", () => {
	it.each([
		["2026-12-31T24:00", "Asia/Tokyo", "2026-12-31T15:00:00.000Z"],
		["2028-02-29T24:00:00", "UTC", "2028-03-01T00:00:00.000Z"],
		["2026-03-08T24:00", "America/New_York", "2026-03-09T04:00:00.000Z"],
		["2026-11-01T24:00", "America/New_York", "2026-11-02T05:00:00.000Z"],
	])(
		"converts %s in %s to the following local midnight",
		(input, zone, expected) => {
			expect(localDateTimeToIso(input, zone)).toBe(expected);
		},
	);
	it.each(["2026-02-30T24:00", "2026-06-14T24:01", "2026-06-14T24:00:01"])(
		"rejects invalid end-of-day input %s",
		(input) => {
			expect(localDateTimeToIso(input)).toBeNull();
		},
	);
	it("defaults user input and display to Tokyo while exchanging UTC instants", () => {
		expect(DEFAULT_TIME_ZONE).toBe("Asia/Tokyo");
		expect(localDateTimeToIso("2026-07-01T09:30")).toBe(
			"2026-07-01T00:30:00.000Z",
		);
		expect(isoToLocalDateTime("2026-07-01T23:30:00.000Z")).toBe(
			"2026-07-02T08:30",
		);
		expect(formatDateTime("2026-07-01T23:30:00.000Z")).toBe(
			formatDateTime("2026-07-01T23:30:00.000Z", "Asia/Tokyo"),
		);
	});

	it("preserves an explicitly selected UTC time zone", () => {
		expect(localDateTimeToIso("2026-07-01T09:30", "UTC")).toBe(
			"2026-07-01T09:30:00.000Z",
		);
		expect(isoToLocalDateTime("2026-07-01T23:30:00.000Z", "UTC")).toBe(
			"2026-07-01T23:30",
		);
	});

	it("converts local wall-clock time with the zone's daylight-saving offset", () => {
		expect(localDateTimeToIso("2026-07-01T09:00", "America/New_York")).toBe(
			"2026-07-01T13:00:00.000Z",
		);
		expect(localDateTimeToIso("2026-01-01T09:00", "America/New_York")).toBe(
			"2026-01-01T14:00:00.000Z",
		);
	});

	it("round-trips an instant in a non-Japanese time zone", () => {
		const iso = localDateTimeToIso("2026-07-01T09:30", "Europe/Paris");
		expect(iso).toBe("2026-07-01T07:30:00.000Z");
		expect(isoToLocalDateTime(iso, "Europe/Paris")).toBe("2026-07-01T09:30");
	});

	it("rejects invalid zones and wall-clock times skipped by DST", () => {
		expect(isValidTimeZone("Invalid/Zone")).toBe(false);
		expect(localDateTimeToIso("2026-01-01T09:00", "Invalid/Zone")).toBeNull();
		expect(
			localDateTimeToIso("2026-03-08T02:30", "America/New_York"),
		).toBeNull();
	});
});
