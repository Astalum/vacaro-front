export type AccountType = "guest" | "registered";
export type EventStatus = "open" | "confirmed" | "cancelled";
export type ParticipantRole = "organizer" | "member";
export type ResponseStatus = "pending" | "submitted";
export type AvailabilitySource = "manual" | "google_calendar";

export interface User {
	id: string;
	account_type: AccountType;
	display_name: string;
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
	time_zone: string;
	window_start_at: string;
	window_end_at: string;
	duration_minutes: number;
	status: EventStatus;
	confirmed_start_at: string | null;
	confirmed_end_at: string | null;
	response_deadline_at: string | null;
	created_at: string;
	updated_at: string;
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

export interface AvailabilityInterval {
	id?: string;
	participant_id?: string;
	start_at: string;
	end_at: string;
	source?: AvailabilitySource;
	created_at?: string;
	updated_at?: string;
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

interface ApiEnvelope<T> {
	data: T;
	meta?: Record<string, unknown>;
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

export async function apiRequest<T>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	const headers = new Headers(init?.headers);
	if (init?.body && !headers.has("Content-Type"))
		headers.set("Content-Type", "application/json");
	headers.set("Accept", "application/json");

	const response = await fetch(`/api/v1${path}`, {
		...init,
		headers,
		credentials: "same-origin",
	});
	if (response.status === 204) return undefined as T;

	const body = (await response.json()) as ApiEnvelope<T> | ApiErrorEnvelope;
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
	return (body as ApiEnvelope<T>).data;
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

export function formatDateTime(value: string, timeZone = "Asia/Tokyo") {
	return new Intl.DateTimeFormat("ja-JP", {
		timeZone,
		month: "long",
		day: "numeric",
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

export function formatDateRange(
	start: string,
	end: string,
	timeZone = "Asia/Tokyo",
) {
	return `${formatDateTime(start, timeZone)} 〜 ${formatDateTime(end, timeZone)}`;
}

export function minutesLabel(minutes: number) {
	if (minutes < 60) return `${minutes}分`;
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	return rest ? `${hours}時間${rest}分` : `${hours}時間`;
}

export function localDateTimeToIso(value: FormDataEntryValue | null) {
	if (typeof value !== "string" || !value) return null;
	return new Date(`${value}:00+09:00`).toISOString();
}
