import { cn } from "@/lib/utils";

const REGISTRATION_FEE = 175;

const SIX_MONTH_PLAYER_TREND = [
  { month: "March", players: 8 },
  { month: "April", players: 12 },
  { month: "May", players: 15 },
  { month: "June", players: 18 },
  { month: "July", players: 24 },
  { month: "August", players: 31 },
] as const;

const WEEKLY_ATTENDANCE = [
  { month: "June", week: "W1", label: "Jun 1", attendance: 22 },
  { month: "June", week: "W2", label: "Jun 8", attendance: 28 },
  { month: "June", week: "W3", label: "Jun 15", attendance: 25 },
  { month: "June", week: "W4", label: "Jun 22", attendance: 31 },
  { month: "July", week: "W1", label: "Jul 6", attendance: 34 },
  { month: "July", week: "W2", label: "Jul 13", attendance: 37 },
  { month: "July", week: "W3", label: "Jul 20", attendance: 33 },
  { month: "July", week: "W4", label: "Jul 27", attendance: 39 },
  { month: "August", week: "W1", label: "Aug 3", attendance: 36 },
  { month: "August", week: "W2", label: "Aug 10", attendance: 41 },
  { month: "August", week: "W3", label: "Aug 17", attendance: 38 },
  { month: "August", week: "W4", label: "Aug 24", attendance: 44 },
] as const;

type RegistrationInsightsProps = {
  registeredPlayers: number;
  rosterPlayers: number;
  paymentLinksSent: number;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function PlayerTrendLine({
  points,
}: {
  points: readonly { month: string; players: number }[];
}) {
  const width = 480;
  const height = 170;
  const padding = { top: 18, right: 12, bottom: 28, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxPlayers = Math.max(...points.map((point) => point.players), 1);

  const coords = points.map((point, index) => {
    const x =
      padding.left +
      (points.length === 1
        ? chartWidth / 2
        : (index / (points.length - 1)) * chartWidth);
    const y =
      padding.top + chartHeight - (point.players / maxPlayers) * chartHeight;
    return { ...point, x, y };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = [
    `M ${coords[0].x} ${padding.top + chartHeight}`,
    ...coords.map((point) => `L ${point.x} ${point.y}`),
    `L ${coords[coords.length - 1].x} ${padding.top + chartHeight}`,
    "Z",
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-44 w-full"
      role="img"
      aria-label="Player registrations across six months"
    >
      <defs>
        <linearGradient id="player-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.205 0 0)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="oklch(0.205 0 0)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartHeight - ratio * chartHeight;
        return (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            className="stroke-border"
            strokeWidth="1"
          />
        );
      })}

      <path d={areaPath} fill="url(#player-trend-fill)" />
      <path
        d={linePath}
        fill="none"
        className="stroke-foreground"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {coords.map((point) => (
        <g key={point.month}>
          <circle
            cx={point.x}
            cy={point.y}
            r="4"
            className="fill-background stroke-foreground"
            strokeWidth="2"
          />
          <text
            x={point.x}
            y={point.y - 10}
            textAnchor="middle"
            className="fill-foreground text-[9px] font-semibold"
          >
            {point.players}
          </text>
          <text
            x={point.x}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted-foreground text-[9px] font-medium uppercase"
          >
            {point.month.slice(0, 3)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function WeeklyAttendanceBars({
  weeks,
}: {
  weeks: readonly {
    month: string;
    week: string;
    label: string;
    attendance: number;
  }[];
}) {
  const width = 560;
  const height = 200;
  const padding = { top: 20, right: 12, bottom: 36, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxAttendance = Math.max(...weeks.map((week) => week.attendance), 1);
  const gap = 4;
  const barWidth = (chartWidth - gap * (weeks.length - 1)) / weeks.length;

  const monthColors: Record<string, string> = {
    June: "fill-zinc-700",
    July: "fill-zinc-900",
    August: "fill-zinc-500",
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-52 w-full"
      role="img"
      aria-label="Weekly team attendance for June, July, and August"
    >
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = padding.top + chartHeight - ratio * chartHeight;
        return (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            className="stroke-border"
            strokeWidth="1"
          />
        );
      })}

      {weeks.map((week, index) => {
        const barHeight = (week.attendance / maxAttendance) * chartHeight;
        const x = padding.left + index * (barWidth + gap);
        const y = padding.top + chartHeight - barHeight;
        return (
          <g key={`${week.month}-${week.week}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx="3"
              className={cn(monthColors[week.month] ?? "fill-zinc-800")}
            />
            <text
              x={x + barWidth / 2}
              y={y - 6}
              textAnchor="middle"
              className="fill-foreground text-[8px] font-semibold"
            >
              {week.attendance}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[7px] font-medium"
            >
              {week.week}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[7px]"
            >
              {week.month.slice(0, 3)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RegistrationInsights({
  registeredPlayers,
  rosterPlayers,
  paymentLinksSent,
}: RegistrationInsightsProps) {
  const revenueCollected = paymentLinksSent * REGISTRATION_FEE;
  const teamCount = Math.max(1, Math.ceil(rosterPlayers / 8));

  const cards = [
    {
      label: "Revenue collected",
      value: formatCurrency(revenueCollected),
      detail: `${paymentLinksSent} paid registration${paymentLinksSent === 1 ? "" : "s"}`,
    },
    {
      label: "Number of teams",
      value: String(teamCount),
      detail: "Based on current roster size",
    },
    {
      label: "Registered vs roster",
      value: `${registeredPlayers} / ${rosterPlayers}`,
      detail:
        registeredPlayers === rosterPlayers
          ? "All registered players are rostered"
          : `${Math.max(registeredPlayers - rosterPlayers, 0)} awaiting roster placement`,
    },
  ] as const;

  return (
    <section data-testid="registration-insights" className="space-y-4">
      <div className="space-y-1">
        <h3 className="font-heading text-xl font-medium">Insights</h3>
        <p className="text-sm text-muted-foreground">
          Snapshot of registration health, six-month growth, and summer
          attendance.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border bg-background p-4 shadow-sm ring-1 ring-foreground/5"
          >
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {card.label}
            </p>
            <p className="mt-2 font-heading text-2xl font-semibold tracking-tight">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
          </article>
        ))}
      </div>

      <article
        data-testid="registration-player-trend"
        className="rounded-xl border bg-background p-4 shadow-sm ring-1 ring-foreground/5 sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Player trend
            </p>
            <h4 className="font-heading text-lg font-medium">
              March through August
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">Players registered</p>
        </div>
        <PlayerTrendLine points={SIX_MONTH_PLAYER_TREND} />
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {SIX_MONTH_PLAYER_TREND.map((point, index) => {
            const previous = SIX_MONTH_PLAYER_TREND[index - 1];
            const delta = previous ? point.players - previous.players : null;
            return (
              <span
                key={point.month}
                className="inline-flex items-center gap-1.5"
              >
                <span className="font-medium text-foreground">
                  {point.month.slice(0, 3)}
                </span>
                {point.players}
                {delta !== null ? (
                  <span
                    className={cn(
                      "font-medium",
                      delta >= 0 ? "text-emerald-700" : "text-red-700",
                    )}
                  >
                    {delta >= 0 ? `+${delta}` : delta}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </article>

      <article
        data-testid="registration-attendance-bars"
        className="rounded-xl border bg-background p-4 shadow-sm ring-1 ring-foreground/5 sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Team attendance
            </p>
            <h4 className="font-heading text-lg font-medium">
              Weekly · June, July, August
            </h4>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-zinc-700" aria-hidden />
              June
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-zinc-900" aria-hidden />
              July
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-zinc-500" aria-hidden />
              August
            </span>
          </div>
        </div>
        <WeeklyAttendanceBars weeks={WEEKLY_ATTENDANCE} />
      </article>
    </section>
  );
}
