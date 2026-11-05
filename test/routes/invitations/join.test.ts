import { afterEach, describe, expect, it, vi } from "vitest";
import { clientAction, clientLoader } from "~/routes/invitations/join";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

function mockAPI(timeZone: string | null) {
	return vi.stubGlobal(
		"fetch",
		vi.fn(async (input) => {
			if (String(input).endsWith("/me")) {
				return timeZone === null
					? new Response(
							JSON.stringify({
								error: { code: "unauthorized", message: "No session" },
							}),
							{ status: 401 },
						)
					: new Response(
							JSON.stringify({
								data: { display_name: "User", time_zone: timeZone },
							}),
						);
			}
			return new Response(JSON.stringify({ data: { id: "event-1" } }));
		}),
	);
}

describe("invitation user time zone", () => {
	it.each([null, "America/New_York", "UTC"])(
		"uses the default or saved %s zone",
		async (savedTimeZone) => {
			mockAPI(savedTimeZone);
			const loaded = await clientLoader({
				params: { inviteToken: "invite-token" },
			} as never);
			expect(loaded.timeZone).toBe(savedTimeZone ?? "Asia/Tokyo");
		},
	);

	it("creates a guest with the Tokyo default when no zone was submitted", async () => {
		mockAPI(null);
		const formData = new FormData();
		formData.set("display_name", "Guest");
		const result = await clientAction({
			params: { inviteToken: "invite-token" },
			request: new Request("https://vacaro.test/invitations/invite-token", {
				method: "POST",
				body: formData,
			}),
		} as never);

		expect((result as Response).headers.get("Location")).toBe(
			"/events/event-1/availability",
		);
		const guestRequest = vi
			.mocked(fetch)
			.mock.calls.find(([input]) => input === "/api/v1/guest-sessions");
		expect(JSON.parse(String(guestRequest?.[1]?.body))).toEqual({
			display_name: "Guest",
			time_zone: "Asia/Tokyo",
		});
	});
});
