import { type FormEvent, useState } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import { Icon, PageIntro, PageShell } from "~/components/app";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { DatePicker } from "~/components/ui/date-picker";
import { DateTimePicker } from "~/components/ui/date-time-picker";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { TimePicker } from "~/components/ui/time-picker";
import { useFormErrors } from "~/components/ui/use-form-errors";
import {
	FieldError,
	ValidationMessage,
} from "~/components/ui/validation-message";
import {
	ApiError,
	apiErrorData,
	apiRequest,
	browserTimeZone,
	type EventWithInvite,
	isValidTimeZone,
	localDateTimeToIso,
	saveEventInviteUrl,
	type User,
} from "~/lib/api";
import { validateEventForm } from "~/lib/event-form-validation";
import { createPageMeta } from "~/lib/meta";
import { getNewEventDefaults } from "~/lib/new-event-defaults";
import { isTimeValue } from "~/lib/time";
import type { Route } from "./+types/new";

export function meta() {
	return createPageMeta("イベントを作る | vacaro");
}

export async function clientLoader() {
	let user: User | null = null;
	try {
		user = await apiRequest<User>("/me");
	} catch (error) {
		if (!(error instanceof ApiError) || error.status !== 401) throw error;
	}
	const timeZone = user?.time_zone ?? browserTimeZone();
	return {
		...getNewEventDefaults(new Date(), timeZone),
		timeZone,
		displayName: user?.display_name ?? "",
	};
}
clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<PageShell>
			<div className="page-loading">ユーザー設定を読み込んでいます…</div>
		</PageShell>
	);
}

const controlIds: Record<string, string> = {
	title: "title",
	display_name: "owner",
	window_start_date: "window-start-date",
	window_end_date: "window-end-date",
	daily_start_time: "daily-start-time",
	daily_end_time: "daily-end-time",
	response_deadline_at: "deadline",
	duration_minutes: "duration",
};

export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const displayName = String(formData.get("display_name") ?? "").trim();
	const windowStartDate = String(formData.get("window_start_date") ?? "");
	const windowEndDate = String(formData.get("window_end_date") ?? "");
	const dailyStartTime = String(formData.get("daily_start_time") ?? "");
	const dailyEndTime = String(formData.get("daily_end_time") ?? "");
	const responseDeadlineAt = String(formData.get("response_deadline_at") ?? "");
	const timeZone = String(formData.get("time_zone") ?? "").trim();
	const durationMinutes = Number(formData.get("duration_minutes"));
	const schedulingMode = String(
		formData.get("scheduling_mode") ?? "whole_event",
	);
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
	const windowStartIso = localDateTimeToIso(windowStartAt, timeZone);
	const windowEndIso = localDateTimeToIso(windowEndAt, timeZone);
	const responseDeadlineIso = responseDeadlineAt
		? localDateTimeToIso(responseDeadlineAt, timeZone)
		: null;
	if (
		!isValidTimeZone(timeZone) ||
		!windowStartIso ||
		!windowEndIso ||
		(responseDeadlineAt && !responseDeadlineIso) ||
		!Number.isInteger(durationMinutes) ||
		durationMinutes < 5 ||
		durationMinutes > 1440 ||
		(schedulingMode !== "whole_event" && schedulingMode !== "groups")
	) {
		return data(
			{
				error: {
					code: "validation_failed",
					message:
						"タイムゾーン、必要時間、調整単位、または日時を確認してください",
					fields: null,
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
					body: JSON.stringify({
						display_name: displayName,
						time_zone: me.time_zone,
					}),
				});
			}
		} catch (error) {
			if (!(error instanceof ApiError) || error.status !== 401) throw error;
			await apiRequest<User>("/guest-sessions", {
				method: "POST",
				body: JSON.stringify({
					display_name: displayName,
					time_zone: timeZone,
				}),
			});
		}

		const created = await apiRequest<EventWithInvite>("/events", {
			method: "POST",
			body: JSON.stringify({
				title: String(formData.get("title") ?? ""),
				description: String(formData.get("description") ?? "") || null,
				window_start_at: windowStartIso,
				window_end_at: windowEndIso,
				duration_minutes: durationMinutes,
				scheduling_mode: schedulingMode,
				results_visible_to_participants: resultsVisibleToParticipants,
				response_deadline_at: responseDeadlineIso,
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
	const {
		errors: fieldErrors,
		localErrors,
		setErrors,
		clearError: clearFieldError,
		inputProps,
	} = useFormErrors(actionData?.error.fields);
	const [resultsVisible, setResultsVisible] = useState(true);
	const hasFieldErrors = Object.keys(localErrors).length > 0;

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		const nextErrors = validateEventForm(
			new FormData(event.currentTarget),
			true,
		);
		setErrors(nextErrors);
		const first = Object.keys(nextErrors)[0];
		if (!first) return;
		event.preventDefault();
		document.getElementById(controlIds[first])?.focus();
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
					<ValidationMessage
						title={actionData.error.message}
						fields={actionData.error.fields}
					>
						入力内容をもう一度ご確認ください。
					</ValidationMessage>
				)}
				{hasFieldErrors && (
					<ValidationMessage>
						{Object.keys(localErrors).every(
							(name) => name === "title" || name === "display_name",
						)
							? `未入力の項目が${Object.keys(localErrors).length}件あります`
							: `修正が必要な項目が${Object.keys(localErrors).length}件あります。各入力欄のメッセージをご確認ください。`}
					</ValidationMessage>
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
										<FieldError id="title-error">
											{fieldErrors.title}
										</FieldError>
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
											defaultValue={loaderData.displayName}
											required
											aria-invalid={Boolean(fieldErrors.display_name)}
											aria-describedby={
												fieldErrors.display_name ? "owner-error" : undefined
											}
											onChange={() => clearFieldError("display_name")}
										/>
										{fieldErrors.display_name && (
											<FieldError id="owner-error">
												{fieldErrors.display_name}
											</FieldError>
										)}
									</Field>
									<input
										type="hidden"
										name="time_zone"
										value={loaderData.timeZone}
									/>
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
										<DatePicker
											id="window-start-date"
											name="window_start_date"
											{...inputProps("window_start_date", "window-start-date")}
											onValueChange={() => {
												clearFieldError("window_start_date");
												clearFieldError("window_end_date");
											}}
											defaultValue={loaderData.windowStartAt.slice(0, 10)}
											required
										/>
										<FieldError id="window-start-date-error">
											{fieldErrors.window_start_date}
										</FieldError>
									</Field>
									<span className="hidden h-14 items-center justify-center px-1 text-xl font-extrabold text-primary md:flex">
										→
									</span>
									<Field>
										<FieldLabel htmlFor="window-end-date">
											終了日 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<DatePicker
											id="window-end-date"
											name="window_end_date"
											{...inputProps("window_end_date", "window-end-date")}
											onValueChange={() => clearFieldError("window_end_date")}
											defaultValue={loaderData.windowEndAt.slice(0, 10)}
											required
										/>
										<FieldError id="window-end-date-error">
											{fieldErrors.window_end_date}
										</FieldError>
									</Field>
								</div>

								<div className="new-event-time-range grid gap-4 rounded-xl border border-primary/20 bg-secondary/45 p-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
									<Field>
										<FieldLabel htmlFor="daily-start-time">
											毎日の受付開始 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<TimePicker
											id="daily-start-time"
											name="daily_start_time"
											{...inputProps("daily_start_time", "daily-start-time")}
											onValueChange={() => {
												clearFieldError("daily_start_time");
												clearFieldError("daily_end_time");
											}}
											defaultValue={loaderData.windowStartAt.slice(11, 16)}
											required
										/>
										<FieldError id="daily-start-time-error">
											{fieldErrors.daily_start_time}
										</FieldError>
									</Field>
									<span className="hidden h-14 items-center justify-center px-1 text-lg font-extrabold text-primary md:flex">
										〜
									</span>
									<Field>
										<FieldLabel htmlFor="daily-end-time">
											毎日の受付終了 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<TimePicker
											id="daily-end-time"
											name="daily_end_time"
											{...inputProps("daily_end_time", "daily-end-time")}
											onValueChange={() => clearFieldError("daily_end_time")}
											defaultValue={loaderData.windowEndAt.slice(11, 16)}
											required
										/>
										<FieldError id="daily-end-time-error">
											{fieldErrors.daily_end_time}
										</FieldError>
									</Field>
								</div>
								<p className="text-sm font-semibold text-muted-foreground">
									参加者は期間中の各日、この時間帯の中で回答できます。
								</p>

								<Field>
									<FieldLabel htmlFor="duration">
										イベントに必要な時間
										<Badge variant="destructive">必須</Badge>
									</FieldLabel>
									<Input
										id="duration"
										name="duration_minutes"
										{...inputProps("duration_minutes", "duration")}
										onChange={() => clearFieldError("duration_minutes")}
										type="number"
										min={5}
										max={1440}
										step={1}
										defaultValue={60}
										required
									/>
									<FieldError id="duration-error">
										{fieldErrors.duration_minutes}
									</FieldError>
									<p className="text-sm text-muted-foreground">
										5～1,440分の範囲で1分単位に指定できます。
									</p>
								</Field>

								<Field>
									<FieldLabel htmlFor="scheduling-mode">
										調整単位 <Badge variant="destructive">必須</Badge>
									</FieldLabel>
									<Select name="scheduling_mode" defaultValue="whole_event">
										<SelectTrigger id="scheduling-mode">
											<SelectValue placeholder="調整単位を選択" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="whole_event">
												イベント全体で調整
											</SelectItem>
											<SelectItem value="groups">
												小グループごとに調整
											</SelectItem>
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
										{...inputProps("response_deadline_at", "deadline")}
										onValueChange={() =>
											clearFieldError("response_deadline_at")
										}
										defaultValue={loaderData.responseDeadlineAt}
									/>
									<FieldError id="deadline-error">
										{fieldErrors.response_deadline_at}
									</FieldError>
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
