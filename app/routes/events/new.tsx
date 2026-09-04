import { data, Form, redirect, useNavigation } from "react-router";
import { Icon, PageIntro, PageShell } from "../../components/ui";
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
	return [{ title: "イベントを作る | yotei" }];
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
		<PageShell narrow>
			<PageIntro
				eyebrow="CREATE EVENT"
				title="イベントを作る"
				description="日程を調整する期間と、イベントに必要な時間を決めましょう。"
				backTo="/"
				backLabel="トップへ戻る"
			/>
			<ol className="progress-steps" aria-label="作成ステップ">
				<li className="active">
					<b>1</b>
					<span>イベント情報</span>
				</li>
				<li className="active">
					<b>2</b>
					<span>調整条件</span>
				</li>
				<li>
					<b>3</b>
					<span>作成完了</span>
				</li>
			</ol>
			<Form className="form-stack" method="post">
				{actionData?.error && (
					<div className="form-error">
						<Icon name="info" size={17} />
						<span>
							<strong>{actionData.error.message}</strong>
							{actionData.error.fields &&
								Object.values(actionData.error.fields).join(" / ")}
						</span>
					</div>
				)}
				<section className="form-section">
					<div className="form-section-title">
						<span>01</span>
						<div>
							<h2>イベント情報</h2>
							<p>参加者に表示される基本情報です。</p>
						</div>
					</div>
					<div className="field">
						<label htmlFor="title">
							イベント名 <em>必須</em>
						</label>
						<input
							id="title"
							name="title"
							defaultValue="プロジェクト打ち上げ 🎉"
							required
						/>
					</div>
					<div className="field">
						<label htmlFor="description">
							説明 <small>任意</small>
						</label>
						<textarea
							id="description"
							name="description"
							rows={4}
							defaultValue="半年間のプロジェクト、本当にお疲れさまでした！みんなでゆっくりご飯を食べましょう。"
						/>
						<span className="field-hint">
							場所や目的など、参加者に伝えたいことを書けます。
						</span>
					</div>
					<div className="two-cols">
						<div className="field">
							<label htmlFor="owner">
								主催者名 <em>必須</em>
							</label>
							<input
								id="owner"
								name="display_name"
								defaultValue="山田 太郎"
								required
							/>
						</div>
						<div className="field">
							<label htmlFor="timezone">
								タイムゾーン <em>必須</em>
							</label>
							<select id="timezone" name="time_zone" defaultValue="Asia/Tokyo">
								<option value="Asia/Tokyo">日本時間（Asia/Tokyo）</option>
							</select>
						</div>
					</div>
				</section>
				<section className="form-section">
					<div className="form-section-title">
						<span>02</span>
						<div>
							<h2>調整する期間</h2>
							<p>参加者はこの期間内で、空いている時間を自由に登録します。</p>
						</div>
					</div>
					<div className="window-fields">
						<div className="field">
							<label htmlFor="window-start">
								期間の開始 <em>必須</em>
							</label>
							<input
								id="window-start"
								name="window_start_at"
								type="datetime-local"
								defaultValue="2026-06-14T09:00"
								required
							/>
						</div>
						<span className="window-arrow">→</span>
						<div className="field">
							<label htmlFor="window-end">
								期間の終了 <em>必須</em>
							</label>
							<input
								id="window-end"
								name="window_end_at"
								type="datetime-local"
								defaultValue="2026-06-21T22:00"
								required
							/>
						</div>
					</div>
					<div className="duration-box">
						<div className="duration-icon">
							<Icon name="clock" />
						</div>
						<div className="field">
							<label htmlFor="duration">
								イベントに必要な時間 <em>必須</em>
							</label>
							<select id="duration" name="duration_minutes" defaultValue="120">
								<option value="30">30分</option>
								<option value="60">1時間</option>
								<option value="90">1時間30分</option>
								<option value="120">2時間</option>
								<option value="180">3時間</option>
							</select>
							<span className="field-hint">
								この長さ以上、全員の予定が重なる時間を候補として探します。
							</span>
						</div>
					</div>
					<div className="field">
						<label htmlFor="deadline">
							回答期限 <small>任意</small>
						</label>
						<input
							id="deadline"
							name="response_deadline_at"
							type="datetime-local"
							defaultValue="2026-06-12T23:59"
						/>
					</div>
				</section>
				<div className="form-notice">
					<Icon name="sparkle" size={17} />
					<span>
						<strong>候補日時を並べる必要はありません</strong>
						参加者が登録した空き時間から、参加可能人数が多い時間を自動で見つけます。
					</span>
				</div>
				<div className="form-actions">
					<button
						className="button button-primary button-large"
						type="submit"
						disabled={submitting}
					>
						{submitting ? "作成しています…" : "イベントを作成する"}{" "}
						<Icon name="arrow" size={18} />
					</button>
					<span>入力内容はあとから変更できます</span>
				</div>
			</Form>
		</PageShell>
	);
}
