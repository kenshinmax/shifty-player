"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  formatSeasonDate,
  getCompletedSeasonsForUser,
} from "@/lib/player-history";

export default function PlayerDashboardPage() {
  const router = useRouter();
  const { user, canViewPlayerDashboard } = useAuth();

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (!canViewPlayerDashboard) {
      router.replace(user.role === "admin" ? "/dashboard" : "/");
    }
  }, [user, canViewPlayerDashboard, router]);

  if (!user || !canViewPlayerDashboard) {
    return <p className="text-muted-foreground">Redirecting…</p>;
  }

  const seasons = getCompletedSeasonsForUser(user.id);
  const totalGames = seasons.reduce(
    (sum, season) => sum + season.gamesPlayed,
    0,
  );

  return (
    <div className="space-y-8" data-testid="player-dashboard">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Player Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user.name}. Here are your completed programs.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Completed programs</p>
          <p className="mt-1 font-heading text-3xl font-semibold">
            {seasons.length}
          </p>
        </div>
        <div className="rounded-xl border p-6">
          <p className="text-sm text-muted-foreground">Games played</p>
          <p className="mt-1 font-heading text-3xl font-semibold">
            {totalGames}
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-medium">
            Completed programs
          </h2>
          <p className="text-sm text-muted-foreground">
            Date, grade level, and games played for each finished program.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="text-right">Games played</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasons.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No completed programs yet. Register for a clinic to get
                  started.
                </TableCell>
              </TableRow>
            ) : (
              seasons.map((season) => (
                <TableRow key={season.id}>
                  <TableCell className="font-medium">
                    {formatSeasonDate(season.date)}
                  </TableCell>
                  <TableCell>{season.seasonLabel}</TableCell>
                  <TableCell>{season.grade}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {season.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {season.gamesPlayed}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
