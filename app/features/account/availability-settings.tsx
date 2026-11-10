import { data, Form } from "react-router";
import { ValidationMessage } from "~/components/ui/validation-message";
import { ApiError, apiErrorData, apiRequest } from "~/lib/api";
import type { AvailabilityDefault, User } from "./types";

const options: {
	value: AvailabilityDefault;
	label: string;
	description: string;
}[] = [
	{
		value: "available",
		label: "すべて都合がいい",
		description: "都合が悪い時間だけを入力します。",
	},
	{
		value: "unavailable",
		label: "すべて都合が悪い",
		description: "都合がいい時間だけを入力します。",
	},
];

export async function handleAvailabilityDefaultAction(formData: FormData) {
	const value = formData.get("availability_default");
	if (!options.some((option) => option.value === value)) {
		return data(
			{
				kind: "error" as const,
				scope: "availability" as const,
				error: {
					code: "validation_failed",
					message: "空き時間の初期状態を選択してください",
				},
			},
			{ status: 422 },
		);
	}
	try {
		await apiRequest<User>("/me/availability-default", {
			method: "PUT",
			body: JSON.stringify({ availability_default: value }),
		});
		return { kind: "availability-default-updated" as const };
	} catch (error) {
		return data(
			{
				kind: "error" as const,
				scope: "availability" as const,
				error: apiErrorData(error),
			},
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export function AvailabilitySettings({
	user,
	saved,
	error,
	saving,
	disabled,
}: {
	user: User;
	saved: boolean;
	error?: { message: string };
	saving: boolean;
	disabled: boolean;
}) {
	const currentValue = user.availability_default ?? "unavailable";
	return (
		<section className="account-card" id="availability-settings">
			<div className="settings-section-heading">
				<div>
					<span className="account-section-label">AVAILABILITY</span>
					<h2>空き時間の初期状態</h2>
					<p>
						未回答のイベントを開いたときの状態を選べます。保存済みの回答は変更されません。
					</p>
				</div>
			</div>
			{saved && (
				<p className="availability-settings-saved" role="status">
					空き時間の初期状態を保存しました
				</p>
			)}
			{error && <ValidationMessage title={error.message} />}
			<Form
				method="post"
				preventScrollReset
				className="availability-default-form"
			>
				<fieldset key={currentValue} disabled={disabled}>
					<legend>初期状態</legend>
					{options.map((option) => (
						<label className="availability-default-option" key={option.value}>
							<input
								type="radio"
								name="availability_default"
								value={option.value}
								defaultChecked={currentValue === option.value}
							/>
							<span>
								<strong>{option.label}</strong>
								<small>{option.description}</small>
							</span>
						</label>
					))}
				</fieldset>
				<button
					className="button button-primary"
					type="submit"
					name="intent"
					value="update-availability-default"
					disabled={disabled}
				>
					{saving ? "保存しています…" : "空き時間の設定を保存"}
				</button>
			</Form>
		</section>
	);
}
