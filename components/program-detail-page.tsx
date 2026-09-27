"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, UserPlus } from "lucide-react";
import { PlayerFormDialog } from "@/components/player-form-dialog";
import { PlayersRosterGrid } from "@/components/players-roster-grid";
import { useAuth } from "@/components/auth-provider";
import { useRegistration } from "@/components/registration-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMonth } from "@/lib/format";
import type { ProgramInput, SessionInput } from "@/lib/player-store";
import {
  CLINIC_WEEKLY_FEE_USD,
  formatClinicLabel,
  formatProgramTimeframe,
  getClinicCapacity,
  getClinicPriceUsd,
  getClinicsForProgram,
  getPlayersForProgram,
  getProgramSpots,
} from "@/lib/programs";
import type { Player, Session } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function ProgramDetailPage() {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;
  const router = useRouter();
  const { user, canViewDashboard, canEdit } = useAuth();
  const {
    state,
    createPlayer,
    editPlayer,
    removeFromProgram,
    sendPaymentLink,
    setProgramRegistrationOpen,
    setClinicRegistrationAvailable,
    updateProgramDetails,
    createSession,
    editSession,
    countPlayersForSession,
  } = useRegistration();

  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | undefined>();
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [clinicDialogOpen, setClinicDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<Session | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

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

  const openAddClinic = () => {
    setEditingClinic(undefined);
    setFormError(null);
    setClinicDialogOpen(true);
  };

  const openEditClinic = (clinic: Session) => {
    setEditingClinic(clinic);
    setFormError(null);
    setClinicDialogOpen(true);
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
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormError(null);
                  setProgramDialogOpen(true);
                }}
              >
                <Pencil data-icon="inline-start" />
                Edit details
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant={program.open ? "outline" : "default"}
                onClick={() =>
                  setProgramRegistrationOpen(program.id, !program.open)
                }
              >
                {program.open ? "Close program" : "Open program"}
              </Button>
            ) : null}
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-xl font-medium">Clinics</h2>
            <p className="text-sm text-muted-foreground">
              Manage clinic schedule, capacity, price, and availability.
            </p>
          </div>
          {canEdit ? (
            <Button type="button" variant="outline" onClick={openAddClinic}>
              <Plus data-icon="inline-start" />
              Add clinic
            </Button>
          ) : null}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clinic</TableHead>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead>Availability</TableHead>
              <TableHead className="text-right">Spots</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
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
                  <TableCell className="text-right">
                    {formatUsd(getClinicPriceUsd(clinic))}
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
                    <div className="flex flex-wrap justify-end gap-2">
                      {canEdit ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditClinic(clinic)}
                        >
                          Edit
                        </Button>
                      ) : null}
                      {canEdit ? (
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
                      ) : null}
                    </div>
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
        onSubmit={async (input) => {
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

      <ProgramEditDialog
        open={programDialogOpen}
        onOpenChange={setProgramDialogOpen}
        error={formError}
        defaultValues={{
          name: program.name,
          description: program.description ?? "",
          startDate: program.startDate ?? "",
          endDate: program.endDate ?? "",
          open: program.open,
          spots: getProgramSpots(program),
          location: program.location ?? "",
        }}
        onSubmit={async (input) => {
          const result = await updateProgramDetails(program.id, input);
          if (result.error) {
            setFormError(result.error);
            return;
          }
          setProgramDialogOpen(false);
        }}
      />

      <ClinicEditDialog
        open={clinicDialogOpen}
        onOpenChange={setClinicDialogOpen}
        error={formError}
        clinic={editingClinic}
        programId={program.id}
        onSubmit={async (input) => {
          const result = editingClinic
            ? await editSession(editingClinic.id, input)
            : await createSession(input);
          if (result.error) {
            setFormError(result.error);
            return;
          }
          setClinicDialogOpen(false);
        }}
      />
    </div>
  );
}

type ProgramEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  defaultValues: ProgramInput;
  onSubmit: (input: ProgramInput) => Promise<void>;
};

function ProgramEditDialog({
  open,
  onOpenChange,
  error,
  defaultValues,
  onSubmit,
}: ProgramEditDialogProps) {
  const [name, setName] = useState(defaultValues.name);
  const [description, setDescription] = useState(defaultValues.description);
  const [startDate, setStartDate] = useState(defaultValues.startDate);
  const [endDate, setEndDate] = useState(defaultValues.endDate);
  const [location, setLocation] = useState(defaultValues.location ?? "");
  const [spots, setSpots] = useState(String(defaultValues.spots));
  const [isOpen, setIsOpen] = useState(defaultValues.open);

  useEffect(() => {
    if (!open) return;
    setName(defaultValues.name);
    setDescription(defaultValues.description);
    setStartDate(defaultValues.startDate);
    setEndDate(defaultValues.endDate);
    setLocation(defaultValues.location ?? "");
    setSpots(String(defaultValues.spots));
    setIsOpen(defaultValues.open);
  }, [open, defaultValues]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="program-edit-dialog">
        <DialogHeader>
          <DialogTitle>Edit program details</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit({
              name,
              description,
              startDate,
              endDate,
              open: isOpen,
              spots: Number(spots),
              location: location.trim() || undefined,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-program-name">Name</Label>
            <Input
              id="edit-program-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-program-description">Description</Label>
            <Input
              id="edit-program-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-program-start">Start date</Label>
              <Input
                id="edit-program-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-program-end">End date</Label>
              <Input
                id="edit-program-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-program-location">Location</Label>
              <Input
                id="edit-program-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Weston, CT"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-program-spots">Default spots</Label>
              <Input
                id="edit-program-spots"
                type="number"
                min={1}
                value={spots}
                onChange={(event) => setSpots(event.target.value)}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(event) => setIsOpen(event.target.checked)}
            />
            Open for registration
          </label>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save program</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type ClinicEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  clinic?: Session;
  programId: string;
  onSubmit: (input: SessionInput) => Promise<void>;
};

function ClinicEditDialog({
  open,
  onOpenChange,
  error,
  clinic,
  programId,
  onSubmit,
}: ClinicEditDialogProps) {
  const [label, setLabel] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("7");
  const [week, setWeek] = useState("");
  const [capacity, setCapacity] = useState("50");
  const [priceUsd, setPriceUsd] = useState(String(CLINIC_WEEKLY_FEE_USD));
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (clinic) {
      setLabel(clinic.label ?? "");
      setYear(String(clinic.year));
      setMonth(String(clinic.month));
      setWeek(clinic.week ? String(clinic.week) : "");
      setCapacity(String(getClinicCapacity(clinic)));
      setPriceUsd(String(getClinicPriceUsd(clinic)));
      setAvailable(clinic.available);
      return;
    }
    setLabel("");
    setYear(String(new Date().getFullYear()));
    setMonth("7");
    setWeek("");
    setCapacity("50");
    setPriceUsd(String(CLINIC_WEEKLY_FEE_USD));
    setAvailable(true);
  }, [open, clinic]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="clinic-edit-dialog">
        <DialogHeader>
          <DialogTitle>
            {clinic ? "Edit clinic" : "Add clinic"}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit({
              programId,
              year: Number(year),
              month: Number(month),
              week: week.trim() ? Number(week) : undefined,
              label: label.trim() || undefined,
              capacity: Number(capacity),
              priceUsd: Number(priceUsd),
              available,
              status: clinic?.status ?? "trending",
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-clinic-label">Label</Label>
            <Input
              id="edit-clinic-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Week 1"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edit-clinic-year">Year</Label>
              <Input
                id="edit-clinic-year"
                type="number"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clinic-month">Month (1–12)</Label>
              <Input
                id="edit-clinic-month"
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clinic-week">Week #</Label>
              <Input
                id="edit-clinic-week"
                type="number"
                min={1}
                value={week}
                onChange={(event) => setWeek(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-clinic-capacity">Capacity</Label>
              <Input
                id="edit-clinic-capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-clinic-price">Price (USD)</Label>
              <Input
                id="edit-clinic-price"
                type="number"
                min={1}
                step="1"
                value={priceUsd}
                onChange={(event) => setPriceUsd(event.target.value)}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
            />
            Available for registration
          </label>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {clinic ? "Save clinic" : "Add clinic"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
