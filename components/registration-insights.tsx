import { StatTile } from "@/components/stat-tile";
import {
  buildClinicEnrollment,
  buildPlayerTrend,
  sumPaidRevenue,
  type ClinicEnrollmentBar,
  type PlayerTrendPoint,
} from "@/lib/insights";
import { isPlayerPaid } from "@/lib/payment";
import type { AppState } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Rough team size used for the estimated team count tile. */
const PLAYERS_PER_TEAM = 8;

type RegistrationInsightsProps = {
  state: AppState;
  /** Program whose clinics fill the enrollment chart. */
  programId?: string;
  programLabel: string;
  rosterPlayers: number;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-44 items-center justify-center rounded-lg bg-surface-muted text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function PlayerTrendLine({ points }: { points: readonly PlayerTrendPoint[] }) {
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
      aria-label="Players enrolled per month"
    >
      <defs>
        <linearGradient id="player-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
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
        className="stroke-brand-strong"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {coords.map((point) => (
        <g key={`${point.year}-${point.month}`}>
          <circle
            cx={point.x}
            cy={point.y}
            r="4"
            className="fill-background stroke-brand-strong"
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
            {point.label.slice(0, 3)}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ClinicEnrollmentBars({
  bars,
}: {
  bars: readonly ClinicEnrollmentBar[];
}) {
  const width = 560;
  const height = 200;
  const padding = { top: 20, right: 12, bottom: 36, left: 28 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    ...bars.map((bar) => Math.max(bar.capacity, bar.enrolled)),
    1,
  );
  const gap = 8;
  const barWidth = Math.min(
    64,
    (chartWidth - gap * (bars.length - 1)) / bars.length,
  );
  const offset =
    (chartWidth - (barWidth * bars.length + gap * (bars.length - 1))) / 2;
  const baseline = padding.top + chartHeight;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-52 w-full"
      role="img"
      aria-label="Players enrolled against capacity for each clinic"
    >
      {[0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = baseline - ratio * chartHeight;
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

      {bars.map((bar, index) => {
        const x = padding.left + offset + index * (barWidth + gap);
        const capacityHeight = (bar.capacity / maxValue) * chartHeight;
        const enrolledHeight = (bar.enrolled / maxValue) * chartHeight;
        return (
          <g key={bar.sessionId}>
            <rect
              x={x}
              y={baseline - capacityHeight}
              width={barWidth}
              height={capacityHeight}
              rx="3"
              className="fill-muted"
            />
            <rect
              x={x}
              y={baseline - enrolledHeight}
              width={barWidth}
              height={enrolledHeight}
              rx="3"
              className="fill-chart-1"
            />
            <text
              x={x + barWidth / 2}
              y={baseline - capacityHeight - 6}
              textAnchor="middle"
              className="fill-foreground text-[8px] font-semibold"
            >
              {bar.enrolled}/{bar.capacity}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[7px] font-medium"
            >
              {bar.label}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[7px]"
            >
              {bar.monthLabel}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function RegistrationInsights({
  state,
  programId,
  programLabel,
  rosterPlayers,
}: RegistrationInsightsProps) {
  const registeredPlayers = state.players.length;
  const paidCount = state.players.filter(isPlayerPaid).length;
  const revenueCollected = sumPaidRevenue(state.players);
  const teamCount = Math.max(1, Math.ceil(rosterPlayers / PLAYERS_PER_TEAM));
  const trend = buildPlayerTrend(state.players, state.sessions);
  const enrollment = programId ? buildClinicEnrollment(state, programId) : [];

  const cards = [
    {
      label: "Revenue collected",
      tone: "success",
      value: formatCurrency(revenueCollected),
      detail: `${paidCount} paid registration${paidCount === 1 ? "" : "s"}`,
    },
    {
      label: "Estimated teams",
      tone: "accent",
      value: String(teamCount),
      detail: `${programLabel} roster ÷ ${PLAYERS_PER_TEAM} players`,
    },
    {
      label: "Registered vs roster",
      tone: "info",
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
          Snapshot of registration health, monthly enrollment, and clinic
          capacity.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <StatTile
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
            tone={card.tone}
            size="md"
          />
        ))}
      </div>

      <article
        data-testid="registration-player-trend"
        className="rounded-xl border bg-background p-4 shadow-sm sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Player trend
            </p>
            <h4 className="font-heading text-lg font-medium">
              {trend.length > 0
                ? `${trend[0].label} ${trend[0].year} – ${trend[trend.length - 1].label} ${trend[trend.length - 1].year}`
                : "No clinics yet"}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground">Players enrolled</p>
        </div>
        {trend.length > 0 ? (
          <>
            <PlayerTrendLine points={trend} />
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {trend.map((point, index) => {
                const previous = trend[index - 1];
                const delta = previous ? point.players - previous.players : null;
                return (
                  <span
                    key={`${point.year}-${point.month}`}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className="font-medium text-foreground">
                      {point.label.slice(0, 3)}
                    </span>
                    {point.players}
                    {delta !== null ? (
                      <span
                        className={cn(
                          "font-medium",
                          delta >= 0 ? "text-tone-success-ink" : "text-destructive",
                        )}
                      >
                        {delta >= 0 ? `+${delta}` : delta}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyChart>Add a program with clinics to see enrollment trends.</EmptyChart>
        )}
      </article>

      <article
        data-testid="registration-clinic-enrollment"
        className="rounded-xl border bg-background p-4 shadow-sm sm:p-5"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Clinic enrollment
            </p>
            <h4 className="font-heading text-lg font-medium">{programLabel}</h4>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-chart-1" aria-hidden />
              Enrolled
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-muted" aria-hidden />
              Capacity
            </span>
          </div>
        </div>
        {enrollment.length > 0 ? (
          <ClinicEnrollmentBars bars={enrollment} />
        ) : (
          <EmptyChart>No clinics scheduled for this program yet.</EmptyChart>
        )}
      </article>
    </section>
  );
}
