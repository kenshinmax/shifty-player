"use client";

import Image from "next/image";
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
        className="relative left-1/2 -mt-10 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden bg-zinc-950 text-white"
      >
        <div className="relative min-h-[min(88vh,52rem)]">
          {/* Photo by Max Winkler on Unsplash (Unsplash License). */}
          <div className="absolute inset-x-0 top-0 h-[60%] md:inset-0 md:h-auto">
            <Image
              src="/home-hero-layup.jpg"
              alt="Basketball player rising for a layup between two defenders during a game"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[72%_center] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-1000"
            />
            <div
              className="absolute inset-0 bg-linear-to-t from-zinc-950 via-transparent via-40% to-transparent md:bg-linear-to-r md:from-zinc-950 md:via-zinc-950/80 md:via-40% md:to-zinc-950/10 md:to-75%"
              aria-hidden
            />
          </div>

          <div className="relative mx-auto flex min-h-[min(88vh,52rem)] max-w-6xl flex-col justify-end px-6 pt-64 pb-12 md:justify-center md:py-24">
            <div className="max-w-lg space-y-6">
              <h1 className="font-heading text-5xl leading-[0.95] font-bold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                Find your team. Get on the floor.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
                Sign up for clinics, camps and team programs run by basketball
                organizations on Shifty Player, all from one player account.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "bg-white text-zinc-950 hover:bg-white/90",
                  )}
                >
                  Create a player account
                </Link>
                <Link
                  href="#home-platform"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white",
                  )}
                >
                  How it works
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="home-platform"
        data-testid="home-platform"
        className="scroll-mt-24 rounded-3xl bg-canvas p-4 ring-1 ring-canvas-ring sm:p-6"
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
