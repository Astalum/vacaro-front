import { describe, expect, it } from "vitest";
import {
	isoToLocalDateTime,
	isValidTimeZone,
	localDateTimeToIso,
} from "~/lib/api";

describe("IANA time zone conversion", () => {
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
