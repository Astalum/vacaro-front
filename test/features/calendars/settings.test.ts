import { afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "~/features/account/types";
import { loadCalendarSettings } from "~/features/calendars/settings";

function response(data: unknown) {
	return Promise.resolve(
		new Response(JSON.stringify({ data }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
	);
}

describe("calendar settings data", () => {
	afterEach(() => vi.restoreAllMocks());

	it("reports when an existing calendar connection needs write permission", async () => {
		const user = {
			id: "user-1",
			account_type: "registered",
			display_name: "User",
			time_zone: "Asia/Tokyo",
		} as User;
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL | Request) => {
				if (String(input).endsWith("/me")) return response(user);
				if (String(input).endsWith("/calendar-preference"))
					return response({ provider: "google" });
				return response({
					calendars: [
						{
							id: "primary",
							summary: "メインカレンダー",
							primary: true,
							selected: true,
						},
					],
					write_enabled: false,
				});
			}),
		);

		const loaded = await loadCalendarSettings(user);

		expect(loaded.calendarOptions.connectionStatus).toBe("connected");
		expect(loaded.calendarOptions.writeEnabled).toBe(false);
		expect(loaded.calendarOptions.calendars).toHaveLength(1);
	});
});
