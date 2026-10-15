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

	it("supports keyboard selection and enforces time boundaries including 24:00", async () => {
		const user = userEvent.setup();
		const { container } = render(
			<form>
				<TimePicker
					id="bounded-time"
					name="time"
					defaultValue="23:45"
					min="23:30"
					max="24:00"
					allowEndOfDay
				/>
			</form>,
		);
		await user.click(document.getElementById("bounded-time") as HTMLElement);
		const hours = within(screen.getByRole("listbox", { name: "時" }));
		expect(
			(hours.getByRole("option", { name: "22" }) as HTMLButtonElement).disabled,
		).toBe(true);
		hours.getByRole("option", { name: "23" }).focus();
		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(
			hours.getByRole("option", { name: "24" }),
		);
		const minutes = within(screen.getByRole("listbox", { name: "分" }));
		expect(
			(minutes.getByRole("option", { name: "01" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		await user.click(screen.getByRole("button", { name: "この時刻にする" }));
		expect(
			new FormData(container.querySelector("form") as HTMLFormElement).get(
				"time",
			),
		).toBe("24:00");
	});

	it("excludes disabled custom controls from form submission", () => {
		const { container } = render(
			<form>
				<DatePicker
					id="disabled-date"
					name="date"
					defaultValue="2026-06-14"
					disabled
				/>
				<TimePicker
					id="disabled-time"
					name="time"
					defaultValue="09:00"
					disabled
				/>
			</form>,
		);
		const data = new FormData(
			container.querySelector("form") as HTMLFormElement,
		);
		expect(data.has("date")).toBe(false);
		expect(data.has("time")).toBe(false);
	});
});
