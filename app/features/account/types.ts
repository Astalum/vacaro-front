export type AccountType = "guest" | "registered";
export type AvailabilityDefault = "available" | "unavailable";

export interface User {
	id: string;
	account_type: AccountType;
	display_name: string;
	time_zone: string;
	availability_default?: AvailabilityDefault;
	email: string | null;
	guest_expires_at: string | null;
	created_at: string;
	updated_at: string;
}
