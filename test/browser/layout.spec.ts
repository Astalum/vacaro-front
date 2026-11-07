import { expect, test } from "@playwright/test";
import { installFixtures, type Scenario, token } from "./fixtures";
import { layoutProblems } from "./geometry";

const cases: { name: string; path: string; scenario?: Scenario }[] = [
	{ name: "home", path: "/" },
	{ name: "privacy", path: "/privacy" },
	{ name: "terms", path: "/terms" },
	{ name: "account", path: "/account" },
	{
		name: "account signed out",
		path: "/account",
		scenario: { anonymous: true },
	},
	{ name: "account guest", path: "/account", scenario: { guest: true } },
	{
		name: "account disconnected",
		path: "/account",
		scenario: { calendarDisconnected: true },
	},
	{ name: "events", path: "/events" },
	{ name: "events empty", path: "/events", scenario: { empty: true } },
	{ name: "new event", path: "/events/new" },
	{
		name: "new event signed out",
		path: "/events/new",
		scenario: { anonymous: true },
	},
	{ name: "created event", path: "/events/event-1/created" },
	{
		name: "availability",
		path: "/events/event-1/availability",
		scenario: { guest: true },
	},
	{ name: "availability registered", path: "/events/event-1/availability" },
	{ name: "results", path: "/events/event-1/results" },
	{
		name: "results empty",
		path: "/events/event-1/results",
		scenario: { empty: true },
	},
	{
		name: "results restricted",
		path: "/events/event-1/results",
		scenario: { restricted: true },
	},
	{
		name: "results groups",
		path: "/events/event-1/results?group_id=group-1",
		scenario: { groups: true },
	},
	{
		name: "manage",
		path: "/events/event-1/manage",
		scenario: { groups: true },
	},
	{ name: "edit event", path: "/events/event-1/edit" },
	{ name: "confirmed", path: "/events/event-1/confirmed" },
	{
		name: "confirmed groups",
		path: "/events/event-1/confirmed",
		scenario: { groups: true },
	},
	{
		name: "confirmed disconnected",
		path: "/events/event-1/confirmed",
		scenario: { calendarDisconnected: true },
	},
	{
		name: "invitation",
		path: "/invitations/invite-token",
		scenario: { anonymous: true },
	},
	{ name: "response link error", path: "/responses/edit" },
	{ name: "response link valid", path: `/responses/edit#${token}` },
	{ name: "not found", path: "/not-a-page" },
	...[
		"account",
		"events",
		"created",
		"manage",
		"confirmed",
		"invitation",
		"availability",
	].map((name) => ({
		name: `${name} long content`,
		path:
			name === "account" || name === "events"
				? `/${name}`
				: name === "invitation"
					? "/invitations/invite-token"
					: `/events/event-1/${name}`,
		scenario: {
			longText: true,
			groups: name === "manage" || name === "confirmed",
		},
	})),
	{
		name: "results groups long content",
		path: "/events/event-1/results?group_id=group-1",
		scenario: { longText: true, groups: true },
	},
];

for (const entry of cases) {
	test(entry.name, async ({ page }, testInfo) => {
		const { unknownRequests } = await installFixtures(page, entry.scenario);
		await page.goto(entry.path);
		if (entry.name === "response link valid") {
			await expect(page).toHaveURL(/\/events\/event-1\/availability$/);
		}
		if (entry.name === "response link error") {
			await expect(
				page.getByRole("heading", { name: "回答を開けませんでした" }),
			).toBeVisible();
		}
		await expect(
			page.locator("main h1:visible, main h2:visible, main h3:visible").first(),
		).toBeVisible();
		await expect(page.locator(".root-error")).toHaveCount(0);
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(120);
		const problems = await layoutProblems(page);
		if (process.env.LAYOUT_SCREENSHOTS === "1") {
			await testInfo.attach("page", {
				body: await page.screenshot({ fullPage: true }),
				contentType: "image/png",
			});
		}
		await testInfo.attach("layout-measurements", {
			body: JSON.stringify(problems, null, 2),
			contentType: "application/json",
		});
		expect(
			unknownRequests,
			"All API requests should use known fixtures",
		).toEqual([]);
		expect(
			problems,
			"Visible content should fit its viewport and containers",
		).toEqual([]);
	});
}

for (const { name, path, selector } of [
	{ name: "date picker", path: "/events/new", selector: "#window-start-date" },
	{ name: "time picker", path: "/events/new", selector: "#daily-start-time" },
	{ name: "date time picker", path: "/events/new", selector: "#deadline" },
	{
		name: "account time picker",
		path: "/account",
		selector: "#calendar-window-start",
	},
	{
		name: "results time picker",
		path: "/events/event-1/results",
		selector: "#confirmation-time",
	},
]) {
	test(`${name} open`, async ({ page }) => {
		await installFixtures(page);
		await page.goto(path);
		await expect(
			page.locator("main h1:visible, main h2:visible").first(),
		).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		await page.locator(selector).click();
		await expect(page.locator("[data-slot='popover-content']")).toBeVisible();
		await page.waitForTimeout(200);
		expect(await layoutProblems(page)).toEqual([]);
	});
}

for (const longText of [false, true]) {
	test(`results selected day${longText ? " long content" : ""}`, async ({
		page,
	}) => {
		const { unknownRequests } = await installFixtures(page, { longText });
		await page.goto("/events/event-1/results");
		await page
			.getByRole("button", { name: /の時間帯を表示$/ })
			.first()
			.click();
		await expect(page.locator(".daily-interval-row").first()).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		expect(unknownRequests).toEqual([]);
		expect(await layoutProblems(page)).toEqual([]);
	});
}

test("results continuous count ranges", async ({ page }, testInfo) => {
	const { unknownRequests } = await installFixtures(page, {
		changingCounts: true,
	});
	await page.goto("/events/event-1/results");
	await page
		.getByRole("button", { name: /の時間帯を表示$/ })
		.first()
		.click();
	const rows = page.locator(".daily-interval-row");
	await expect(rows).toHaveCount(4);
	await expect(rows.locator("strong")).toHaveText([
		"09:00〜10:00",
		"10:00〜11:00",
		"11:00〜15:00",
		"15:00〜17:00",
	]);
	await expect(rows.locator(":scope > b")).toHaveText([
		"2 / 6人",
		"3 / 6人",
		"2 / 6人",
		"1 / 6人",
	]);
	await expect(rows.nth(2).locator("small")).toHaveText([
		"11:00〜12:00：山田 太郎、佐藤 花子",
		"12:00〜15:00：山田 太郎、鈴木 次郎",
	]);
	await page.evaluate(() => document.fonts.ready);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
	if (process.env.LAYOUT_SCREENSHOTS === "1")
		await testInfo.attach("continuous-ranges", {
			body: await page.screenshot({ fullPage: true }),
			contentType: "image/png",
		});
});

test("date time picker time panel", async ({ page }) => {
	await installFixtures(page);
	await page.goto("/events/new");
	await page.locator("#deadline").click();
	await page.getByRole("button", { name: /^時刻 / }).click();
	await expect(page.getByRole("listbox", { name: "時" })).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
	expect(await layoutProblems(page)).toEqual([]);
});

test("scheduling mode menu", async ({ page }) => {
	await installFixtures(page);
	await page.goto("/events/new");
	await page.locator("#scheduling-mode").click();
	await expect(page.locator("[data-slot='select-content']")).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(200);
	expect(await layoutProblems(page)).toEqual([]);
});

test("mobile navigation open", async ({ page }) => {
	test.skip(
		(page.viewportSize()?.width ?? 1440) > 680,
		"Desktop navigation is always visible",
	);
	await installFixtures(page, { longText: true });
	await page.goto("/");
	await expect(page.locator(".app-header .account-name")).toHaveText(
		/東京大阪合同チーム/,
	);
	await page.evaluate(() => document.fonts.ready);
	await page.getByRole("button", { name: "メニューを開く" }).click();
	await expect(page.locator("#site-navigation")).toBeVisible();
	expect(await layoutProblems(page)).toEqual([]);
});
