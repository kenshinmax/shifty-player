"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MessagesSquare,
  Trophy,
  Users,
} from "lucide-react";
import type { OrgSummary } from "@/components/org-provider";

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

export function PlatformHome({
  organizations,
}: {
  organizations: OrgSummary[];
}) {
  return (
    <div className="space-y-12" data-testid="platform-home">
      <header className="space-y-3 text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Shifty Player Platform
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
          Run registrations, rosters and payments for your basketball
          organization.
        </p>
      </header>

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

      <section className="space-y-4" data-testid="platform-organizations">
        <div className="border-l-4 border-brand pl-4">
          <h2 className="font-heading text-xl font-medium">Organizations</h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {organizations.map((org) => (
            <li key={org.id}>
              <Link
                href={`/o/${org.slug}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-l-4 border-l-brand bg-background p-5 shadow-sm transition-colors hover:bg-brand-soft"
              >
                <span className="font-heading text-lg font-medium">
                  {org.name}
                </span>
                <ArrowRight
                  className="size-4 text-brand-ink transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
