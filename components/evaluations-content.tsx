"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ClipboardCheck,
  Flag,
  LogIn,
  Target,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { LoginDialog } from "@/components/login-dialog";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { useRegistration } from "@/components/registration-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatMonth } from "@/lib/format";
import { sortSessionsByRecent } from "@/lib/session-showcase";
import { formatSessionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUCCESS_TIMELINE = [
  {
    title: "Show up ready",
    description:
      "Arrive for open clinics with hustle, listening ears, and a love for the game.",
    icon: Flag,
  },
  {
    title: "Build the fundamentals",
    description:
      "Coaches walk through ball handling, footwork, and defensive stance in live drills.",
    icon: Target,
  },
  {
    title: "Compete in scrimmages",
    description:
      "Players rotate through half-court and full-court games so every skill gets seen.",
    icon: Users,
  },
  {
    title: "Get evaluated",
    description:
      "Staff score effort, IQ, and athleticism—then share clear feedback with families.",
    icon: ClipboardCheck,
  },
  {
    title: "Earn your spot",
    description:
      "Top performers land roster invitations and start the path toward season success.",
    icon: Trophy,
  },
] as const;

export function EvaluationsContent() {
  const { canAddPlayer } = useAuth();
  const { state, createPlayer, countPlayersForSession } = useRegistration();
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const latestSeason = useMemo(
    () => sortSessionsByRecent(state.sessions)[0],
    [state.sessions],
  );

  if (!latestSeason) {
    return (
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Clinics
        </h1>
        <p className="text-muted-foreground">
          No programs are available for clinic registration yet.
        </p>
      </div>
    );
  }

  const playerCount = countPlayersForSession(latestSeason.id);
  const seasonTitle = latestSeason.label ?? formatMonth(latestSeason.month);

  const openRegisterFlow = () => {
    if (canAddPlayer) {
      setRegisterOpen(true);
      return;
    }
    setLoginOpen(true);
  };

  return (
    <div className="-mx-6 -mt-10 space-y-16 pb-8">
      <section
        data-testid="evaluation-jumbotron"
        className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden"
      >
        <div className="relative min-h-[min(78vh,42rem)] w-full">
          <Image
            src="/evaluation-hero-player.png"
            alt="Basketball player driving toward the basket during clinic"
            fill
            priority
            className="object-cover object-[center_20%] animate-in fade-in duration-700"
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-linear-to-r from-black/80 via-black/55 to-black/25"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-black/20"
            aria-hidden
          />

          <div className="relative mx-auto flex min-h-[min(78vh,42rem)] w-full max-w-6xl flex-col justify-end gap-6 px-6 py-12 sm:justify-center sm:py-16">
            <p className="font-heading text-sm font-semibold tracking-[0.22em] text-white/80 uppercase animate-in fade-in slide-in-from-bottom-2 duration-500">
              Shifty Player Clinics
            </p>
            <div className="max-w-2xl space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-700">
              <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
                Your next season starts on the floor
              </h1>
              <p className="max-w-xl text-base text-white/85 sm:text-lg">
                Join the {seasonTitle} clinic, show your game, and take the
                first step toward roster success.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">
                {formatMonth(latestSeason.month)} {latestSeason.year}
              </Badge>
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">
                {formatSessionStatus(latestSeason.status)}
              </Badge>
              <Badge className="border-white/20 bg-white/15 text-white hover:bg-white/20">
                {playerCount} registered
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3 pt-1 animate-in fade-in slide-in-from-bottom-5 duration-700">
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
                href="/programs"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white",
                )}
              >
                Browse programs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        data-testid="evaluation-timeline"
        className="mx-auto w-full max-w-3xl space-y-8 px-6"
      >
        <div className="space-y-2 text-center sm:text-left">
          <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            The path to success
          </h2>
          <p className="text-muted-foreground">
            From first whistle to final cut—here is how clinics turn potential
            into a season roster.
          </p>
        </div>

        <ol className="relative space-y-0 border-l border-border pl-8">
          {SUCCESS_TIMELINE.map((event, index) => {
            const Icon = event.icon;
            return (
              <li
                key={event.title}
                className="relative pb-10 last:pb-0 animate-in fade-in slide-in-from-left-2 fill-mode-both"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span className="absolute top-0 -left-8 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background shadow-sm">
                  <Icon className="size-3.5 text-foreground" aria-hidden />
                </span>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Step {index + 1}
                </p>
                <h3 className="font-heading mt-1 text-lg font-medium">
                  {event.title}
                </h3>
                <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                  {event.description}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border bg-muted/40 px-6 py-5 sm:justify-start">
          <p className="flex-1 text-sm text-muted-foreground">
            Ready for {seasonTitle}? Sign in and claim your clinic spot.
          </p>
          <Button onClick={openRegisterFlow}>
            {canAddPlayer ? "Register now" : "Sign in to register"}
          </Button>
        </div>
      </section>

      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => setRegisterOpen(true)}
      />

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
    </div>
  );
}
