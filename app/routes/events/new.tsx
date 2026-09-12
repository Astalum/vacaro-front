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
	type User,
} from "../../lib/api";
import type { Route } from "./+types/new";

export function meta() {
	return [{ title: "イベントを作る | vacaro" }];
}

export async function clientAction({ request }: Route.ClientActionArgs) {
	const formData = await request.formData();
	const displayName = String(formData.get("display_name") ?? "").trim();
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
				window_start_at: localDateTimeToIso(formData.get("window_start_at")),
				window_end_at: localDateTimeToIso(formData.get("window_end_at")),
				duration_minutes: Number(formData.get("duration_minutes")),
				response_deadline_at: localDateTimeToIso(
					formData.get("response_deadline_at"),
				),
			}),
		});
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

export default function NewEvent({ actionData }: Route.ComponentProps) {
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";
	return (
		<PageShell>
			<PageIntro
				eyebrow="CREATE EVENT"
				title="イベントを作る"
				description="日程を調整する期間と、イベントに必要な時間を決めましょう。"
				backTo="/"
				backLabel="トップへ戻る"
			/>
			<Form className="new-event-form space-y-6" method="post">
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
										defaultValue="プロジェクト打ち上げ 🎉"
										required
									/>
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
											defaultValue="山田 太郎"
											required
										/>
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
										<FieldLabel htmlFor="window-start">
											期間の開始 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<DateTimePicker
											id="window-start"
											name="window_start_at"
											defaultValue="2026-06-14T09:00"
											required
										/>
									</Field>
									<span className="hidden h-14 items-center justify-center px-1 text-xl font-extrabold text-primary md:flex">
										→
									</span>
									<Field>
										<FieldLabel htmlFor="window-end">
											期間の終了 <Badge variant="destructive">必須</Badge>
										</FieldLabel>
										<DateTimePicker
											id="window-end"
											name="window_end_at"
											defaultValue="2026-06-21T22:00"
											required
										/>
									</Field>
								</div>

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
										defaultValue="2026-06-12T23:59"
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
