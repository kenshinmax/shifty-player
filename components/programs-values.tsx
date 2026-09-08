import { Brain, Flame, Swords } from "lucide-react";

const CORE_VALUES = [
  {
    title: "Work hard",
    description:
      "Every drill, every extra rep, every early arrival — effort is the floor we never drop below.",
    icon: Flame,
    accent: "from-amber-400/25 via-transparent to-transparent",
  },
  {
    title: "Play smart",
    description:
      "See the floor, make the extra pass, and let IQ turn hustle into the right play at the right time.",
    icon: Brain,
    accent: "from-sky-400/20 via-transparent to-transparent",
  },
  {
    title: "Compete",
    description:
      "Raise the standard when the game gets tight. Play through contact. Finish with a next-play mentality.",
    icon: Swords,
    accent: "from-cyan-400/20 via-transparent to-transparent",
  },
] as const;

export function ProgramsValues() {
  return (
    <section data-testid="programs-values" className="space-y-10">
      <hr className="border-0 border-t border-zinc-300" />

      <div className="max-w-3xl space-y-4">
        <p className="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          Core values
        </p>
        <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Work hard. Play smart. Compete.
        </h2>
        <p className="text-lg text-muted-foreground">
          The program is built on one standard — show up ready, think the game,
          and never take a possession off.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        {CORE_VALUES.map((value, index) => {
          const Icon = value.icon;
          return (
            <article
              key={value.title}
              className="group relative flex min-h-[18rem] flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-7 text-white ring-1 ring-white/5 transition-transform duration-500 hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-3"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-linear-to-br ${value.accent}`}
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -top-12 -right-8 font-heading text-[7rem] font-semibold leading-none text-white/5 transition-colors duration-500 group-hover:text-white/10"
                aria-hidden
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="relative space-y-4">
                <span className="inline-flex size-10 items-center justify-center rounded-full border border-white/15 bg-white/5">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="space-y-2">
                  <h3 className="font-heading text-2xl font-semibold tracking-tight uppercase sm:text-3xl">
                    {value.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/65">
                    {value.description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
