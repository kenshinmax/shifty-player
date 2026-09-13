"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
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
import { useRegistration } from "@/components/registration-provider";
import { formatMonth } from "@/lib/format";
import {
  formatClinicLabel,
  formatProgramTimeframe,
  getClinicCapacity,
  getClinicsForProgram,
  getPlayersForProgram,
  getProgramSpots,
} from "@/lib/programs";
import { cn } from "@/lib/utils";

export function AdminScheduleAvailability() {
  const {
    state,
    setProgramRegistrationOpen,
    setClinicRegistrationAvailable,
    countPlayersForSession,
  } = useRegistration();

  return (
    <div className="space-y-8" data-testid="admin-schedule-availability">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-heading text-xl font-medium">
            Program & clinic availability
          </h3>
          <p className="text-sm text-muted-foreground">
            Open a program for registration, manage clinics, and open each
            program&apos;s roster. Parents only see open programs and available
            clinics.
          </p>
        </div>
        <Link
          href="/dashboard/programs/new"
          className={cn(buttonVariants())}
          data-testid="add-program-link"
        >
          <Plus data-icon="inline-start" />
          Add program
        </Link>
      </div>

      {state.programs.map((program) => {
        const clinics = getClinicsForProgram(state.sessions, program.id);
        const rosterCount = getPlayersForProgram(
          state.players,
          state.sessions,
          program.id,
        ).length;

        return (
          <section
            key={program.id}
            className="space-y-3 rounded-xl border p-4"
            data-testid={`admin-program-${program.id}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-heading text-lg font-medium">
                    {program.name}
                  </h4>
                  <Badge variant={program.open ? "default" : "secondary"}>
                    {program.open ? "Open" : "Closed"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatProgramTimeframe(program)}
                  {program.location ? ` · ${program.location}` : ""} ·{" "}
                  {clinics.length} clinic{clinics.length === 1 ? "" : "s"} ·{" "}
                  {rosterCount}/{getProgramSpots(program)} roster spots
                </p>
                {program.description ? (
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    {program.description}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/programs/${program.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  data-testid={`manage-program-${program.id}`}
                >
                  Manage roster
                </Link>
                <Button
                  type="button"
                  size="sm"
                  variant={program.open ? "outline" : "default"}
                  onClick={() =>
                    setProgramRegistrationOpen(program.id, !program.open)
                  }
                >
                  {program.open ? "Close program" : "Open program"}
                </Button>
              </div>
            </div>

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
        );
      })}
    </div>
  );
}
