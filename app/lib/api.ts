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
