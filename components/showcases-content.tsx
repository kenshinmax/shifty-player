import Link from "next/link";
import { ArrowRight, Layers, Sparkles, Target } from "lucide-react";
import { SummerScheduleCalendars } from "@/components/summer-schedule-calendars";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const JOURNEY_STEPS = [
  {
    step: "01",
    title: "Fundamentals",
    summary: "Build the base",
    description:
      "First touches, footwork, and confidence. Players learn how to move, listen, and love the game.",
    detail: "Skills · Confidence · Habit",
    icon: Target,
    accent: "from-cyan-400/20 via-transparent to-transparent",
    sizeClass: "min-h-[17rem] lg:min-h-[19rem]",
    titleClass: "text-2xl sm:text-3xl",
  },
  {
    step: "02",
    title: "Essentials",
    summary: "Compete with structure",
    description:
      "Team habits, decision-making, and live reps. Players start reading the floor and competing with purpose.",
    detail: "IQ · Team play · Season ready",
    icon: Layers,
    accent: "from-sky-400/20 via-transparent to-transparent",
    sizeClass: "min-h-[20rem] lg:min-h-[23rem]",
    titleClass: "text-3xl sm:text-4xl",
  },
  {
    step: "03",
    title: "Enhanced",
    summary: "Show up ready to be seen",
    description:
      "High-level polish under pressure. Showcase moments where hustle, IQ, and presence get noticed.",
    detail: "Visibility · Pressure · Next level",
    icon: Sparkles,
    accent: "from-amber-400/25 via-transparent to-transparent",
    sizeClass: "min-h-[23rem] lg:min-h-[27rem]",
    titleClass: "text-3xl sm:text-4xl lg:text-5xl",
  },
] as const;

export function ShowcasesContent() {
  return (
    <div className="-mx-6 -mt-10 space-y-0 pb-8">
      <section
        data-testid="showcases-journey"
        className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden bg-zinc-950 text-white"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(1_0_0_/_0.06),transparent_55%)]"
          aria-hidden
        />

        <div className="relative mx-auto max-w-6xl space-y-12 px-6 py-16 lg:space-y-16 lg:py-24">
          <div className="mx-auto max-w-3xl space-y-4 text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
            <p className="font-heading text-sm font-semibold tracking-[0.22em] text-white/70 uppercase">
              Shifty Player Showcases
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              A program for each stage of a player&apos;s journey
            </h1>
            <p className="mx-auto max-w-2xl text-base text-white/70 sm:text-lg">
              Fundamentals, Essentials, and Enhanced — three clear steps that
              grow with your player.
            </p>
          </div>

          <ol className="grid items-end gap-4 sm:gap-5 lg:grid-cols-[0.85fr_1fr_1.2fr] lg:gap-5">
            {JOURNEY_STEPS.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <li
                  key={stage.step}
                  className={cn(
                    "animate-in fade-in slide-in-from-bottom-4 duration-700",
                    stage.sizeClass,
                  )}
                  style={{ animationDelay: `${160 + index * 120}ms` }}
                >
                  <article className="group relative flex h-full flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-6 ring-1 ring-white/5 transition-transform duration-500 hover:-translate-y-1 sm:p-7">
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 bg-linear-to-br",
                        stage.accent,
                      )}
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute -top-10 -right-6 font-heading text-[6.5rem] font-semibold leading-none text-white/5 transition-colors duration-500 group-hover:text-white/10 sm:text-[7.5rem]"
                      aria-hidden
                    >
                      {stage.step}
                    </div>

                    <div className="relative space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="text-xs font-semibold tracking-[0.2em] text-white/45 uppercase">
                          Step {stage.step}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <h2
                          className={cn(
                            "font-heading font-semibold tracking-tight uppercase",
                            stage.titleClass,
                          )}
                        >
                          {stage.title}
                        </h2>
                        <p className="text-base font-medium text-white">
                          {stage.summary}
                        </p>
                        <p className="text-sm leading-relaxed text-white/65">
                          {stage.description}
                        </p>
                        <p className="pt-1 text-xs tracking-wide text-white/45 uppercase">
                          {stage.detail}
                        </p>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-8 animate-in fade-in duration-1000 sm:justify-between">
            <p className="text-sm text-white/60">
              Start with evaluations, then grow through each stage.
            </p>
            <Link
              href="/evaluations"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-white text-black hover:bg-white/90",
              )}
            >
              Explore evaluations
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </div>
      </section>

      <SummerScheduleCalendars />
    </div>
  );
}
