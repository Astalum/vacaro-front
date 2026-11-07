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

describe("invitation display name", () => {
	it.each(["registered", "guest"])(
		"joins with the event nickname without updating the existing %s profile",
		async (accountType) => {
			const account = {
				id: "user-1",
				display_name: "アカウントの名前",
				time_zone: "America/New_York",
				account_type: accountType,
			};
			const original = { ...account };
			const requests: { path: string; method: string; body: unknown }[] = [];
			vi.stubGlobal(
				"fetch",
				vi.fn(async (input, init?: RequestInit) => {
					const path = String(input);
					const method = init?.method ?? "GET";
					const body = init?.body ? JSON.parse(String(init.body)) : null;
					requests.push({ path, method, body });
					if (path.endsWith("/me")) {
						if (method === "PATCH") Object.assign(account, body);
						return new Response(JSON.stringify({ data: account }));
					}
					if (path.endsWith("/participants"))
						return new Response(
							JSON.stringify({
								data: { id: "participant-1", display_name: body.display_name },
							}),
							{ status: 201 },
						);
					return new Response(JSON.stringify({ data: { id: "event-1" } }));
				}),
			);
			const formData = new FormData();
			formData.set("display_name", "  イベント用ニックネーム  ");
			formData.set("time_zone", "Asia/Tokyo");
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
			expect(
				requests.find((entry) => entry.path.endsWith("/participants")),
			).toEqual({
				path: "/api/v1/invitations/invite-token/participants",
				method: "POST",
				body: { display_name: "イベント用ニックネーム" },
			});
			expect(account).toEqual(original);
			expect(requests.filter((entry) => entry.method !== "GET")).toHaveLength(
				1,
			);
		},
	);
	it("keeps the existing account name as an editable initial value", async () => {
		mockAPI("Asia/Tokyo");
		const loaded = await clientLoader({
			params: { inviteToken: "invite-token" },
		} as never);
		expect(loaded.displayName).toBe("User");
	});
});
