import { parseDateInput } from "./date-input";
import { isTimeValue } from "./time";

export function validateEventForm(form: FormData, requireDisplayName = false) {
	const errors: Record<string, string> = {};
	const get = (name: string) => String(form.get(name) ?? "").trim();
	if (!get("title")) errors.title = "イベント名を入力してください";
	if (requireDisplayName && !get("display_name"))
		errors.display_name = "主催者名を入力してください";
	const startDate = get("window_start_date");
	const endDate = get("window_end_date");
	const startTime = get("daily_start_time");
	const endTime = get("daily_end_time");
	if (!parseDateInput(startDate))
		errors.window_start_date = "開始日を選択してください";
	if (!parseDateInput(endDate))
		errors.window_end_date = "終了日を選択してください";
	else if (parseDateInput(startDate) && startDate > endDate)
		errors.window_end_date = "終了日は開始日以降にしてください";
	if (!isTimeValue(startTime))
		errors.daily_start_time = "開始時刻を選択してください";
	if (!isTimeValue(endTime))
		errors.daily_end_time = "終了時刻を選択してください";
	else if (isTimeValue(startTime) && startTime >= endTime)
		errors.daily_end_time = "毎日の終了時刻は開始時刻より後にしてください";
	const deadline = get("response_deadline_at");
	if (
		deadline &&
		(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadline) ||
			!parseDateInput(deadline.slice(0, 10)) ||
			!isTimeValue(deadline.slice(11)))
	) {
		errors.response_deadline_at = "回答期限の日付と時刻を選択してください";
	} else if (
		deadline &&
		!errors.window_end_date &&
		!errors.daily_end_time &&
		deadline > `${endDate}T${endTime}`
	) {
		errors.response_deadline_at = "回答期限は調整期間の終了以前にしてください";
	}
	const duration = Number(get("duration_minutes"));
	if (!Number.isInteger(duration) || duration < 5 || duration > 1440)
		errors.duration_minutes = "必要時間は5〜1,440分の整数で入力してください";
	return errors;
}
