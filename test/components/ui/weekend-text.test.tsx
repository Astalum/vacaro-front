import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WeekendText } from "~/components/ui/weekend-text";

describe("WeekendText", () => {
	it("colors only Saturday and Sunday labels", () => {
		const { container } = render(
			<WeekendText>10月3日(土) 〜 10月4日(日)</WeekendText>,
		);

		expect(container.querySelector(".weekday-saturday")?.textContent).toBe(
			"(土)",
		);
		expect(container.querySelector(".weekday-sunday")?.textContent).toBe(
			"(日)",
		);
		expect(container.textContent).toBe("10月3日(土) 〜 10月4日(日)");
	});
});
