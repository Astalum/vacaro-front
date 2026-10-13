// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewEvent, { clientAction } from "~/routes/events/new";

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
		const resultsVisibility = screen.getByRole("switch", {
			name: /回答結果の公開/,
		}) as HTMLInputElement;
		expect(title.closest("form")?.noValidate).toBe(true);
		expect(resultsVisibility.checked).toBe(true);
		expect(screen.getByText("表示する")).toBeTruthy();
		expect(
			new FormData(title.closest("form") as HTMLFormElement).get(
				"results_visible_to_participants",
			),
		).toBe("true");
		await user.click(resultsVisibility);
		expect(resultsVisibility.checked).toBe(false);
		expect(screen.getByText("表示しない")).toBeTruthy();
		expect(
			new FormData(title.closest("form") as HTMLFormElement).get(
				"results_visible_to_participants",
			),
		).toBe("false");
		await user.click(resultsVisibility);
		const form = title.closest("form") as HTMLFormElement;
		expect(new FormData(form).get("daily_start_time")).toBe("09:00");
		expect(new FormData(form).get("daily_end_time")).toBe("21:00");
		expect(screen.getByLabelText(/毎日の受付開始/)).toBeTruthy();
		expect(screen.getByLabelText(/毎日の受付終了/)).toBeTruthy();
		expect(
			form.querySelector('input[type="date"], input[type="time"]'),
		).toBeNull();
		const duration = screen.getByRole("spinbutton", {
			name: /イベントに必要な時間/,
		}) as HTMLInputElement;
		expect(duration.min).toBe("5");
		expect(duration.max).toBe("1440");
		expect(duration.step).toBe("1");
		expect(
			new FormData(title.closest("form") as HTMLFormElement).get(
				"scheduling_mode",
			),
		).toBe("whole_event");

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
		expect(body.results_visible_to_participants).toBe(true);
		expect(body.scheduling_mode).toBe("whole_event");
	});

	it("accepts an arbitrary duration and converts another IANA time zone", async () => {
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
		formData.set("title", "海外チーム会議");
		formData.set("display_name", "主催者");
		formData.set("time_zone", "America/New_York");
		formData.set("window_start_date", "2026-07-01");
		formData.set("window_end_date", "2026-07-02");
		formData.set("daily_start_time", "09:00");
		formData.set("daily_end_time", "17:00");
		formData.set("duration_minutes", "37");
		formData.set("scheduling_mode", "groups");

		await clientAction({
			request: new Request("http://localhost/events/new", {
				method: "POST",
				body: formData,
			}),
		} as never);

		const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
		expect(body).toMatchObject({
			time_zone: "America/New_York",
			window_start_at: "2026-07-01T13:00:00.000Z",
			window_end_at: "2026-07-02T21:00:00.000Z",
			duration_minutes: 37,
			scheduling_mode: "groups",
		});
	});

	it("sends a disabled results visibility setting when the toggle is off", async () => {
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
		formData.set("title", "非公開イベント");
		formData.set("display_name", "主催者");
		formData.set("time_zone", "Asia/Tokyo");
		formData.set("window_start_date", "2026-10-02");
		formData.set("window_end_date", "2026-10-09");
		formData.set("daily_start_time", "09:00");
		formData.set("daily_end_time", "21:00");
		formData.set("duration_minutes", "60");
		formData.set("results_visible_to_participants", "false");

		await clientAction({
			request: new Request("http://localhost/events/new", {
				method: "POST",
				body: formData,
			}),
		} as never);

		const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
		expect(body.results_visible_to_participants).toBe(false);
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
