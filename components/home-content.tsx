"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  LogIn,
  Swords,
  UserPlus,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/login-dialog";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { useRegistration } from "@/components/registration-provider";
import { Badge } from "@/components/ui/badge";
import { Layers, Sparkles, Target } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatMonth } from "@/lib/format";
import { sortSessionsByRecent } from "@/lib/session-showcase";
import { SummerScheduleCalendars } from "./summer-schedule-calendars";
import { cn } from "@/lib/utils";

const JOURNEY_STAGES = [
  {
    stage: "01",
    label: "Learning",
    title: "Foundations",
    description:
      "First touches, fundamentals, and a love for the game in a focused, supportive setting.",
    detail: "Grades K–5 · Skills & confidence",
    icon: Zap,
    href: "/clinics",
  },
  {
    stage: "02",
    label: "Competing",
    title: "Travel & teams",
    description:
      "Structured practices, scrimmages, and tournament basketball with real team identity.",
    detail: "Grades 3–12 · Programs & showcases",
    icon: Swords,
    href: "/programs",
  },
  {
    stage: "03",
    label: "Pursuing",
    title: "Visibility",
    description:
      "High-level clinics and showcase moments where hustle and IQ get noticed.",
    detail: "Middle & high school · Exposure",
    icon: Eye,
    href: "/showcases",
  },
] as const;
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
export function HomeContent() {
  const { canAddPlayer } = useAuth();
  const { state, createPlayer } = useRegistration();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const latestSeason = useMemo(
    () => sortSessionsByRecent(state.sessions)[0],
    [state.sessions],
  );

  const seasonTitle = latestSeason
    ? (latestSeason.label ?? formatMonth(latestSeason.month))
    : "the next season";

  const openRegisterFlow = () => {
    if (canAddPlayer) {
      setRegisterOpen(true);
      return;
    }
    setLoginOpen(true);
  };

  return (
    <div className="-mx-6 -mt-10 space-y-0 pb-8">
      {/* Section 1 — Dramatic hero (CT Elite–style) */}
      <section
        data-testid="home-jumbotron"
        className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden"
      >
        <div className="relative min-h-[min(85vh,48rem)] w-full">
          <Image
            src="/home-hero-team.png"
            alt="Basketball team celebrating together on the court"
            fill
            priority
            className="object-cover object-center animate-in fade-in duration-700"
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-linear-to-r from-black/85 via-black/60 to-black/30"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-linear-to-t from-black/75 via-transparent to-black/25"
            aria-hidden
          />

          <div className="relative mx-auto flex min-h-[min(85vh,48rem)] w-full max-w-6xl flex-col justify-end gap-6 px-6 py-14 sm:justify-center sm:py-20">
            <p className="font-heading text-sm font-semibold tracking-[0.22em] text-white/80 uppercase animate-in fade-in slide-in-from-bottom-2 duration-500">
              Shifty Player
            </p>
            <div className="max-w-3xl space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-700">
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
                This season,
                <br />
                multiple ways
                <br />
                to play
              </h1>
              <p className="max-w-xl text-base text-white/85 sm:text-lg">
                Clinics, programs, skills work, and showcases — find the right
                fit for your player&apos;s journey and register while spots are
                open.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Button
                size="lg"
                className="bg-white text-black hover:bg-white/90"
                onClick={openRegisterFlow}
              >
                {canAddPlayer ? (
                  <>
                    <UserPlus data-icon="inline-start" />
                    Register for {seasonTitle}
                  </>
                ) : (
                  <>
                    <LogIn data-icon="inline-start" />
                    Sign in to register
                  </>
                )}
              </Button>
              <Link
                href="/clinics"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white",
                )}
              >
                Learn about clinics
              </Link>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-sm font-medium tracking-wide text-white/70 uppercase animate-in fade-in duration-1000">
              <span>Train harder</span>
              <span aria-hidden className="text-white/40">
                ◆
              </span>
              <span>Play smarter</span>
              <span aria-hidden className="text-white/40">
                ◆
              </span>
              <span>Be elite</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Program journey stages (CT Elite–style) */}
      
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
              Start with clinics, then grow through each stage.
            </p>
            <Link
              href="/clinics"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-white text-black hover:bg-white/90",
              )}
            >
              Explore clinics
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </div>
      </section>
      <SummerScheduleCalendars />
    </div>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => setRegisterOpen(true)}
      />

      {latestSeason ? (
        <PlayerFormDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          sessions={state.sessions}
          defaultSessionIds={[latestSeason.id]}
          onSubmit={(input) => {
            const result = createPlayer(input);
            if (!result.error) {
              toast.success(`${input.name} registered for ${seasonTitle}`, {
                description:
                  "Admins can send a payment link from the Dashboard.",
              });
            }
            return result;
          }}
        />
      ) : null}
    </div>
  );
}
