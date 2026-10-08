import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Clock3Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { TIME_INPUT_STEP_SECONDS } from "~/lib/time";
import { cn } from "~/lib/utils";
import { WeekendText } from "../ui";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type DateTimePickerProps = {
	id: string;
	name: string;
	defaultValue?: string;
	required?: boolean;
	disabled?: boolean;
	className?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

function parseLocalDateTime(value?: string) {
	const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
	if (!match) return undefined;
	const [, year, month, day] = match;
	return new Date(Number(year), Number(month) - 1, Number(day));
}

function serializeLocalDateTime(date: Date | undefined, time: string) {
	if (!date) return "";
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}

export function DateTimePicker({
	id,
	name,
	defaultValue,
	required = false,
	disabled = false,
	className,
}: DateTimePickerProps) {
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState<Date | undefined>(() =>
		parseLocalDateTime(defaultValue),
	);
	const [time, setTime] = useState(
		() => defaultValue?.slice(11, 16) || "09:00",
	);
	const value = serializeLocalDateTime(date, time);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<input type="hidden" name={name} value={value} />
			<PopoverTrigger asChild>
				<button
					id={id}
					type="button"
					disabled={disabled}
					data-required={required || undefined}
					className={cn(
						"border-input text-foreground flex h-14 w-full min-w-0 items-center gap-3 rounded-xl border bg-white px-4 text-left text-lg font-semibold shadow-[0_6px_18px_rgba(23,61,52,0.06)] outline-none transition-[border-color,box-shadow,background-color] hover:border-primary/50 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50",
						className,
					)}
				>
					<span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
						<CalendarIcon className="size-4" />
					</span>
					<span
						className={cn(
							"min-w-0 flex-1 truncate",
							!date && "text-muted-foreground",
						)}
					>
						{date ? (
							<>
								<WeekendText>
									{format(date, "yyyy年M月d日(E)", { locale: ja })}
								</WeekendText>{" "}
								{time}
							</>
						) : (
							"日付と時刻を選択"
						)}
					</span>
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden"
				align="start"
				collisionPadding={{ top: 88, right: 12, bottom: 12, left: 12 }}
			>
				<Calendar
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
					mode="single"
					required={required}
					selected={date}
					onSelect={setDate}
					defaultMonth={date}
					locale={ja}
					fixedWeeks
				/>
				<div className="flex shrink-0 items-center gap-2 border-t border-border bg-muted/40 p-3">
					<Clock3Icon className="size-4 shrink-0 text-primary" />
					<input
						type="time"
						aria-label="時刻"
						step={TIME_INPUT_STEP_SECONDS}
						value={time}
						onChange={(event) => setTime(event.currentTarget.value)}
						className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-white px-3 text-base font-bold outline-none focus:border-ring focus:ring-3 focus:ring-ring/20"
					/>
					{!required && date && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-10"
							aria-label="選択をクリア"
							onClick={() => setDate(undefined)}
						>
							<XIcon className="size-4" />
						</Button>
					)}
					<Button
						type="button"
						size="sm"
						disabled={!date}
						onClick={() => setOpen(false)}
					>
						決定
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
