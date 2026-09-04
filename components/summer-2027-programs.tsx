import Link from "next/link";
import { ArrowRight, Sparkles, Tent } from "lucide-react";
import { cn } from "@/lib/utils";

const SUMMER_2027_PROGRAMS = [
  {
    id: "summer-camp",
    step: "01",
    title: "Summer Camp",
    summary: "Train all summer",
    description:
      "Daily skills, live play, and coaching that builds habits for the next season. Built for players who want reps, structure, and a competitive edge.",
    starts: "July – Aug",
    grades: "5–10th",
    timeframe: "Summer",
    location: "Weston, CT",
    price: "$460 per week",
    href: "/login?next=/player",
    icon: Tent,
    accent: "from-cyan-400/25 via-transparent to-transparent",
  },
  {
    id: "showcases",
    step: "02",
    title: "Showcases",
    summary: "Get seen",
    description:
      "High-visibility sessions where players compete under pressure. Perfect for athletes ready to show hustle, IQ, and presence.",
    starts: "July – Aug",
    grades: "5–10th",
    timeframe: "Summer",
    location: "Weston, CT",
    price: "$460 per week",
    href: "/login?next=/player",
    icon: Sparkles,
    accent: "from-amber-400/25 via-transparent to-transparent",
  },
] as const;

export function Summer2027Programs() {
  return (
    <section
      data-testid="summer-2027-programs"
      className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-700"
    >
      <div className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          Featured program
        </p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Summer 2027 Camps & Showcases
        </h2>
        <p className="text-muted-foreground sm:text-lg">
          One summer program with two paths — camp training and showcase
          visibility. Pick the track that fits your player.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        {SUMMER_2027_PROGRAMS.map((program, index) => {
          const Icon = program.icon;
          return (
            <article
              key={program.id}
              data-testid={`summer-2027-card-${program.id}`}
              className="group relative flex min-h-[20rem] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-7 text-white ring-1 ring-white/5 transition-transform duration-500 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${120 + index * 100}ms` }}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 bg-linear-to-br",
                  program.accent,
                )}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -top-12 -right-8 font-heading text-[7rem] font-semibold leading-none text-white/5 transition-colors duration-500 group-hover:text-white/10"
                aria-hidden
              >
                {program.step}
              </div>

              <div className="relative space-y-5">
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-[0.18em] text-white/55 uppercase">
                    {program.summary}
                  </p>
                  <h3 className="font-heading text-2xl font-semibold tracking-tight uppercase sm:text-3xl">
                    {program.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/65">
                    {program.description}
                  </p>
                </div>

                

                <dl className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
                  <div className="space-y-1">
                    <dt className="text-[0.65rem] font-semibold tracking-[0.16em] text-white/45 uppercase">
                      Starts
                    </dt>
                    <dd className="text-sm font-medium text-white">
                      {program.starts}
                    </dd>
                  </div>                 
                  <div className="space-y-1">
                    <dt className="text-[0.65rem] font-semibold tracking-[0.16em] text-white/45 uppercase">
                      Timeframe
                    </dt>
                    <dd className="text-sm font-medium text-white">
                      {program.timeframe}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[0.65rem] font-semibold tracking-[0.16em] text-white/45 uppercase">
                      Grades
                    </dt>
                    <dd className="text-sm font-medium text-white">
                      {program.grades}
                    </dd>
                  </div>
                </dl>
                <div className="grid grid-cols-1 gap-3 border-t border-white/10 pt-4 sm:grid-cols-3 sm:items-end">
                  <div className="space-y-1">
                    <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-white/45 uppercase">
                      Location
                    </p>
                    <p className="text-sm font-medium text-white">
                      {program.location}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[0.65rem] font-semibold tracking-[0.16em] text-white/45 uppercase">
                      Price
                    </p>
                    <p className="text-sm font-medium text-white">
                      {program.price}
                    </p>
                  </div>
                  <div className="sm:justify-self-end">
                    <Link
                      href={program.href}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-white underline-offset-4 transition-colors hover:text-white/80 hover:underline"
                    >
                      Register Now
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
