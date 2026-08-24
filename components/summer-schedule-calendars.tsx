import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

type MonthSchedule = {
  year: number;
  month: number;
  label: string;
  /** Day-of-month values that fall in an available weekly schedule. */
  availableDays: number[];
  note: string;
};

const SUMMER_2026_SCHEDULES: MonthSchedule[] = [
  {
    year: 2026,
    month: 6,
    label: "June",
    availableDays: [8, 9, 10, 11, 12, 13, 14, 22, 23, 24, 25, 26, 27, 28],
    note: "Weeks of Jun 8 & Jun 22",
  },
  {
    year: 2026,
    month: 7,
    label: "July",
    availableDays: [
      6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 27, 28, 29, 30, 31,
    ],
    note: "Weeks of Jul 6, Jul 13 & Jul 27",
  },
  {
    year: 2026,
    month: 8,
    label: "August",
    availableDays: [3, 4, 5, 6, 7, 8, 9, 17, 18, 19, 20, 21, 22, 23],
    note: "Weeks of Aug 3 & Aug 17",
  },
];

type CalendarCell =
  | { type: "empty" }
  | { type: "day"; day: number; available: boolean };

function buildMonthCells(
  year: number,
  month: number,
  availableDays: number[],
): CalendarCell[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const available = new Set(availableDays);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ type: "empty" });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      type: "day",
      day,
      available: available.has(day),
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ type: "empty" });
  }

  return cells;
}

function chunkWeeks(cells: CalendarCell[]): CalendarCell[][] {
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function MiniMonthCalendar({ schedule }: { schedule: MonthSchedule }) {
  const cells = buildMonthCells(
    schedule.year,
    schedule.month,
    schedule.availableDays,
  );
  const weeks = chunkWeeks(cells);

  return (
    <article
      data-testid={`summer-calendar-${schedule.label.toLowerCase()}`}
      className="rounded-2xl border bg-background p-4 shadow-sm ring-1 ring-foreground/5"
    >
      <header className="mb-3 space-y-1">
        <h3 className="font-heading text-lg font-semibold tracking-tight">
          {schedule.label} {schedule.year}
        </h3>
        <p className="text-xs text-muted-foreground">{schedule.note}</p>
      </header>

      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="py-1">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-1 space-y-1">
        {weeks.map((week, weekIndex) => {
          const hasAvailable = week.some(
            (cell) => cell.type === "day" && cell.available,
          );
          return (
            <div
              key={`${schedule.label}-week-${weekIndex}`}
              className={cn(
                "grid grid-cols-7 rounded-md py-0.5",
                hasAvailable && "bg-zinc-900 text-white",
              )}
            >
              {week.map((cell, cellIndex) => {
                if (cell.type === "empty") {
                  return (
                    <span
                      key={`${schedule.label}-empty-${weekIndex}-${cellIndex}`}
                      className="py-1.5 text-center text-xs"
                    />
                  );
                }

                return (
                  <span
                    key={`${schedule.label}-day-${cell.day}`}
                    className={cn(
                      "py-1.5 text-center text-xs tabular-nums",
                      hasAvailable
                        ? cell.available
                          ? "font-semibold text-white"
                          : "text-white/40"
                        : "text-foreground/80",
                    )}
                  >
                    {cell.day}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </article>
  );
}

export function SummerScheduleCalendars() {
  return (
    <section
      data-testid="summer-schedules"
      className="mx-auto w-full max-w-6xl space-y-8 px-6 py-14 lg:py-16"
    >
      <div className="max-w-2xl space-y-3">
        <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          Summer 2026
        </p>
        <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Available weekly schedules
        </h2>
        <p className="text-muted-foreground">
          Highlighted weeks show open Summer 2026 training blocks for June,
          July, and August.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {SUMMER_2026_SCHEDULES.map((schedule) => (
          <MiniMonthCalendar key={schedule.label} schedule={schedule} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Dark weeks are open for registration. Remaining weeks are reserved or
        closed for this summer block.
      </p>
    </section>
  );
}
