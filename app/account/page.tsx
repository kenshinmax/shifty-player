"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveProgramsSection } from "@/components/active-programs-section";
import { ParentChildrenOverview } from "@/components/parent-children-overview";
import { useAuth } from "@/components/auth-provider";
import Link from "next/link";
import type { OrgSummary } from "@/components/org-provider";
import { StatTile } from "@/components/stat-tile";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatProgramDate,
  getCompletedProgramsForUser,
} from "@/lib/player-history";
import { getPostLoginPath } from "@/lib/auth";
import type { AppState, Child } from "@/lib/types";

type AccountResponse = {
  children: Child[];
  organizations: { organization: OrgSummary; state: AppState }[];
};

export default function AccountPage() {
  const router = useRouter();
  const { user, canViewPlayerDashboard } = useAuth();
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedChildId, setHistoryChildId] = useState<string>("");

  const children = useMemo(() => account?.children ?? [], [account]);

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (!canViewPlayerDashboard) {
      router.replace(user.role === "admin" ? getPostLoginPath(user) : "/");
    }
  }, [user, canViewPlayerDashboard, router]);

  useEffect(() => {
    if (!user || !canViewPlayerDashboard) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        if (response.status === 401) {
          if (!cancelled) router.replace("/");
          return;
        }
        if (!response.ok) throw new Error("Failed to load your account.");
        const body = (await response.json()) as AccountResponse;
        if (!cancelled) setAccount(body);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Failed to load your account.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, canViewPlayerDashboard, router]);

  if (!user || !canViewPlayerDashboard) {
    return <p className="text-muted-foreground">Redirecting…</p>;
  }

  if (loadError) {
    return <p className="text-destructive">{loadError}</p>;
  }

  if (!account) {
    return <p className="text-muted-foreground">Loading your account…</p>;
  }

  const historyChild =
    children.find((child) => child.id === selectedChildId) ?? children[0];
  const historyChildId = historyChild?.id ?? "";
  const completedPrograms = historyChildId
    ? getCompletedProgramsForUser(historyChildId)
    : [];
  const totalGames = completedPrograms.reduce(
    (sum, program) => sum + program.gamesPlayed,
    0,
  );

  return (
    <div className="space-y-8" data-testid="player-dashboard">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Overview
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user.name}. Register your children for programs and
          review their program history.
        </p>
      </header>

      <div className="space-y-8 rounded-3xl bg-canvas p-4 ring-1 ring-canvas-ring sm:p-6">
        {account.organizations.length === 0 ? (
          <section className="space-y-2" data-testid="account-empty">
            <p className="text-muted-foreground">
              You haven&apos;t registered with an organization yet.
            </p>
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Find an organization
            </Link>
          </section>
        ) : null}

        {account.organizations.map(({ organization, state }) => (
          <section
            key={organization.id}
            className="space-y-6"
            data-testid={`account-org-${organization.slug}`}
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                {organization.name}
              </h2>
              <Link
                href={`/o/${organization.slug}/register`}
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Register for programs
              </Link>
            </div>

            <ParentChildrenOverview
              childrenPlayers={state.players}
              programs={state.programs}
              sessions={state.sessions}
            />

            <ActiveProgramsSection
              childrenPlayers={state.players}
              programs={state.programs}
              sessions={state.sessions}
            />
          </section>
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile
            label="Completed programs"
            value={completedPrograms.length}
            tone="accent"
          />
          <StatTile label="Games played" value={totalGames} tone="success" />
        </div>

        <section className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="border-l-4 border-brand pl-4">
              <h2 className="font-heading text-xl font-medium">
                Completed programs
              </h2>
              <p className="text-sm text-muted-foreground">
                Date, grade level, and games played for each finished program.
              </p>
            </div>
            {children.length > 0 ? (
              <div className="space-y-2 sm:w-56">
                <Label htmlFor="history-child">View history for</Label>
                <Select
                  value={historyChildId || undefined}
                  onValueChange={(value) => setHistoryChildId(value ?? "")}
                >
                  <SelectTrigger id="history-child">
                    <SelectValue placeholder="Select a child" />
                  </SelectTrigger>
                  <SelectContent>
                    {children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
            <Table>
              <TableHeader className="bg-surface-muted">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-right">Games played</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedPrograms.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      {historyChild
                        ? `${historyChild.name} has no completed programs yet. Register for a program to get started.`
                        : "Add a player and register for a program to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  completedPrograms.map((program) => (
                    <TableRow key={program.id}>
                      <TableCell className="font-medium">
                        {formatProgramDate(program.date)}
                      </TableCell>
                      <TableCell>{program.programLabel}</TableCell>
                      <TableCell>{program.grade}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {program.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {program.gamesPlayed}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
