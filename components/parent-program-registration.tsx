"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { useRegistration } from "@/components/registration-provider";
import {
  formatClinicLabel,
  formatProgramTimeframe,
  getAvailableClinicsForProgram,
  getOpenPrograms,
  getRemainingClinicSpots,
} from "@/lib/programs";
import { getChildrenForParent } from "@/lib/player-store";
import { emitMetricsEvent } from "@/lib/metrics-client";
import { LEVELS, type Level } from "@/lib/types";

type ParentProgramRegistrationProps = {
  onRegistered?: () => void;
};

export function ParentProgramRegistration({
  onRegistered,
}: ParentProgramRegistrationProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { state, addChild, validateRegistration } = useRegistration();

  const children = useMemo(
    () => (user ? getChildrenForParent(state.players, user.id) : []),
    [state.players, user],
  );

  const openPrograms = useMemo(
    () => getOpenPrograms(state.programs),
    [state.programs],
  );

  const [childId, setChildId] = useState<string | undefined>(undefined);
  const [programId, setProgramId] = useState<string | undefined>(undefined);
  const [clinicId, setClinicId] = useState<string | undefined>(undefined);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildGrade, setNewChildGrade] = useState("");
  const [newChildLevel, setNewChildLevel] = useState<Level>("beginner");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProgram = openPrograms.find(
    (program) => program.id === programId,
  );
  const availableClinics = programId
    ? getAvailableClinicsForProgram(state.sessions, programId, state.players)
    : [];

  const handleRegister = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!childId) {
      setError("Select a child to register.");
      return;
    }
    if (!programId) {
      setError("Select an open program.");
      return;
    }
    if (!clinicId) {
      setError("Select an available clinic.");
      return;
    }

    const result = validateRegistration(childId, programId, clinicId);
    if (result.error) {
      setError(result.error);
      return;
    }

    onRegistered?.();
    emitMetricsEvent("registration_started");
    router.push(`/player/registration/${childId}/${clinicId}`);
  };

  const handleAddChild = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user) return;

    const result = addChild(user.id, user.email, {
      name: newChildName,
      grade: newChildGrade,
      level: newChildLevel,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.childId) {
      setChildId(result.childId);
    }
    setNewChildName("");
    setNewChildGrade("");
    setNewChildLevel("beginner");
    setShowAddChild(false);
    setSuccess(
      "Child added. Select an open program and available clinic to register.",
    );
  };

  if (!user) return null;

  const selectTriggerClass =
    "h-12 w-full min-w-0 rounded-lg border-zinc-300 bg-white px-3 text-base shadow-sm";
  const selectItemClass = "py-2.5 pl-3 pr-8 text-base";
  const selectContentClass = "min-w-[var(--anchor-width)] text-base";
  const fieldPanelClass =
    "space-y-2 rounded-xl border border-zinc-200 bg-zinc-100/80 p-4";

  return (
    <Card
      data-testid="parent-program-registration"
      className="border-zinc-200 bg-zinc-50 ring-zinc-200/80"
    >
      <CardHeader className="border-b border-zinc-200/80 bg-zinc-100/60">
        <CardTitle className="font-heading text-xl">
          Register for a program
        </CardTitle>
        <CardDescription className="text-base">
          Choose a child, an open program, then an available clinic within that
          program. Administrators control which programs and clinics are open.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={fieldPanelClass}>
              <Label htmlFor="register-child" className="text-sm font-semibold">
                Child
              </Label>
              <Select
                value={childId}
                onValueChange={(value) => {
                  setChildId(value ?? undefined);
                  setError(null);
                  setSuccess(null);
                }}
              >
                <SelectTrigger
                  id="register-child"
                  className={selectTriggerClass}
                >
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {children.map((child) => (
                    <SelectItem
                      key={child.id}
                      value={child.id}
                      className={selectItemClass}
                    >
                      {child.name} (Grade {child.grade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={fieldPanelClass}>
              <Label
                htmlFor="register-program"
                className="text-sm font-semibold"
              >
                Open program
              </Label>
              <Select
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value ?? undefined);
                  setClinicId(undefined);
                  setError(null);
                  setSuccess(null);
                }}
              >
                <SelectTrigger
                  id="register-program"
                  className={selectTriggerClass}
                >
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {openPrograms.map((program) => (
                    <SelectItem
                      key={program.id}
                      value={program.id}
                      className={selectItemClass}
                    >
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className={fieldPanelClass}>
              <Label
                htmlFor="register-clinic"
                className="text-sm font-semibold"
              >
                Available clinic
              </Label>
              <Select
                value={clinicId}
                onValueChange={(value) => {
                  setClinicId(value ?? undefined);
                  setError(null);
                  setSuccess(null);
                }}
                disabled={!programId || availableClinics.length === 0}
              >
                <SelectTrigger
                  id="register-clinic"
                  className={selectTriggerClass}
                >
                  <SelectValue
                    placeholder={
                      !programId
                        ? "Select a program first"
                        : availableClinics.length === 0
                          ? "No clinics available"
                          : "Select a clinic"
                    }
                  />
                </SelectTrigger>
                <SelectContent className={selectContentClass}>
                  {availableClinics.map((clinic) => (
                    <SelectItem
                      key={clinic.id}
                      value={clinic.id}
                      className={selectItemClass}
                    >
                      {formatClinicLabel(clinic)} ·{" "}
                      {getRemainingClinicSpots(state.players, clinic)} spots
                      left
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedProgram ? (
            <p
              className="rounded-lg border border-zinc-200 bg-zinc-100/70 px-4 py-3 text-sm text-zinc-700"
              data-testid="program-clinic-summary"
            >
              {selectedProgram.name} ({formatProgramTimeframe(selectedProgram)}
              {selectedProgram.location
                ? ` · ${selectedProgram.location}`
                : ""}
              ) — {availableClinics.length} available clinic
              {availableClinics.length === 1 ? "" : "s"}.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg">
              Continue to payment
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => setShowAddChild((open) => !open)}
            >
              {showAddChild ? "Cancel new child" : "Add a child"}
            </Button>
          </div>
        </form>

        {showAddChild ? (
          <form
            onSubmit={handleAddChild}
            className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-100/80 p-5"
            data-testid="add-child-form"
          >
            <p className="text-base font-semibold">Add a new child</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="new-child-name" className="font-semibold">
                  Name
                </Label>
                <Input
                  id="new-child-name"
                  className="h-12 bg-white text-base"
                  value={newChildName}
                  onChange={(event) => setNewChildName(event.target.value)}
                  placeholder="Child's name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-child-grade" className="font-semibold">
                  Grade
                </Label>
                <Input
                  id="new-child-grade"
                  className="h-12 bg-white text-base"
                  value={newChildGrade}
                  onChange={(event) => setNewChildGrade(event.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-child-level" className="font-semibold">
                  Level
                </Label>
                <Select
                  value={newChildLevel}
                  onValueChange={(value) =>
                    setNewChildLevel((value ?? "beginner") as Level)
                  }
                >
                  <SelectTrigger
                    id="new-child-level"
                    className={selectTriggerClass}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {LEVELS.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className={selectItemClass}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit">Save child</Button>
          </form>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            className="text-sm text-green-700 dark:text-green-400"
            role="status"
          >
            {success}
          </p>
        ) : null}

        {children.length === 0 && !showAddChild ? (
          <p className="text-sm text-muted-foreground">
            You have no players on file yet. Add a Player to get started.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
