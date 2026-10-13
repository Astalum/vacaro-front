// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DatePicker } from "~/components/ui/date-picker";
import { TimePicker } from "~/components/ui/time-picker";
import {
	FieldError,
	ValidationMessage,
} from "~/components/ui/validation-message";

describe("custom form controls", () => {
	it("submits a date selected from the custom calendar", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<form>
				<label htmlFor="event-date">開催日</label>
				<DatePicker
					id="event-date"
					name="event_date"
					defaultValue="2026-06-14"
					required
				/>
			</form>,
		);

		await user.click(screen.getByLabelText("開催日"));
		await user.click(
			within(screen.getByRole("dialog")).getByRole("button", {
				name: /2026年6月15日/,
			}),
		);

		expect(
			new FormData(container.querySelector("form") as HTMLFormElement).get(
				"event_date",
			),
		).toBe("2026-06-15");
		expect(container.querySelector('input[type="date"]')).toBeNull();
	});

	it("submits a time selected from the custom hour and minute lists", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<form>
				<label htmlFor="event-time">開始時刻</label>
				<TimePicker id="event-time" name="event_time" defaultValue="09:00" />
			</form>,
		);

		await user.click(screen.getByLabelText("開始時刻"));
		await user.click(
			within(screen.getByRole("listbox", { name: "時" })).getByRole("option", {
				name: "10",
			}),
		);
		await user.click(
			within(screen.getByRole("listbox", { name: "分" })).getByRole("option", {
				name: "30",
			}),
		);
		await user.click(screen.getByRole("button", { name: "この時刻にする" }));

		expect(
			new FormData(container.querySelector("form") as HTMLFormElement).get(
				"event_time",
			),
		).toBe("10:30");
		expect(container.querySelector('input[type="time"]')).toBeNull();
	});

	it("announces summary and field validation errors", () => {
		render(
			<>
				<ValidationMessage title="日時を確認してください">
					終了時刻は開始時刻より後にしてください
				</ValidationMessage>
				<FieldError>イベント名を入力してください</FieldError>
			</>,
		);

		expect(screen.getByRole("alert").textContent).toContain(
			"日時を確認してください",
		);
		expect(screen.getByText("イベント名を入力してください")).toBeTruthy();
	});
});
