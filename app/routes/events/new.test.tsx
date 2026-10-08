// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewEvent, { clientAction } from "./new";

describe("NewEvent validation", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						error: { code: "unauthorized", message: "ログインが必要です" },
					}),
					{ status: 401, headers: { "Content-Type": "application/json" } },
				),
			),
		);
	});

	afterEach(() => vi.unstubAllGlobals());

	it("shows custom errors instead of the browser validation popup", async () => {
		const user = userEvent.setup();
		const RouterStub = createRoutesStub([
			{
				path: "/events/new",
				Component: NewEvent,
				loader: () => ({
					windowStartAt: "2026-10-02T09:00",
					windowEndAt: "2026-10-09T21:00",
					responseDeadlineAt: "2026-09-28T23:59",
				}),
			},
		]);

		render(<RouterStub initialEntries={["/events/new"]} />);

		const submitButton = await screen.findByRole("button", {
			name: /イベントを作成する/,
		});
		const title = screen.getByRole("textbox", { name: /イベント名/ });
		const owner = screen.getByRole("textbox", { name: /主催者名/ });
		expect(title.closest("form")?.noValidate).toBe(true);
		expect(
			(screen.getByLabelText(/毎日の受付開始/) as HTMLInputElement).value,
		).toBe("09:00");
		expect(
			(screen.getByLabelText(/毎日の受付開始/) as HTMLInputElement).step,
		).toBe("60");
		expect(
			(screen.getByLabelText(/毎日の受付終了/) as HTMLInputElement).value,
		).toBe("21:00");
		expect(
			(screen.getByLabelText(/毎日の受付終了/) as HTMLInputElement).step,
		).toBe("60");

		await user.click(submitButton);

		expect(screen.getByRole("alert").textContent).toContain(
			"未入力の項目が2件あります",
		);
		expect(screen.getByText("イベント名を入力してください")).toBeTruthy();
		expect(screen.getByText("主催者名を入力してください")).toBeTruthy();
		expect(title.getAttribute("aria-invalid")).toBe("true");
		expect(owner.getAttribute("aria-invalid")).toBe("true");
		expect(document.activeElement).toBe(title);

		await user.type(title, "秋の交流会");

		expect(screen.queryByText("イベント名を入力してください")).toBeNull();
		expect(screen.getByRole("alert").textContent).toContain(
			"未入力の項目が1件あります",
		);
	});

	it("combines the date range with the daily response window", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ data: { display_name: "主催者" } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						data: { id: "event-1", invite_url: "https://example.com/invite" },
					}),
					{ status: 201, headers: { "Content-Type": "application/json" } },
				),
			);
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("title", "秋の交流会");
		formData.set("display_name", "主催者");
		formData.set("time_zone", "Asia/Tokyo");
		formData.set("window_start_date", "2026-10-02");
		formData.set("window_end_date", "2026-10-09");
		formData.set("daily_start_time", "09:17");
		formData.set("daily_end_time", "21:43");
		formData.set("duration_minutes", "60");

		await clientAction({
			request: new Request("http://localhost/events/new", {
				method: "POST",
				body: formData,
			}),
		} as never);

		const eventRequest = fetchMock.mock.calls[1];
		const body = JSON.parse(String(eventRequest[1]?.body));
		expect(body.window_start_at).toBe("2026-10-02T00:17:00.000Z");
		expect(body.window_end_at).toBe("2026-10-09T12:43:00.000Z");
	});
	it("rejects a response deadline after the event window without calling the API", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const formData = new FormData();
		formData.set("title", "秋の交流会");
		formData.set("display_name", "主催者");
		formData.set("time_zone", "Asia/Tokyo");
		formData.set("window_start_date", "2026-10-02");
		formData.set("window_end_date", "2026-10-09");
		formData.set("daily_start_time", "09:00");
		formData.set("daily_end_time", "21:00");
		formData.set("duration_minutes", "60");
		formData.set("response_deadline_at", "2026-10-10T09:00");

		const result = await clientAction({
			request: new Request("http://localhost/events/new", {
				method: "POST",
				body: formData,
			}),
		} as never);

		expect(fetchMock).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			init: { status: 422 },
			data: {
				error: {
					message: "回答期限は調整期間の終了以前にしてください",
				},
			},
		});
	});
});
