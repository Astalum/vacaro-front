import { afterEach, describe, expect, it, vi } from "vitest";
import { clientLoader } from "~/routes/account";

afterEach(() => vi.unstubAllGlobals());
const args = (suffix = "") =>
	({ request: new Request(`https://vacaro.test/account${suffix}`) }) as never;

describe("profile settings", () => {
	it("loads the profile without requesting calendar data", async () => {
		const user = {
			id: "user-1",
			account_type: "registered",
			display_name: "User",
			time_zone: "Asia/Tokyo",
		};
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ data: user }), {
					headers: { "Content-Type": "application/json" },
				}),
			);
		vi.stubGlobal("fetch", fetchMock);
		expect(await clientLoader(args())).toEqual({ user });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/me");
	});
	for (const result of ["connected", "permission_required", "error"]) {
		it(`forwards the Google calendar callback result: ${result}`, async () => {
			const fetchMock = vi.fn();
			vi.stubGlobal("fetch", fetchMock);
			const response = await clientLoader(args(`?google_calendar=${result}`));
			expect(response).toBeInstanceOf(Response);
			expect((response as Response).headers.get("Location")).toBe(
				`/calendars?google_calendar=${result}`,
			);
			expect(fetchMock).not.toHaveBeenCalled();
		});
	}
});
