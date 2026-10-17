import { isTimeValue } from "./time";

export type AccountType = "guest" | "registered";
export type EventStatus = "open" | "confirmed" | "cancelled";
export type SchedulingMode = "whole_event" | "groups";
export type ParticipantRole = "organizer" | "member";
export type ResponseStatus = "pending" | "submitted";
export type AvailabilitySource = "manual" | "google_calendar";

export interface User {
	id: string;
	account_type: AccountType;
	display_name: string;
	time_zone: string;
	email: string | null;
	guest_expires_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface Event {
	id: string;
	created_by_user_id?: string;
	title: string;
	description: string | null;
	window_start_at: string;
	window_end_at: string;
	duration_minutes: number;
	scheduling_mode: SchedulingMode;
	status: EventStatus;
	confirmed_start_at: string | null;
	confirmed_end_at: string | null;
	response_deadline_at: string | null;
	results_visible_to_participants: boolean;
	created_at: string;
	updated_at: string;
}

export type EventDisplayStatus = EventStatus | "expired";

export function eventDisplayStatus(
	event: Pick<Event, "status" | "response_deadline_at">,
	now = Date.now(),
): EventDisplayStatus {
	if (event.status !== "open") return event.status;
	if (!event.response_deadline_at) return "open";
	const deadline = Date.parse(event.response_deadline_at);
	return Number.isFinite(deadline) && deadline <= now ? "expired" : "open";
}
export interface EventWithInvite extends Event {
	invite_token: string;
	invite_url: string;
}

export interface Participant {
	id: string;
	event_id: string;
	user_id: string;
	display_name: string;
	role: ParticipantRole;
	response_status: ResponseStatus;
	created_at: string;
	updated_at: string;
}

export interface SchedulingGroup {
	id: string;
	event_id: string;
	name: string;
	duration_minutes: number;
	confirmed_start_at: string | null;
	confirmed_end_at: string | null;
	member_count: number;
	members: Participant[];
	created_at: string;
	updated_at: string;
}

export interface AvailabilityInterval {
	id?: string;
	participant_id?: string;
	start_at: string;
	end_at: string;
	source?: AvailabilitySource;
	created_at?: string;
	updated_at?: string;
}

export interface GoogleCalendar {
	id: string;
	summary: string;
	primary: boolean;
	selected: boolean;
	background_color?: string;
}

export type ConfirmationCalendarConnectionStatus =
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

export const CALENDAR_SELECTION_STORAGE_KEY = "vacaro.calendar-selection";
export const CALENDAR_AVAILABILITY_WINDOW_STORAGE_KEY =
	"vacaro.calendar-availability-window";
export const EVENT_INVITE_URLS_STORAGE_KEY = "vacaro.event-invite-urls";
export const EVENT_INVITE_URL_UPDATED_EVENT = "vacaro:invite-url-updated";

export function savedEventInviteUrl(eventID: string) {
	try {
		const stored = window.localStorage.getItem(EVENT_INVITE_URLS_STORAGE_KEY);
		const urls = stored ? (JSON.parse(stored) as unknown) : null;
		if (
			urls &&
			typeof urls === "object" &&
			eventID in urls &&
			typeof (urls as Record<string, unknown>)[eventID] === "string"
		) {
			return (urls as Record<string, string>)[eventID];
		}
	} catch {
		// Storage may be unavailable in privacy-focused browser modes.
	}
	return null;
}

export function saveEventInviteUrl(eventID: string, inviteUrl: string) {
	try {
		const stored = window.localStorage.getItem(EVENT_INVITE_URLS_STORAGE_KEY);
		const parsed = stored ? (JSON.parse(stored) as unknown) : null;
		const urls =
			parsed && typeof parsed === "object"
				? (parsed as Record<string, string>)
				: {};
		urls[eventID] = inviteUrl;
		window.localStorage.setItem(
			EVENT_INVITE_URLS_STORAGE_KEY,
			JSON.stringify(urls),
		);
	} catch {
		// The URL remains visible for the current navigation when storage is blocked.
	}
	window.dispatchEvent(
		new CustomEvent(EVENT_INVITE_URL_UPDATED_EVENT, {
			detail: { eventID, inviteUrl },
		}),
	);
	return inviteUrl;
}

export interface CalendarAvailabilityWindow {
	start: string;
	end: string;
}

export const DEFAULT_CALENDAR_AVAILABILITY_WINDOW: CalendarAvailabilityWindow =
	{
		start: "09:00",
		end: "18:00",
	};

export function savedCalendarAvailabilityWindow(): CalendarAvailabilityWindow {
	try {
		const value = window.localStorage.getItem(
			CALENDAR_AVAILABILITY_WINDOW_STORAGE_KEY,
		);
		const saved = value ? (JSON.parse(value) as unknown) : null;
		if (
			saved &&
			typeof saved === "object" &&
			"start" in saved &&
			"end" in saved &&
			isTimeValue(saved.start) &&
			isTimeValue(saved.end) &&
			saved.start < saved.end
		) {
			return { start: saved.start, end: saved.end };
		}
	} catch {
		// Storage may be unavailable in privacy-focused browser modes.
	}
	return { ...DEFAULT_CALENDAR_AVAILABILITY_WINDOW };
}

export function saveCalendarAvailabilityWindow(
	range: CalendarAvailabilityWindow,
) {
	if (
		!isTimeValue(range.start) ||
		!isTimeValue(range.end) ||
		range.start >= range.end
	) {
		return false;
	}
	try {
		window.localStorage.setItem(
			CALENDAR_AVAILABILITY_WINDOW_STORAGE_KEY,
			JSON.stringify(range),
		);
		return true;
	} catch {
		return false;
	}
}

export function savedCalendarIDs(calendars: GoogleCalendar[]) {
	const availableIDs = new Set(calendars.map((calendar) => calendar.id));
	try {
		const value = window.localStorage.getItem(CALENDAR_SELECTION_STORAGE_KEY);
		const saved = value ? (JSON.parse(value) as unknown) : null;
		if (Array.isArray(saved)) {
			const valid = saved.filter(
				(id): id is string => typeof id === "string" && availableIDs.has(id),
			);
			if (valid.length > 0) return valid;
		}
	} catch {
		// Storage may be unavailable in privacy-focused browser modes.
	}
	const preferred = calendars.filter(
		(calendar) => calendar.primary || calendar.selected,
	);
	return (preferred.length > 0 ? preferred : calendars.slice(0, 1)).map(
		(calendar) => calendar.id,
	);
}

export function saveCalendarIDs(calendarIDs: string[]) {
	try {
		window.localStorage.setItem(
			CALENDAR_SELECTION_STORAGE_KEY,
			JSON.stringify(calendarIDs),
		);
		return true;
	} catch {
		return false;
	}
}

export function clearSavedCalendarIDs() {
	try {
		window.localStorage.removeItem(CALENDAR_SELECTION_STORAGE_KEY);
	} catch {
		// Nothing else is required when storage is unavailable.
	}
}

export interface ParticipantAvailability {
	participant: Participant;
	intervals: AvailabilityInterval[];
}

export interface Candidate {
	start_at: string;
	end_at: string;
	available_participant_count: number;
	total_participant_count: number;
	available_participant_ids: string[];
}

export interface ApiErrorBody {
	code: string;
	message: string;
	fields?: Record<string, string> | null;
	request_id?: string;
}

export interface ApiEnvelope<T, M = Record<string, unknown>> {
	data: T;
	meta?: M;
}
interface ApiErrorEnvelope {
	error: ApiErrorBody;
}

export class ApiError extends Error {
	status: number;
	code: string;
	fields?: Record<string, string> | null;
	requestId?: string;

	constructor(status: number, body: ApiErrorBody) {
		super(body.message);
		this.name = "ApiError";
		this.status = status;
		this.code = body.code;
		this.fields = body.fields;
		this.requestId = body.request_id;
	}
}

async function requestAPIEnvelope<T, M = Record<string, unknown>>(
	path: string,
	init?: RequestInit,
): Promise<ApiEnvelope<T, M>> {
	const headers = new Headers(init?.headers);
	const method = (init?.method ?? "GET").toUpperCase();
	if (init?.body && !headers.has("Content-Type"))
		headers.set("Content-Type", "application/json");
	headers.set("Accept", "application/json");
	if (!["GET", "HEAD", "OPTIONS"].includes(method))
		headers.set("X-Vacaro-CSRF", "same-origin");

	const response = await fetch(`/api/v1${path}`, {
		...init,
		headers,
		credentials: "same-origin",
	});
	if (response.status === 204) return { data: undefined as T };

	const body = (await response.json()) as ApiEnvelope<T, M> | ApiErrorEnvelope;
	if (!response.ok) {
		const error =
			"error" in body
				? body.error
				: {
						code: "unexpected_response",
						message: "APIから予期しない応答が返されました",
					};
		throw new ApiError(response.status, error);
	}
	return body as ApiEnvelope<T, M>;
}

export async function apiRequest<T>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	return (await requestAPIEnvelope<T>(path, init)).data;
}

export async function apiRequestWithMeta<T, M>(
	path: string,
	init?: RequestInit,
): Promise<ApiEnvelope<T, M>> {
	return requestAPIEnvelope<T, M>(path, init);
}

export async function reissueEventInviteUrl(eventID: string) {
	const invitedEvent = await apiRequest<EventWithInvite>(
		`/events/${eventID}/invite-token`,
		{ method: "POST" },
	);
	return saveEventInviteUrl(eventID, invitedEvent.invite_url);
}

export function apiErrorData(error: unknown): ApiErrorBody {
	if (error instanceof ApiError)
		return {
			code: error.code,
			message: error.message,
			fields: error.fields,
			request_id: error.requestId,
		};
	return {
		code: "network_error",
		message:
			"サーバーに接続できませんでした。しばらくしてからもう一度お試しください。",
	};
}

export function formatDateTime(value: string, timeZone = "UTC") {
	return new Intl.DateTimeFormat("ja-JP", {
		timeZone,
		month: "long",
		day: "numeric",
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

export function formatDateRange(start: string, end: string, timeZone = "UTC") {
	return `${formatDateTime(start, timeZone)} 〜 ${formatDateTime(end, timeZone)}`;
}

export function minutesLabel(minutes: number) {
	if (minutes < 60) return `${minutes}分`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours}時間${rest}分` : `${hours}時間`;
}

export const COMMON_TIME_ZONES = [
	"UTC",
	"Pacific/Honolulu",
	"America/Los_Angeles",
	"America/Denver",
	"America/Chicago",
	"America/New_York",
	"America/Toronto",
	"America/Sao_Paulo",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Africa/Johannesburg",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Bangkok",
	"Asia/Singapore",
	"Asia/Hong_Kong",
	"Asia/Shanghai",
	"Asia/Seoul",
	"Asia/Tokyo",
	"Australia/Perth",
	"Australia/Sydney",
	"Pacific/Auckland",
] as const;

export function isValidTimeZone(timeZone: string) {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format();
		return true;
	} catch {
		return false;
	}
}

export function browserTimeZone() {
	const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	return timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
}

function localDateTimeParts(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
		value,
	);
	if (!match) return null;
	const [, year, month, day, hour, minute, second = "00"] = match;
	const values = [year, month, day, hour, minute, second].map(Number);
	const utc = Date.UTC(
		values[0],
		values[1] - 1,
		values[2],
		values[3],
		values[4],
		values[5],
	);
	const date = new Date(utc);
	if (
		date.getUTCFullYear() !== values[0] ||
		date.getUTCMonth() !== values[1] - 1 ||
		date.getUTCDate() !== values[2] ||
		date.getUTCHours() !== values[3] ||
		date.getUTCMinutes() !== values[4] ||
		date.getUTCSeconds() !== values[5]
	) {
		return null;
	}
	return { values, wallClockUtc: utc };
}

function zonedParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((item) => item.type === type)?.value ?? "");
	return [
		part("year"),
		part("month"),
		part("day"),
		part("hour"),
		part("minute"),
		part("second"),
	];
}

export function localDateTimeToIso(
	value: FormDataEntryValue | null,
	timeZone = "UTC",
) {
	if (typeof value !== "string" || !value) return null;
	const parsed = localDateTimeParts(value);
	if (!parsed || !isValidTimeZone(timeZone)) return null;

	let instant = parsed.wallClockUtc;
	for (let attempt = 0; attempt < 4; attempt += 1) {
		const displayed = zonedParts(new Date(instant), timeZone);
		const offset =
			Date.UTC(
				displayed[0],
				displayed[1] - 1,
				displayed[2],
				displayed[3],
				displayed[4],
				displayed[5],
			) - instant;
		const adjusted = parsed.wallClockUtc - offset;
		if (adjusted === instant) break;
		instant = adjusted;
	}

	const date = new Date(instant);
	if (
		!zonedParts(date, timeZone).every(
			(part, index) => part === parsed.values[index],
		)
	) {
		return null;
	}
	return date.toISOString();
}

export function isoToLocalDateTime(value: string | null, timeZone = "UTC") {
	if (!value || !isValidTimeZone(timeZone)) return "";
	const parts = zonedParts(new Date(value), timeZone);
	if (parts.some((part) => !Number.isFinite(part))) return "";
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}T${pad(parts[3])}:${pad(parts[4])}`;
}
