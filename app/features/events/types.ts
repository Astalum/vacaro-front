export type EventStatus = "open" | "confirmed" | "cancelled";

export type SchedulingMode = "whole_event" | "groups";

export type ParticipantRole = "organizer" | "member";

export type ResponseStatus = "pending" | "submitted";

export type AvailabilitySource =
	| "manual"
	| "google_calendar"
	| "icloud_calendar";

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

export interface JoinedParticipant extends Participant {
	response_edit_url?: string;
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
