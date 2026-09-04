"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ParentChildrenOverview } from "@/components/parent-children-overview";
import { ParentClinicRegistration } from "@/components/parent-clinic-registration";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegistration } from "@/components/registration-provider";
import {
  formatSeasonDate,
  getCompletedSeasonsForUser,
} from "@/lib/player-history";
import { getChildrenForParent } from "@/lib/player-store";

export default function PlayerDashboardPage() {
  const router = useRouter();
  const { user, canViewPlayerDashboard } = useAuth();
  const { state } = useRegistration();

  const children = useMemo(
    () => (user ? getChildrenForParent(state.players, user.id) : []),
    [state.players, user],
  );

  const [historyChildId, setHistoryChildId] = useState<string>("");

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (!canViewPlayerDashboard) {
      router.replace(user.role === "admin" ? "/dashboard" : "/");
    }
  }, [user, canViewPlayerDashboard, router]);

  useEffect(() => {
    if (children.length === 0) {
      setHistoryChildId("");
      return;
    }
    if (!children.some((child) => child.id === historyChildId)) {
      setHistoryChildId(children[0].id);
    }
  }, [children, historyChildId]);

  if (!user || !canViewPlayerDashboard) {
    return <p className="text-muted-foreground">Redirecting…</p>;
  }

  const seasons = historyChildId
    ? getCompletedSeasonsForUser(historyChildId)
    : [];
  const totalGames = seasons.reduce(
    (sum, season) => sum + season.gamesPlayed,
    0,
  );
  const historyChild = children.find((child) => child.id === historyChildId);

  return (
    <div className="space-y-8" data-testid="player-dashboard">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Parent Dashboard
        </h1>
        <p className="text-muted-foreground">
          Welcome back, {user.name}. Register your children for clinics and
          review their program history.
        </p>
      </header>

      <ParentClinicRegistration />

      <ParentChildrenOverview parentUserId={user.id} />

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
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
                  {historyChild
                    ? `${historyChild.name} has no completed programs yet. Register for a clinic to get started.`
                    : "Add a child and register for a clinic to get started."}
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
