import { expect, test } from "@playwright/test";
import { installFixtures } from "./fixtures";
import { layoutProblems } from "./geometry";

// Check either side of the navigation, availability and desktop breakpoints.
for (const width of [680, 681, 720, 721, 900, 901]) {
	for (const anonymous of [false, true]) {
		test(`${width}px ${anonymous ? "signed out" : "long display name"}`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 1000 });
			const { unknownRequests } = await installFixtures(page, {
				anonymous,
				longText: true,
			});
			const paths = anonymous
				? ["/", "/account", "/events/new"]
				: ["/", "/events/event-1/availability", "/events/event-1/results"];
			for (const path of paths) {
				await page.goto(path);
				await expect(
					page
						.locator("main h1:visible, main h2:visible, main h3:visible")
						.first(),
				).toBeVisible();
				await page.evaluate(() => document.fonts.ready);
				expect(await layoutProblems(page), `${width}px ${path}`).toEqual([]);
				if (width > 680) {
					const brand = await page.locator(".app-header .brand").boundingBox();
					const navigation = await page
						.locator("#site-navigation")
						.boundingBox();
					expect(brand).not.toBeNull();
					expect(navigation).not.toBeNull();
					if (brand && navigation)
						expect(brand.x + brand.width).toBeLessThanOrEqual(navigation.x + 2);
				}
			}
			expect(unknownRequests).toEqual([]);
		});
	}
}
