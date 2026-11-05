import { describe, expect, it } from "vitest";
import {
	DEFAULT_TIME_ZONE,
	formatDateTime,
	isoToLocalDateTime,
	isValidTimeZone,
	localDateTimeToIso,
} from "~/lib/api";

describe("IANA time zone conversion", () => {
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
