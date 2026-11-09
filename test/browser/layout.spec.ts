import { expect, test } from "@playwright/test";
import { installFixtures, type Scenario, token } from "./fixtures";
import { layoutProblems } from "./geometry";

const cases: { name: string; path: string; scenario?: Scenario }[] = [
	{
		name: "edit event through midnight",
		path: "/events/event-1/edit",
		scenario: { endOfDay: true },
	},
	{
		name: "availability through midnight",
		path: "/events/event-1/availability",
		scenario: { endOfDay: true },
	},
	{ name: "calendars", path: "/account#calendar-settings" },
	{
		name: "calendars guest",
		path: "/account#calendar-settings",
		scenario: { guest: true },
	},
	{
		name: "calendars signed out",
		path: "/account#calendar-settings",
		scenario: { anonymous: true },
	},
	{
		name: "calendars long content",
		path: "/account#calendar-settings",
		scenario: { longText: true },
	},
	{ name: "TimeTree setup", path: "/account#timetree-guide" },
	{
		name: "TimeTree setup signed out",
		path: "/account#timetree-guide",
		scenario: { anonymous: true },
	},
	{
		name: "iCloud settings disconnected",
		path: "/account#calendar-settings",
		scenario: { provider: "icloud" },
	},
	{
		name: "iCloud settings connected",
		path: "/account#calendar-settings",
		scenario: { icloudConnected: true },
	},
	{
		name: "iCloud settings long content",
		path: "/account#calendar-settings",
		scenario: { icloudConnected: true, longText: true },
	},
	{
		name: "iCloud availability",
		path: "/events/event-1/availability",
		scenario: { icloudConnected: true, calendarDisconnected: true },
	},
	{
		name: "iCloud availability with Google credentials",
		path: "/events/event-1/availability",
		scenario: { icloudConnected: true },
	},
	{
		name: "iCloud confirmed",
		path: "/events/event-1/confirmed",
		scenario: { icloudConnected: true },
	},
	{
		name: "iCloud confirmed groups",
		path: "/events/event-1/confirmed",
		scenario: { icloudConnected: true, groups: true },
	},
	{
		name: "calendars dedicated calendar reconnect",
		path: "/account#calendar-settings",
		scenario: { calendarWritePermissionRequired: true },
	},
	{
		name: "confirmed dedicated calendar reconnect",
		path: "/events/event-1/confirmed",
		scenario: { calendarWritePermissionRequired: true },
	},
	{ name: "home", path: "/" },
	{ name: "privacy", path: "/privacy" },
	{ name: "terms", path: "/terms" },
	{ name: "account", path: "/account" },
	{
		name: "calendars consent error",
		path: "/account?google_calendar=permission_required",
	},
	{
		name: "account signed out",
		path: "/account",
		scenario: { anonymous: true },
	},
	{ name: "account guest", path: "/account", scenario: { guest: true } },
	{
		name: "calendars disconnected",
		path: "/account#calendar-settings",
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

test("calendar settings stay inside the user page and retain saved selections", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page);
	await page.goto("/account");
	await expect(
		page.getByRole("heading", { name: "表示とタイムゾーン" }),
	).toBeVisible();
	await expect(page.locator(".settings-calendar-option")).toHaveCount(3);
	await expect(page.locator('button[value="calendar-connect"]')).toHaveCount(1);
	await expect(
		page.getByRole("link", { name: "カレンダー設定", exact: true }),
	).toHaveCount(0);
	await page.locator(".settings-calendar-option").nth(1).click();
	await page
		.locator("#calendar-settings")
		.getByRole("button", { name: "設定を保存", exact: true })
		.click();
	await expect(
		page.getByText("使用するカレンダーを保存しました"),
	).toBeVisible();
	await page.reload();
	await expect(
		page.locator(".settings-calendar-option input:checked"),
	).toHaveCount(2);
	await expect(page).toHaveURL(/\/account$/);
	expect(unknownRequests).toEqual([]);
});

test("legacy calendar links and OAuth results stay on the user page", async ({
	page,
	baseURL,
}) => {
	const { unknownRequests } = await installFixtures(page);
	for (const [oldPath, newPath] of [
		["/calendars", "/account#calendar-settings"],
		["/calendars/icloud", "/account#calendar-settings"],
		["/calendars/timetree", "/account#timetree-guide"],
		["/account/icloud", "/account#calendar-settings"],
		["/account/timetree", "/account#timetree-guide"],
		["/account#calendar-settings", "/account#calendar-settings"],
		["/account#google-calendar", "/account#google-calendar"],
		[
			"/calendars?google_calendar=permission_required",
			"/account?google_calendar=permission_required#calendar-settings",
		],
	]) {
		await page.goto(oldPath);
		await expect(page).toHaveURL(new URL(newPath, baseURL).href);
	}
	await expect(
		page.getByText("Googleカレンダーに接続できませんでした", { exact: true }),
	).toBeVisible();
	expect(unknownRequests).toEqual([]);
});

test("24:00 is selectable in event times, deadlines, and calendar preferences", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page);
	await page.goto("/events/new");
	await page.locator("#daily-end-time").click();
	await page
		.getByRole("listbox", { name: "時", exact: true })
		.getByRole("option", { name: "24", exact: true })
		.click();
	await expect(
		page
			.getByRole("listbox", { name: "分", exact: true })
			.getByRole("option", { name: "01", exact: true }),
	).toBeDisabled();
	await page.getByRole("button", { name: "この時刻にする" }).click();
	await expect(page.locator('input[name="daily_end_time"]')).toHaveValue(
		"24:00",
	);
	await page.locator("#deadline").click();
	await page.getByRole("button", { name: /^時刻 / }).click();
	await page
		.getByRole("listbox", { name: "時", exact: true })
		.getByRole("option", { name: "24", exact: true })
		.click();
	await page.getByRole("button", { name: "この時刻にする" }).click();
	await page.getByRole("button", { name: "決定", exact: true }).click();
	await expect(page.locator('input[name="response_deadline_at"]')).toHaveValue(
		/T24:00$/,
	);
	await page.goto("/account#calendar-settings");
	await page.locator("#calendar-window-end").click();
	await page
		.getByRole("listbox", { name: "時", exact: true })
		.getByRole("option", { name: "24", exact: true })
		.click();
	await page.getByRole("button", { name: "この時刻にする" }).click();
	await page.getByRole("button", { name: "取り込み範囲を保存" }).click();
	await page.reload();
	await expect(page.locator("#calendar-window-end")).toContainText("24:00");
	expect(unknownRequests).toEqual([]);
});

test("editing a midnight event preserves its end instant", async ({ page }) => {
	const { unknownRequests } = await installFixtures(page, { endOfDay: true });
	const eventResponse = page.waitForResponse(
		(r) =>
			r.url().endsWith("/api/v1/events/event-1") &&
			r.request().method() === "GET",
	);
	await page.goto("/events/event-1/edit");
	const { data: event } = await (await eventResponse).json();
	await expect(page.locator('input[name="daily_end_time"]')).toHaveValue(
		"24:00",
	);
	const submitted = page.waitForRequest(
		(r) => r.url().endsWith("/api/v1/events/event-1") && r.method() === "PATCH",
	);
	await page.locator('form.form-stack button[type="submit"]').last().click();
	const body = (await submitted).postDataJSON();
	expect(new Date(body.window_end_at).toISOString()).toBe(
		new Date(event.window_end_at).toISOString(),
	);
	expect(unknownRequests).toEqual([]);
});

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
		name: "calendars time picker",
		path: "/account#calendar-settings",
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

test("calendar import failure keeps the answer and links to settings", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page, {
		calendarImportError: "calendar_unavailable",
	});
	await page.goto("/events/event-1/availability");
	const answer = page.locator('input[name="intervals"]');
	const before = await answer.inputValue();
	await page.locator('button[value="calendar-preview"]:visible').click();
	await expect(
		page
			.getByRole("link", { name: "カレンダー設定を確認する" })
			.filter({ visible: true }),
	).toBeVisible();
	await expect(answer).toHaveValue(before);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("calendar import still succeeds with a valid connection", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page);
	await page.goto("/events/event-1/availability");
	await page.locator('button[value="calendar-preview"]:visible').click();
	await expect(page.locator(".schedule-message.success:visible")).toContainText(
		"件を取り込みました",
	);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("calendar import initially selects only the primary calendar", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page);
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="calendar_ids"]')).toHaveValue(
		'["calendar-0"]',
	);
	expect(unknownRequests).toEqual([]);
});

test("holiday calendars are excluded from saved selections and the settings list", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page);
	await page.addInitScript(() =>
		localStorage.setItem(
			"vacaro.calendar-selection",
			JSON.stringify([
				"calendar-0",
				"calendar-1",
				"ja.japanese.official#holiday@group.v.calendar.google.com",
			]),
		),
	);
	await page.goto("/account#calendar-settings");
	await expect(page.locator(".settings-calendar-option")).toHaveCount(3);
	await expect(
		page.locator(".settings-calendar-option input:checked"),
	).toHaveCount(2);
	await expect(page.getByText("日本の祝日", { exact: true })).toHaveCount(0);
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="calendar_ids"]')).toHaveValue(
		'["calendar-0","calendar-1"]',
	);
	const request = page.waitForRequest(
		(r) =>
			r.url().endsWith("/google-calendar-availability/preview") &&
			r.method() === "POST",
	);
	await page.locator('button[value="calendar-preview"]:visible').click();
	expect((await request).postDataJSON()).toEqual({
		calendar_ids: ["calendar-0", "calendar-1"],
	});
	await expect(page.locator(".schedule-message.success:visible")).toContainText(
		"件を取り込みました",
	);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("iCloud connects without retaining the app password in the form or storage", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page, {
		provider: "icloud",
	});
	await page.goto("/account#calendar-settings");
	await page
		.getByLabel("Apple Accountのメールアドレス")
		.fill("apple@example.com");
	await page
		.getByLabel("アプリ用パスワード", { exact: true })
		.fill("aaaa-bbbb-cccc-dddd");
	await page.getByRole("button", { name: "iCloudに接続", exact: true }).click();
	await expect(
		page.getByText(
			"iCloudに接続しました。確定予定は専用カレンダー「Vacaro」に登録します。",
			{ exact: true },
		),
	).toBeVisible();
	await expect(page.locator("#icloud-app-password")).toHaveValue("");
	expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
		"aaaa-bbbb-cccc-dddd",
	);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("iCloud imports selected calendars", async ({ page }) => {
	const { unknownRequests } = await installFixtures(page, {
		icloudConnected: true,
		calendarDisconnected: true,
	});
	await page.goto("/events/event-1/availability");
	const request = page.waitForRequest(
		(r) =>
			r.url().endsWith("/icloud-calendar-availability/preview") &&
			r.method() === "POST",
	);
	await page.locator('button[value="icloud-calendar-preview"]:visible').click();
	expect((await request).postDataJSON()).toEqual({
		calendar_ids: ["https://p01-caldav.icloud.com/user/calendars/personal/"],
	});
	await expect(page.locator(".schedule-message.success:visible")).toContainText(
		"件を取り込みました",
	);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("iCloud import failure preserves the answer and links to iCloud settings", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page, {
		icloudConnected: true,
		icloudImportError: true,
		calendarDisconnected: true,
	});
	await page.goto("/events/event-1/availability");
	const before = await page.locator('input[name="intervals"]').inputValue();
	await page.locator('button[value="icloud-calendar-preview"]:visible').click();
	await expect(
		page
			.locator('a[href="/account#calendar-settings"]:visible')
			.filter({ hasText: "カレンダー設定を確認する" }),
	).toBeVisible();
	await expect(page.locator('input[name="intervals"]')).toHaveValue(before);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("calendar service selection persists and keeps imports and exports exclusive", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page, {
		provider: "google",
		icloudConnected: true,
	});
	const integrationRequests: string[] = [];
	page.on("request", (request) => {
		if (
			/\/api\/v1\/(integrations\/(google|icloud)-calendar\/calendars|events\/[^/]+\/(icloud-)?confirmation-calendar)/.test(
				request.url(),
			)
		)
			integrationRequests.push(request.url());
	});
	await page.goto("/account#calendar-settings");
	await expect(
		page.locator(".calendar-provider-form input:checked"),
	).toHaveValue("google");
	await expect(page.locator(".settings-calendar-option")).toHaveCount(3);
	await page.locator(".settings-calendar-option").nth(1).click();
	await page
		.locator("#calendar-settings")
		.getByRole("button", { name: "設定を保存", exact: true })
		.click();
	await page.goto("/events/event-1/availability");
	await expect(
		page.locator('button[value="calendar-preview"]:visible'),
	).toHaveCount(1);
	await expect(
		page.locator('button[value="icloud-calendar-preview"]:visible'),
	).toHaveCount(0);
	await page.goto("/events/event-1/confirmed");
	await expect(
		page.locator('form:has(input[value="sync-calendar"]) button:visible'),
	).toHaveCount(1);
	await expect(
		page.locator(
			'form:has(input[value="sync-icloud-calendar"]) button:visible',
		),
	).toHaveCount(0);
	expect(integrationRequests.every((url) => !url.includes("icloud"))).toBe(
		true,
	);
	await page.goto("/account#calendar-settings");
	await page.locator('input[name="provider"][value="icloud"]').check();
	await page
		.getByRole("button", { name: "利用するカレンダーを保存", exact: true })
		.click();
	await expect(page.getByRole("status")).toContainText(
		"利用するカレンダーを変更しました",
	);
	integrationRequests.length = 0;
	await page.goto("/events/event-1/availability");
	await expect(
		page.locator('button[value="calendar-preview"]:visible'),
	).toHaveCount(0);
	await expect(
		page.locator('button[value="icloud-calendar-preview"]:visible'),
	).toHaveCount(1);
	await page.goto("/events/event-1/confirmed");
	await expect(
		page.locator('form:has(input[value="sync-calendar"]) button:visible'),
	).toHaveCount(0);
	await expect(
		page.locator(
			'form:has(input[value="sync-icloud-calendar"]) button:visible',
		),
	).toHaveCount(1);
	expect(integrationRequests.every((url) => !url.includes("google"))).toBe(
		true,
	);
	await page.goto("/account#calendar-settings");
	await page.locator('input[name="provider"][value="google"]').check();
	await page
		.getByRole("button", { name: "利用するカレンダーを保存", exact: true })
		.click();
	await expect(
		page.locator(".settings-calendar-option input:checked"),
	).toHaveCount(2);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("TimeTree exports only and disabling integration stops all provider requests", async ({
	page,
}) => {
	const { unknownRequests } = await installFixtures(page, {
		provider: "timetree",
		icloudConnected: true,
	});
	await page.goto("/account#calendar-settings");
	await expect(
		page.getByRole("heading", { name: "TimeTreeへの書き出し（Google経由）" }),
	).toBeVisible();
	await expect(page.locator(".settings-calendar-option")).toHaveCount(0);
	await page.goto("/events/event-1/availability");
	await expect(
		page.locator('button[value="calendar-preview"]:visible'),
	).toHaveCount(0);
	await expect(
		page.locator('button[value="icloud-calendar-preview"]:visible'),
	).toHaveCount(0);
	await page.goto("/events/event-1/confirmed");
	await expect(
		page.locator('form:has(input[value="sync-calendar"]) button:visible'),
	).toHaveCount(1);
	await expect(
		page.locator(
			'form:has(input[value="sync-icloud-calendar"]) button:visible',
		),
	).toHaveCount(0);
	await page.goto("/account#calendar-settings");
	await page.locator('input[name="provider"][value="none"]').check();
	await page
		.getByRole("button", { name: "利用するカレンダーを保存", exact: true })
		.click();
	await expect(page.getByRole("status")).toContainText(
		"利用するカレンダーを変更しました",
	);
	const providerRequests: string[] = [];
	page.on("request", (request) => {
		if (
			/\/api\/v1\/(integrations\/(google|icloud)-calendar|events\/[^/]+\/(icloud-)?confirmation-calendar)/.test(
				request.url(),
			)
		)
			providerRequests.push(request.url());
	});
	await page.reload();
	await expect(
		page.locator(".calendar-provider-form input:checked"),
	).toHaveValue("none");
	await page.goto("/events/event-1/availability");
	await expect(
		page.locator('button[value$="calendar-preview"]:visible'),
	).toHaveCount(0);
	await page.goto("/events/event-1/confirmed");
	await expect(
		page.locator('form:has(input[value$="calendar"]) button:visible'),
	).toHaveCount(0);
	expect(providerRequests).toEqual([]);
	expect(unknownRequests).toEqual([]);
	expect(await layoutProblems(page)).toEqual([]);
});

test("multi-day drag adds the same hours to each selected day and saves UTC intervals", async ({
	page,
}) => {
	await installFixtures(page, { empty: true, provider: "none" });
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="intervals"]')).toBeAttached();
	const columns = page.locator(
		".schedule-grid > .schedule-day-column:not(:disabled)",
	);
	test.skip(
		!(await columns.first().isVisible()),
		"The weekly grid is shown on larger screens",
	);
	if ((await columns.count()) < 3)
		await page.locator('.schedule-toolbar button[aria-label="次の週"]').click();
	const boxes = await Promise.all(
		[0, 1, 2].map((index) => columns.nth(index).boundingBox()),
	);
	const first = boxes[0]!;
	const last = boxes[2]!;
	const start = {
		x: first.x + first.width / 2,
		y: first.y + first.height * (125 / 720),
	};
	const end = {
		x: last.x + last.width / 2,
		y: last.y + last.height * (395 / 720),
	};
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(end.x, end.y, { steps: 12 });
	const preview = page.locator(".schedule-drag-preview");
	await expect(preview).toBeVisible();
	const bounds = (await preview.boundingBox())!;
	expect(Math.abs(bounds.x - first.x)).toBeLessThan(2);
	expect(Math.abs(bounds.width - (last.x + last.width - first.x))).toBeLessThan(
		2,
	);
	expect(
		JSON.parse(await page.locator('input[name="intervals"]').inputValue()),
	).toHaveLength(0);
	await page.mouse.up();
	await expect(preview).toHaveCount(0);
	const ranges = JSON.parse(
		await page.locator('input[name="intervals"]').inputValue(),
	);
	expect(ranges).toHaveLength(3);
	for (const [index, range] of ranges.entries()) {
		const date = await columns.nth(index).getAttribute("data-date");
		expect(range.start).toBe(`${date}T11:00`);
		expect(range.end).toBe(`${date}T16:00`);
	}
	const request = page.waitForRequest(
		(r) => r.url().endsWith("/my-availability") && r.method() === "PUT",
	);
	await page.locator('button[value="save"]:visible').click();
	expect((await request).postDataJSON().intervals).toEqual(
		ranges.map((range: { start: string; end: string }) => ({
			start_at: new Date(range.start + "+09:00").toISOString(),
			end_at: new Date(range.end + "+09:00").toISOString(),
		})),
	);
	expect(await layoutProblems(page)).toEqual([]);
});

test("multi-day drag supports reverse selection and merges overlaps on each day", async ({
	page,
}) => {
	await installFixtures(page, { empty: true, provider: "none" });
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="intervals"]')).toBeAttached();
	const columns = page.locator(
		".schedule-grid > .schedule-day-column:not(:disabled)",
	);
	test.skip(
		!(await columns.first().isVisible()),
		"The weekly grid is shown on larger screens",
	);
	if ((await columns.count()) < 3)
		await page.locator('.schedule-toolbar button[aria-label="次の週"]').click();
	const first = (await columns.nth(0).boundingBox())!;
	const last = (await columns.nth(2).boundingBox())!;
	await page.mouse.move(
		last.x + last.width / 2,
		last.y + last.height * (395 / 720),
	);
	await page.mouse.down();
	await page.mouse.move(
		first.x + first.width / 2,
		first.y + first.height * (125 / 720),
		{ steps: 10 },
	);
	await page.mouse.up();
	let ranges = JSON.parse(
		await page.locator('input[name="intervals"]').inputValue(),
	);
	expect(
		ranges.map((r: { start: string; end: string }) => [
			r.start.slice(11),
			r.end.slice(11),
		]),
	).toEqual([
		["11:00", "16:00"],
		["11:00", "16:00"],
		["11:00", "16:00"],
	]);
	const middle = (await columns.nth(1).boundingBox())!;
	await page.mouse.move(
		middle.x + middle.width / 2,
		middle.y + middle.height * (305 / 720),
	);
	await page.mouse.down();
	await page.mouse.move(
		middle.x + middle.width / 2,
		middle.y + middle.height * (455 / 720),
	);
	await page.mouse.up();
	ranges = JSON.parse(
		await page.locator('input[name="intervals"]').inputValue(),
	);
	expect(
		ranges.map((r: { start: string; end: string }) => [
			r.start.slice(11),
			r.end.slice(11),
		]),
	).toEqual([
		["11:00", "16:00"],
		["11:00", "17:00"],
		["11:00", "16:00"],
	]);
});

test("cancelled multi-day drag leaves the answer unchanged", async ({
	page,
}) => {
	await installFixtures(page, { empty: true, provider: "none" });
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="intervals"]')).toBeAttached();
	const columns = page.locator(
		".schedule-grid > .schedule-day-column:not(:disabled)",
	);
	test.skip(
		!(await columns.first().isVisible()),
		"The weekly grid is shown on larger screens",
	);
	if ((await columns.count()) < 3)
		await page.locator('.schedule-toolbar button[aria-label="次の週"]').click();
	const first = (await columns.nth(0).boundingBox())!;
	const last = (await columns.nth(2).boundingBox())!;
	await page.mouse.move(first.x + first.width / 2, first.y + 110);
	await page.mouse.down();
	await page.mouse.move(last.x + last.width / 2, last.y + 220);
	await expect(page.locator(".schedule-drag-preview")).toBeVisible();
	await columns.first().evaluate((column) => {
		for (let id = 1; id < 10; id++)
			if (column.hasPointerCapture(id)) column.releasePointerCapture(id);
	});
	await page.mouse.move(last.x + last.width / 2, last.y + 221);
	await expect(page.locator(".schedule-drag-preview")).toHaveCount(0);
	await page.mouse.up();
	expect(
		JSON.parse(await page.locator('input[name="intervals"]').inputValue()),
	).toEqual([]);
});

test("single-day mobile drag still records only the selected date", async ({
	page,
}) => {
	await installFixtures(page, { empty: true, provider: "none" });
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="intervals"]')).toBeAttached();
	const column = page.locator(".schedule-mobile-day");
	test.skip(!(await column.isVisible()), "Mobile daily grid only");
	const bounds = (await column.boundingBox())!;
	const date = await column.getAttribute("data-date");
	await page.mouse.move(
		bounds.x + bounds.width / 2,
		bounds.y + bounds.height * (125 / 720),
	);
	await page.mouse.down();
	await page.mouse.move(
		bounds.x + bounds.width / 2,
		bounds.y + bounds.height * (215 / 720),
	);
	await page.mouse.up();
	const ranges = JSON.parse(
		await page.locator('input[name="intervals"]').inputValue(),
	);
	expect(ranges).toHaveLength(1);
	expect(ranges[0]).toMatchObject({
		start: `${date}T11:00`,
		end: `${date}T13:00`,
	});
});

test("multi-day drag can enter unavailable hours for several days", async ({
	page,
}) => {
	await installFixtures(page, { empty: true, provider: "none" });
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="intervals"]')).toBeAttached();
	const columns = page.locator(
		".schedule-grid > .schedule-day-column:not(:disabled)",
	);
	test.skip(!(await columns.first().isVisible()), "Weekly grid only");
	if ((await columns.count()) < 3)
		await page.locator('.schedule-toolbar button[aria-label="次の週"]').click();
	await page
		.locator(".schedule-sidebar .schedule-entry-mode .is-unavailable")
		.click();
	for (let index = 0; index < 3; index++) {
		await page
			.locator(".schedule-week-head > button:not(:disabled)")
			.nth(index)
			.click();
		await page.locator('.schedule-sidebar button[aria-label="削除"]').click();
	}
	const first = (await columns.nth(0).boundingBox())!;
	const last = (await columns.nth(2).boundingBox())!;
	await page.mouse.move(
		first.x + first.width / 2,
		first.y + first.height * (125 / 720),
	);
	await page.mouse.down();
	await page.mouse.move(
		last.x + last.width / 2,
		last.y + last.height * (395 / 720),
		{ steps: 10 },
	);
	await expect(
		page.locator(".schedule-drag-preview.is-unavailable"),
	).toBeVisible();
	await page.mouse.up();
	const ranges = JSON.parse(
		await page.locator('input[name="intervals"]').inputValue(),
	);
	expect(
		ranges.map((r: { start: string; end: string }) => [
			r.start.slice(11),
			r.end.slice(11),
		]),
	).toEqual([
		["09:00", "11:00"],
		["16:00", "21:00"],
		["09:00", "11:00"],
		["16:00", "21:00"],
		["09:00", "11:00"],
		["16:00", "21:00"],
	]);
});

test("multi-day drag clamps selection to enabled event dates", async ({
	page,
}) => {
	await installFixtures(page, { empty: true, provider: "none" });
	await page.goto("/events/event-1/availability");
	await expect(page.locator('input[name="intervals"]')).toBeAttached();
	const columns = page.locator(
		".schedule-grid > .schedule-day-column:not(:disabled)",
	);
	test.skip(!(await columns.first().isVisible()), "Weekly grid only");
	if ((await columns.count()) < 3)
		await page.locator('.schedule-toolbar button[aria-label="次の週"]').click();
	const firstDate = await columns.first().getAttribute("data-date");
	const third = (await columns.nth(2).boundingBox())!;
	const grid = (await page.locator(".schedule-grid").boundingBox())!;
	await page.mouse.move(
		third.x + third.width / 2,
		third.y + third.height * (125 / 720),
	);
	await page.mouse.down();
	await page.mouse.move(grid.x - 5, third.y + third.height * (395 / 720));
	await page.mouse.up();
	const ranges = JSON.parse(
		await page.locator('input[name="intervals"]').inputValue(),
	);
	expect(ranges).toHaveLength(3);
	expect(ranges[0].start).toBe(`${firstDate}T11:00`);
});
