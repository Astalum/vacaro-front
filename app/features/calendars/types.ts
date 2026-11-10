import type { apiErrorData } from "~/lib/api";

export interface SettingsActionData {
	kind: string;
	error?: ReturnType<typeof apiErrorData>;
}

export interface GoogleCalendar {
	id: string;
	summary: string;
	primary: boolean;
	selected: boolean;
	background_color?: string;
}

export type ConfirmationCalendarConnectionStatus =
	| "inactive"
	| "connected"
	| "not_connected"
	| "write_permission_required"
	| "unavailable"
	| "error";

export interface ConfirmationCalendarSync {
	event_id?: string;
	group_id: string | null;
	status: "synced" | "failed";
	attempted_at: string | null;
}

export interface ConfirmationCalendarStatus {
	connection_status: ConfirmationCalendarConnectionStatus;
	syncs: ConfirmationCalendarSync[];
}
