import { cn } from "@/lib/utils";

// Semantic tones from docs/brand-guidelines.md: info = players/people,
// success = paid/sent/completed, warning = pending/needs action,
// accent = sessions/teams/programs.
export type StatTone = "info" | "success" | "warning" | "accent";

const TONE_CLASSES: Record<StatTone, { bar: string; label: string }> = {
  info: { bar: "bg-tone-info", label: "text-tone-info-ink" },
  success: { bar: "bg-tone-success", label: "text-tone-success-ink" },
  warning: { bar: "bg-tone-warning", label: "text-tone-warning-ink" },
  accent: { bar: "bg-tone-accent", label: "text-tone-accent-ink" },
};

export function StatTile({
  label,
  value,
  detail,
  tone,
  size = "lg",
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone: StatTone;
  size?: "md" | "lg";
}) {
  const toneClasses = TONE_CLASSES[tone];
  return (
    <article className="relative overflow-hidden rounded-xl border bg-background p-5 pt-6 shadow-sm">
      <span
        className={cn("absolute inset-x-0 top-0 h-1", toneClasses.bar)}
        aria-hidden
      />
      <p
        className={cn(
          "text-xs font-semibold tracking-wide uppercase",
          toneClasses.label,
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-heading font-semibold tracking-tight",
          size === "lg" ? "text-3xl" : "text-2xl",
        )}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </article>
  );
}
