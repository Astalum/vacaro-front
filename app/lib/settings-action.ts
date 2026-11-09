import type { apiErrorData } from "./api";

export interface SettingsActionData {
	kind: string;
	error?: ReturnType<typeof apiErrorData>;
}
