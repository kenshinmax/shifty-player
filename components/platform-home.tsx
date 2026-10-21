"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  MessagesSquare,
  Shirt,
  Tent,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PLATFORM_FEATURES = [
  {
    title: "Team Rosters and Player Profiles",
    description:
      "Give coaches and parents a single place to view rosters, track player details, manage contact info, and keep medical or emergency information accessible during practices and games.",
    icon: Users,
  },
  {
    title: "Game and Practice Scheduling",
    description:
      "Build a scheduling system that handles recurring practices, tournament brackets, and game-day logistics. Parents get notifications, and coaches can adjust on the fly without mass texts or emails.",
    icon: CalendarDays,
  },
  {
    title: "Real Time Score and Stat Tracking",
    description:
      "Let volunteers or coaches log scores, stats, and highlights during games. Parents who can't attend stay in the loop, and players get to see their progress across an entire season.",
    icon: Trophy,
  },
  {
    title: "Team Communication Hub",
    description:
      "Replace scattered group chats with organized messaging. Announcements reach the right people, and coaches can communicate with parents or assistant coaches without anything getting lost.",
    icon: MessagesSquare,
  },
] as const;

const MANAGED_AREAS = [
  { label: "Teams", icon: Shirt },
  { label: "Camps", icon: Tent },
  { label: "Players", icon: UserRound },
  { label: "Organization", icon: Building2 },
] as const;

export function PlatformHome() {
  return (
    <div className="space-y-12" data-testid="platform-home">
      <section
        data-testid="platform-hero"
        className="relative left-1/2 -mt-10 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden bg-ink text-ink-foreground"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-brand/20 via-transparent to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl space-y-6 px-6 py-20 text-center sm:py-28">
          <p className="font-heading text-sm font-semibold tracking-[0.22em] text-ink-foreground/70 uppercase">
            For basketball organizations
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Shifty Player Platform
          </h1>
          <p className="mx-auto max-w-2xl text-base text-ink-foreground/70 sm:text-lg">
            Run registrations, rosters and payments for your basketball
            organization.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              href="/login"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-ink-foreground text-ink hover:bg-ink-foreground/90",
              )}
            >
              Get started
            </Link>
          </div>
        </div>
      </section>

      <section
        data-testid="home-platform"
        className="rounded-3xl bg-canvas p-4 ring-1 ring-canvas-ring sm:p-6"
      >
        <ul className="space-y-4">
          {PLATFORM_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <li key={feature.title}>
                <article className="flex gap-4 rounded-xl border border-l-4 border-l-brand bg-background p-5 shadow-sm sm:p-6">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-soft text-brand-ink">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="space-y-1.5">
                    <h2 className="font-heading text-lg font-medium">
                      {feature.title}
                    </h2>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        data-testid="platform-split-panel"
        className="grid overflow-hidden rounded-3xl border bg-background shadow-sm md:grid-cols-2"
      >
        <div className="flex flex-col justify-center space-y-4 p-8 sm:p-12">
          <div className="border-l-4 border-brand pl-4">
            <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Seamless team program management
            </h2>
          </div>
          <p className="max-w-md text-base text-muted-foreground sm:text-lg">
            Manage your teams, camps, players and organization with a single
            platform
          </p>
        </div>

        <div className="relative bg-ink p-8 text-ink-foreground sm:p-12">
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-brand/20 via-transparent to-transparent"
            aria-hidden
          />
          <ul className="relative grid grid-cols-2 gap-4">
            {MANAGED_AREAS.map((area) => {
              const Icon = area.icon;
              return (
                <li
                  key={area.label}
                  className="flex flex-col items-start gap-3 rounded-xl border border-ink-foreground/10 bg-ink-foreground/5 p-5"
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-full border border-ink-foreground/15 bg-ink-foreground/5">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="font-heading text-lg font-medium">
                    {area.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
