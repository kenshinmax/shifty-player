"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { PlayersRosterGrid } from "@/components/players-roster-grid";
import { useAuth } from "@/components/auth-provider";
import { useRegistration } from "@/components/registration-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMonth } from "@/lib/format";
import {
  formatClinicLabel,
  formatProgramTimeframe,
  getClinicCapacity,
  getClinicsForProgram,
  getPlayersForProgram,
  getProgramSpots,
} from "@/lib/programs";
import type { Player } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ProgramDetailPage() {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;
  const router = useRouter();
  const { user, canViewDashboard, canEdit } = useAuth();
  const {
    state,
    createPlayer,
    editPlayer,
    removePlayer,
    removeFromProgram,
    sendPaymentLink,
    setProgramRegistrationOpen,
    setClinicRegistrationAvailable,
    countPlayersForSession,
  } = useRegistration();

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | undefined>();

  const program = useMemo(
    () => state.programs.find((entry) => entry.id === programId),
    [state.programs, programId],
  );

  const clinics = useMemo(
    () => (program ? getClinicsForProgram(state.sessions, program.id) : []),
    [state.sessions, program],
  );

  const roster = useMemo(
    () =>
      program
        ? getPlayersForProgram(state.players, state.sessions, program.id)
        : [],
    [state.players, state.sessions, program],
  );

  useEffect(() => {
    if (!canViewDashboard) {
      router.replace(user?.role === "user" ? "/player" : "/");
    }
  }, [canViewDashboard, router, user?.role]);

  if (!canViewDashboard) {
    return <p className="text-muted-foreground">Redirecting…</p>;
  }

  if (!program) {
    return (
      <div className="space-y-4 p-6" data-testid="program-detail-missing">
        <p className="text-muted-foreground">Program not found.</p>
        <Link href="/dashboard" className={cn(buttonVariants())}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  const openAddPlayer = () => {
    setEditingPlayer(undefined);
    setPlayerDialogOpen(true);
  };

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setPlayerDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6" data-testid="program-detail">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            Admin Dashboard
          </Link>
          {" / "}
          Programs
          {" / "}
          {program.name}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                {program.name}
              </h1>
              <Badge variant={program.open ? "default" : "secondary"}>
                {program.open ? "Open" : "Closed"}
              </Badge>
            </div>
            <p className="max-w-2xl text-muted-foreground">
              {program.description ?? "No description yet."}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatProgramTimeframe(program)}
              {program.location ? ` · ${program.location}` : ""} ·{" "}
              {getProgramSpots(program)} spots · {roster.length} on roster
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={program.open ? "outline" : "default"}
              onClick={() =>
                setProgramRegistrationOpen(program.id, !program.open)
              }
            >
              {program.open ? "Close program" : "Open program"}
            </Button>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Back
            </Link>
          </div>
        </div>
      </header>

      <section className="space-y-3" data-testid="program-clinics">
        <h2 className="font-heading text-xl font-medium">Clinics</h2>
        <p className="text-sm text-muted-foreground">
          Toggle clinic availability and review remaining spots.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clinic</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="text-right">Spots</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No clinics in this program yet.
                </TableCell>
              </TableRow>
            ) : (
              clinics.map((clinic) => (
                <TableRow key={clinic.id}>
                  <TableCell className="font-medium">
                    {formatClinicLabel(clinic)}
                  </TableCell>
                  <TableCell>
                    {formatMonth(clinic.month)} {clinic.year}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={clinic.available ? "default" : "secondary"}
                    >
                      {clinic.available ? "Available" : "Unavailable"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {countPlayersForSession(clinic.id)} /{" "}
                    {getClinicCapacity(clinic)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setClinicRegistrationAvailable(
                          clinic.id,
                          !clinic.available,
                        )
                      }
                    >
                      {clinic.available
                        ? "Mark unavailable"
                        : "Mark available"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-4" data-testid="program-roster">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-medium">Roster</h2>
            <p className="text-sm text-muted-foreground">
              View and manage players registered for this program.
            </p>
          </div>
          {canEdit ? (
            <Button type="button" onClick={openAddPlayer}>
              <UserPlus data-icon="inline-start" />
              Add player
            </Button>
          ) : null}
        </div>

        <PlayersRosterGrid
          players={roster}
          canEdit={canEdit}
          canSendPayment
          onEdit={openEditPlayer}
          onDelete={(playerId) => removeFromProgram(playerId, program.id)}
          onSendPaymentLink={sendPaymentLink}
          deleteTitle="Remove from roster?"
          deleteActionLabel="Remove from roster"
          deleteDescription={(player) =>
            `Remove ${player.name} from ${program.name}? They will keep other program enrollments.`
          }
        />
      </section>

      <PlayerFormDialog
        open={playerDialogOpen}
        onOpenChange={setPlayerDialogOpen}
        player={editingPlayer}
        sessions={clinics.length > 0 ? clinics : state.sessions}
        defaultSessionIds={clinics[0] ? [clinics[0].id] : []}
        onSubmit={(input) => {
          if (editingPlayer) {
            return editPlayer(editingPlayer.id, {
              ...input,
              sessionIds:
                input.sessionIds.length > 0
                  ? input.sessionIds
                  : clinics[0]
                    ? [clinics[0].id]
                    : input.sessionIds,
            });
          }
          return createPlayer({
            ...input,
            sessionIds:
              input.sessionIds.length > 0
                ? input.sessionIds
                : clinics[0]
                  ? [clinics[0].id]
                  : input.sessionIds,
          });
        }}
      />
    </div>
  );
}
