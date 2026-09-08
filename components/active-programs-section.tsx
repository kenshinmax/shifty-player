"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getActiveProgramsForPlayers,
  type ActiveProgramStatus,
} from "@/lib/programs";
import type { Player, Program } from "@/lib/types";

type ActiveProgramsSectionProps = {
  childrenPlayers: Player[];
  programs: Program[];
};

function statusBadgeVariant(
  status: ActiveProgramStatus,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "enrolled":
      return "default";
    case "pending":
      return "secondary";
    case "inactive":
      return "outline";
  }
}

export function ActiveProgramsSection({
  childrenPlayers,
  programs,
}: ActiveProgramsSectionProps) {
  const activePrograms = getActiveProgramsForPlayers(
    childrenPlayers,
    programs,
  );

  return (
    <section className="space-y-4" data-testid="active-programs">
      <div>
        <h2 className="font-heading text-xl font-medium">Active programs</h2>
        <p className="text-sm text-muted-foreground">
          Current program registrations for all of your children.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Player</TableHead>
            <TableHead>Program</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activePrograms.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground"
              >
                No active programs yet. Register a child for an open program to
                get started.
              </TableCell>
            </TableRow>
          ) : (
            activePrograms.map((program) => (
              <TableRow key={program.id}>
                <TableCell className="font-medium">{program.date}</TableCell>
                <TableCell>{program.playerName}</TableCell>
                <TableCell>{program.programName}</TableCell>
                <TableCell>{program.location}</TableCell>
                <TableCell>
                  <Badge
                    variant={statusBadgeVariant(program.status)}
                    className="capitalize"
                  >
                    {program.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
