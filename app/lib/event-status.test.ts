import { describe, expect, it } from "vitest";
import { eventDisplayStatus } from "./api";

describe("eventDisplayStatus", () => {
	const now = Date.parse("2026-09-27T00:00:00Z");

	it("keeps an open event green before its response deadline", () => {
		expect(
			eventDisplayStatus(
				{ status: "open", response_deadline_at: "2026-09-27T00:00:01Z" },
				now,
			),
		).toBe("open");
	});

	it("marks an open event as expired at or after its deadline", () => {
		expect(
			eventDisplayStatus(
				{ status: "open", response_deadline_at: "2026-09-27T00:00:00Z" },
				now,
			),
		).toBe("expired");
	});

	it("does not replace confirmed or cancelled states", () => {
		expect(
			eventDisplayStatus(
				{ status: "confirmed", response_deadline_at: "2026-09-26T00:00:00Z" },
				now,
			),
		).toBe("confirmed");
		expect(
			eventDisplayStatus(
				{ status: "cancelled", response_deadline_at: null },
				now,
			),
		).toBe("cancelled");
	});
});
