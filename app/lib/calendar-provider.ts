import { ApiError, apiRequest } from "./api";

export type CalendarProvider = "none" | "google" | "icloud" | "timetree";
export interface CalendarPreference {
	provider: CalendarProvider;
}
export const CALENDAR_PROVIDERS: {
	value: CalendarProvider;
	label: string;
	description: string;
}[] = [
	{
		value: "none",
		label: "使用しない",
		description: "カレンダー連携を停止します。",
	},
	{
		value: "google",
		label: "Googleカレンダー",
		description: "空き時間の取り込みと確定予定の書き出し。",
	},
	{
		value: "icloud",
		label: "iCloudカレンダー",
		description: "iPhoneのiCloud予定の取り込みと書き出し。",
	},
	{
		value: "timetree",
		label: "TimeTree（Google経由）",
		description: "Googleの専用カレンダーを使って確定予定を表示。",
	},
];
export async function loadCalendarPreference(): Promise<CalendarPreference> {
	try {
		const result = await apiRequest<CalendarPreference>(
			"/integrations/calendar-preference",
		);
		if (!CALENDAR_PROVIDERS.some(({ value }) => value === result.provider))
			throw new Error("カレンダーの利用設定を確認できませんでした");
		return result;
	} catch (error) {
		// Event-scoped edit sessions can answer manually without a normal account session.
		if (error instanceof ApiError && error.status === 401)
			return { provider: "none" };
		throw error;
	}
}
export function calendarTransport(provider: CalendarProvider) {
	return provider === "timetree" ? "google" : provider;
}
