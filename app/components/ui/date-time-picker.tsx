import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { CalendarIcon, Clock3Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { WeekendText } from "~/components/app";
import { parseDateInput, serializeDateInput } from "~/lib/date-input";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { PickerTrigger } from "./picker-trigger";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { TimePickerPanel } from "./time-picker";

type DateTimePickerProps = {
	id: string;
	name: string;
	value?: string;
	defaultValue?: string;
	onValueChange?: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
	"aria-label"?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
	className?: string;
};

export function DateTimePicker({
	id,
	name,
	value,
	defaultValue = "",
	onValueChange,
	required = false,
	disabled = false,
	"aria-label": ariaLabel,
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	className,
}: DateTimePickerProps) {
	const [open, setOpen] = useState(false);
	const [panel, setPanel] = useState<"date" | "time">("date");
	const [internalValue, setInternalValue] = useState(defaultValue);
	const currentValue = value ?? internalValue;
	const date = parseDateInput(currentValue.slice(0, 10));
	const [emptyTime, setEmptyTime] = useState("09:00");
	const time = currentValue.slice(11, 16) || emptyTime;
	const updateValue = (nextDate: Date | undefined, nextTime: string) => {
		const next = nextDate ? `${serializeDateInput(nextDate)}T${nextTime}` : "";
		setEmptyTime(nextTime);
		if (value === undefined) setInternalValue(next);
		onValueChange?.(next);
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setPanel("date");
			}}
		>
			<input
				type="hidden"
				name={name}
				value={currentValue}
				disabled={disabled}
			/>
			<PopoverTrigger asChild>
				<PickerTrigger
					id={id}
					icon={CalendarIcon}
					placeholder={!date}
					disabled={disabled}
					data-required={required || undefined}
					aria-label={ariaLabel}
					aria-describedby={ariaDescribedBy}
					aria-invalid={ariaInvalid}
					className={cn("date-time-picker-trigger", className)}
				>
					{date ? (
						<>
							<WeekendText>
								{format(date, "yyyy年M月d日(E)", { locale: ja })}
							</WeekendText>
							<span className="date-time-picker-time">
								<Clock3Icon size={14} aria-hidden="true" /> {time}
							</span>
						</>
					) : (
						"日付と時刻を選択"
					)}
				</PickerTrigger>
			</PopoverTrigger>
			<PopoverContent
				className="picker-popover date-time-picker-popover max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,calc(100vw-1.5rem))]"
				align="start"
				aria-label={ariaLabel ?? "日付と時刻を選択"}
				collisionPadding={{ top: 88, right: 12, bottom: 12, left: 12 }}
			>
				<fieldset className="picker-switcher" aria-label="入力内容の切り替え">
					<button
						type="button"
						aria-pressed={panel === "date"}
						onClick={() => setPanel("date")}
					>
						<CalendarIcon size={16} aria-hidden="true" /> 日付
					</button>
					<button
						type="button"
						aria-pressed={panel === "time"}
						aria-label={`時刻 ${time}`}
						onClick={() => setPanel("time")}
					>
						<Clock3Icon size={16} aria-hidden="true" /> {time}
					</button>
				</fieldset>
				<div className="picker-panel-scroll">
					{panel === "date" ? (
						<Calendar
							mode="single"
							required={required}
							selected={date}
							onSelect={(next: Date | undefined) => updateValue(next, time)}
							defaultMonth={date}
							fixedWeeks
						/>
					) : (
						<TimePickerPanel
							value={time}
							onValueChange={(next) => updateValue(date, next)}
						/>
					)}
				</div>
				<div className="picker-footer">
					{panel === "time" ? (
						<Button
							type="button"
							size="sm"
							className="w-full"
							onClick={() => setPanel("date")}
						>
							この時刻にする
						</Button>
					) : (
						<>
							{!required && date && (
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => {
										updateValue(undefined, "09:00");
										setOpen(false);
									}}
								>
									<XIcon size={16} aria-hidden="true" /> クリア
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
						</>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
