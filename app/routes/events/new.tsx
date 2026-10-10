import { type FormEvent, useState } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import { Icon, PageIntro, PageShell } from "../../components/ui";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../../components/ui/card";
import { DateTimePicker } from "../../components/ui/date-time-picker";
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	type EventWithInvite,
	localDateTimeToIso,
	saveEventInviteUrl,
	type User,
} from "../../lib/api";
import { getNewEventDefaults } from "../../lib/new-event-defaults";
import { isTimeValue, TIME_INPUT_STEP_SECONDS } from "../../lib/time";
import type { Route } from "./+types/new";

export function meta() {
	return [{ title: "イベントを作る | vacaro" }];
}

export function loader() {
	return getNewEventDefaults();
}

type RequiredFieldName = "title" | "display_name";
type FieldErrors = Partial<Record<RequiredFieldName, string>>;

const requiredFields: Array<{
	name: RequiredFieldName;
	message: string;
}> = [
	{ name: "title", message: "イベント名を入力してください" },
	{ name: "display_name", message: "主催者名を入力してください" },
];

export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const displayName = String(formData.get("display_name") ?? "").trim();
	const windowStartDate = String(formData.get("window_start_date") ?? "");
	const windowEndDate = String(formData.get("window_end_date") ?? "");
	const dailyStartTime = String(formData.get("daily_start_time") ?? "");
	const dailyEndTime = String(formData.get("daily_end_time") ?? "");
	const responseDeadlineAt = String(formData.get("response_deadline_at") ?? "");
	const resultsVisibilityValue = formData.get(
		"results_visible_to_participants",
	);
	const resultsVisibleToParticipants =
		resultsVisibilityValue === null ||
		String(resultsVisibilityValue) === "true";
	const windowEndAt = `${windowEndDate}T${dailyEndTime}`;
	if (
		!windowStartDate ||
		!windowEndDate ||
		windowStartDate > windowEndDate ||
		!isTimeValue(dailyStartTime) ||
		!isTimeValue(dailyEndTime) ||
		dailyStartTime >= dailyEndTime
	) {
		return data(
			{
				error: {
					code: "validation_failed",
					message: "回答を集める期間と時間帯を確認してください",
					fields: null,
				},
			},
			{ status: 422 },
		);
	}
	const windowStartAt = `${windowStartDate}T${dailyStartTime}`;
	if (responseDeadlineAt && responseDeadlineAt > windowEndAt) {
		return data(
			{
				error: {
					code: "validation_failed",
					message: "回答期限は調整期間の終了以前にしてください",
					fields: {
						response_deadline_at: "調整期間の終了以前を指定してください",
					},
				},
			},
			{ status: 422 },
		);
	}
	try {
		try {
			const me = await apiRequest<User>("/me");
			if (displayName && me.display_name !== displayName) {
				await apiRequest<User>("/me", {
					method: "PATCH",
					body: JSON.stringify({ display_name: displayName }),
				});
			}
		} catch (error) {
			if (!(error instanceof ApiError) || error.status !== 401) throw error;
			await apiRequest<User>("/guest-sessions", {
				method: "POST",
				body: JSON.stringify({ display_name: displayName }),
			});
		}

		const created = await apiRequest<EventWithInvite>("/events", {
			method: "POST",
			body: JSON.stringify({
				title: String(formData.get("title") ?? ""),
				description: String(formData.get("description") ?? "") || null,
				time_zone: String(formData.get("time_zone") ?? "Asia/Tokyo"),
				window_start_at: localDateTimeToIso(windowStartAt),
				window_end_at: localDateTimeToIso(windowEndAt),
				duration_minutes: Number(formData.get("duration_minutes")),
				scheduling_mode: "groups",
				results_visible_to_participants: resultsVisibleToParticipants,
				response_deadline_at: localDateTimeToIso(
					formData.get("response_deadline_at"),
				),
			}),
		});
		saveEventInviteUrl(created.id, created.invite_url);
		return redirect(
			`/events/${created.id}/created?invite_url=${encodeURIComponent(created.invite_url)}`,
		);
	} catch (error) {
		return data(
			{ error: apiErrorData(error) },
			{ status: error instanceof ApiError ? error.status : 500 },
		);
	}
}

export default function NewEvent({
	actionData,
	loaderData,
}: Route.ComponentProps) {
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [scheduleError, setScheduleError] = useState<string | null>(null);
	const [resultsVisible, setResultsVisible] = useState(true);
	const hasFieldErrors = Object.keys(fieldErrors).length > 0;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		const form = event.currentTarget;
		const nextErrors: FieldErrors = {};

		for (const field of requiredFields) {
			const input = form.elements.namedItem(field.name);
			if (input instanceof HTMLInputElement && !input.value.trim()) {
				nextErrors[field.name] = field.message;
			}
		}

		const startDate = form.elements.namedItem("window_start_date");
		const endDate = form.elements.namedItem("window_end_date");
		const startTime = form.elements.namedItem("daily_start_time");
		const endTime = form.elements.namedItem("daily_end_time");
		const responseDeadline = form.elements.namedItem("response_deadline_at");
		let nextScheduleError: string | null = null;
		if (
			!(startDate instanceof HTMLInputElement) ||
			!(endDate instanceof HTMLInputElement) ||
			!startDate.value ||
			!endDate.value ||
			startDate.value > endDate.value
		) {
			nextScheduleError = "終了日は開始日以降にしてください";
		} else if (
			!(startTime instanceof HTMLInputElement) ||
			!(endTime instanceof HTMLInputElement) ||
			!isTimeValue(startTime.value) ||
			!isTimeValue(endTime.value) ||
			startTime.value >= endTime.value
		) {
			nextScheduleError = "毎日の終了時刻は開始時刻より後にしてください";
		} else if (
			responseDeadline instanceof HTMLInputElement &&
			responseDeadline.value &&
			responseDeadline.value > `${endDate.value}T${endTime.value}`
		) {
			nextScheduleError = "回答期限は調整期間の終了以前にしてください";
		}

		const firstInvalidField = requiredFields.find(
			(field) => nextErrors[field.name],
		);
		if (!firstInvalidField && !nextScheduleError) {
			setFieldErrors({});
			setScheduleError(null);
			return;
		}

		event.preventDefault();
		setFieldErrors(nextErrors);
		setScheduleError(nextScheduleError);
		const input = form.elements.namedItem(
			firstInvalidField?.name ?? "window_start_date",
		);
		if (input instanceof HTMLElement) input.focus();
	}

	function clearFieldError(name: RequiredFieldName) {
		setFieldErrors((current) => {
			if (!current[name]) return current;
			const next = { ...current };
			delete next[name];
			return next;
		});
	}

	return (
		<PageShell>
			<PageIntro
				eyebrow="CREATE EVENT"
				title="イベントを作る"
				description="日程を調整する期間と、イベントに必要な時間を決めましょう。"
				backTo="/"
				backLabel="トップへ戻る"
			/>
			<Form
				className="new-event-form space-y-6"
				method="post"
				noValidate
				onSubmit={handleSubmit}
			>
				{actionData?.error && (
					<div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-destructive">
						<Icon name="info" size={20} />
						<span className="grid gap-1 text-base font-semibold">
							<strong>{actionData.error.message}</strong>
							{actionData.error.fields &&
								Object.values(actionData.error.fields).join(" / ")}
						</span>
					</div>
				)}
				{hasFieldErrors && (
					<div
						role="alert"
						className="flex items-center gap-3 rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3.5 text-destructive shadow-[0_10px_30px_rgba(176,69,53,0.08)]"
					>
						<span className="grid size-9 shrink-0 place-items-center rounded-xl bg-destructive text-white shadow-sm">
							<Icon name="info" size={19} />
						</span>
						<span className="grid gap-0.5">
							<strong className="text-sm font-extrabold text-foreground">
								入力内容を確認してください
							</strong>
							<span className="text-sm font-semibold">
								未入力の項目が{Object.keys(fieldErrors).length}件あります
							</span>
						</span>
					</div>
				)}
				<div className="new-event-card-grid">
					<Card className="new-event-card h-full overflow-hidden">
						<CardHeader className="border-b border-border pb-6">
							<div className="flex items-center gap-3">
								<span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
									<Icon name="info" size={21} />
								</span>
								<CardTitle>イベント情報</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="flex-1">
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="title">
										イベント名 <Badge variant="destructive">必須</Badge>
									</FieldLabel>
									<Input
										id="title"
										name="title"
										required
										aria-invalid={Boolean(fieldErrors.title)}
										aria-describedby={
											fieldErrors.title ? "title-error" : undefined
										}
										onChange={() => clearFieldError("title")}
									/>
									{fieldErrors.title && (
										<p
											id="title-error"
											className="flex items-center gap-2 text-sm font-bold text-destructive"
										>
											<span className="grid size-5 place-items-center rounded-full bg-destructive text-xs text-white">
												!
											</span>
											{fieldErrors.title}
										</p>
									)}
								</Field>
								<Field>
									<FieldLabel htmlFor="description">
										説明 <Badge variant="outline">任意</Badge>
									</FieldLabel>
									<Textarea id="description" name="description" rows={4} />
								</Field>
								<div className="grid gap-5 md:grid-cols-2">
									<Field>
										<FieldLabel htmlFor="owner">
											主催者名 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<Input
											id="owner"
											name="display_name"
											required
											aria-invalid={Boolean(fieldErrors.display_name)}
											aria-describedby={
												fieldErrors.display_name ? "owner-error" : undefined
											}
											onChange={() => clearFieldError("display_name")}
										/>
										{fieldErrors.display_name && (
											<p
												id="owner-error"
												className="flex items-center gap-2 text-sm font-bold text-destructive"
											>
												<span className="grid size-5 place-items-center rounded-full bg-destructive text-xs text-white">
													!
												</span>
												{fieldErrors.display_name}
											</p>
										)}
									</Field>
									<Field>
										<FieldLabel htmlFor="timezone">
											タイムゾーン <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<Select name="time_zone" defaultValue="Asia/Tokyo">
											<SelectTrigger id="timezone">
												<SelectValue placeholder="タイムゾーンを選択" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="Asia/Tokyo">
													日本時間（Asia/Tokyo）
												</SelectItem>
											</SelectContent>
										</Select>
									</Field>
								</div>
								<Field className="new-event-results-visibility">
									<div>
										<FieldLabel htmlFor="results-visible-to-participants">
											回答結果の公開
										</FieldLabel>
										<p id="results-visibility-description">
											回答者がイベントの集計結果を閲覧できるようにします。
											作成後も結果画面から変更できます。
										</p>
									</div>
									<label className="new-event-results-toggle">
										<input
											id="results-visible-to-participants"
											className="new-event-results-toggle-input"
											name="results_visible_to_participants"
											type="checkbox"
											role="switch"
											value="true"
											checked={resultsVisible}
											aria-checked={resultsVisible}
											aria-describedby="results-visibility-description"
											onChange={(event) =>
												setResultsVisible(event.currentTarget.checked)
											}
										/>
										<span
											className="new-event-results-toggle-track"
											aria-hidden="true"
										>
											<span />
										</span>
										<strong>
											{resultsVisible ? "表示する" : "表示しない"}
										</strong>
									</label>
									<input
										type="hidden"
										name="results_visible_to_participants"
										value="false"
									/>
								</Field>
							</FieldGroup>
						</CardContent>
					</Card>

					<Card className="new-event-card h-full overflow-hidden">
						<CardHeader className="border-b border-border pb-6">
							<div className="flex items-center gap-3">
								<span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
									<Icon name="calendar" size={21} />
								</span>
								<CardTitle>調整する期間</CardTitle>
							</div>
						</CardHeader>
						<CardContent className="flex-1">
							<FieldGroup>
								<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
									<Field>
										<FieldLabel htmlFor="window-start-date">
											開始日 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<Input
											id="window-start-date"
											name="window_start_date"
											type="date"
											defaultValue={loaderData.windowStartAt.slice(0, 10)}
											required
										/>
									</Field>
									<span className="hidden h-14 items-center justify-center px-1 text-xl font-extrabold text-primary md:flex">
										→
									</span>
									<Field>
										<FieldLabel htmlFor="window-end-date">
											終了日 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<Input
											id="window-end-date"
											name="window_end_date"
											type="date"
											defaultValue={loaderData.windowEndAt.slice(0, 10)}
											required
										/>
									</Field>
								</div>

								<div className="grid gap-4 rounded-xl border border-primary/20 bg-secondary/45 p-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
									<Field>
										<FieldLabel htmlFor="daily-start-time">
											毎日の受付開始 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<Input
											id="daily-start-time"
											name="daily_start_time"
											type="time"
											step={TIME_INPUT_STEP_SECONDS}
											defaultValue={loaderData.windowStartAt.slice(11, 16)}
											required
										/>
									</Field>
									<span className="hidden h-14 items-center justify-center px-1 text-lg font-extrabold text-primary md:flex">
										〜
									</span>
									<Field>
										<FieldLabel htmlFor="daily-end-time">
											毎日の受付終了 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<Input
											id="daily-end-time"
											name="daily_end_time"
											type="time"
											step={TIME_INPUT_STEP_SECONDS}
											defaultValue={loaderData.windowEndAt.slice(11, 16)}
											required
										/>
									</Field>
								</div>
								<p className="text-sm font-semibold text-muted-foreground">
									参加者は期間中の各日、この時間帯の中で回答できます。
								</p>
								{scheduleError && (
									<p
										className="flex items-center gap-2 text-sm font-bold text-destructive"
										role="alert"
									>
										<Icon name="info" size={17} />
										{scheduleError}
									</p>
								)}

								<Field>
									<FieldLabel htmlFor="duration">
										イベントに必要な時間
										<Badge variant="destructive">必須</Badge>
									</FieldLabel>
									<Select name="duration_minutes" defaultValue="60">
										<SelectTrigger id="duration">
											<SelectValue placeholder="所要時間を選択" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="30">30分</SelectItem>
											<SelectItem value="60">1時間</SelectItem>
											<SelectItem value="90">1時間30分</SelectItem>
											<SelectItem value="120">2時間</SelectItem>
											<SelectItem value="180">3時間</SelectItem>
										</SelectContent>
									</Select>
								</Field>

								<Field>
									<FieldLabel htmlFor="deadline">
										回答期限 <Badge variant="outline">任意</Badge>
									</FieldLabel>
									<DateTimePicker
										id="deadline"
										name="response_deadline_at"
										defaultValue={loaderData.responseDeadlineAt}
									/>
								</Field>
							</FieldGroup>
						</CardContent>
					</Card>
				</div>

				<div className="flex flex-col items-center justify-center gap-3 pt-1 sm:flex-row-reverse">
					<Button
						className="event-create-button min-w-64"
						type="submit"
						size="lg"
						disabled={submitting}
					>
						{submitting ? "作成しています…" : "イベントを作成する"}
						<Icon name="arrow" size={19} />
					</Button>
					<span className="text-sm font-semibold text-muted-foreground">
						入力内容はあとから変更できます
					</span>
				</div>
			</Form>
		</PageShell>
	);
}
