"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { DEFAULT_CLINIC_CAPACITY } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NewProgramForm() {
  const router = useRouter();
  const { user, canViewDashboard } = useAuth();
  const { createProgram } = useRegistration();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [open, setOpen] = useState(true);
  const [spots, setSpots] = useState(String(DEFAULT_CLINIC_CAPACITY));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewDashboard) {
      router.replace(user?.role === "user" ? "/player" : "/");
    }
  }, [canViewDashboard, router, user?.role]);

  if (!canViewDashboard) {
    return <p className="text-muted-foreground">Redirecting…</p>;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const result = await createProgram({
      name,
      description,
      startDate,
      endDate,
      open,
      spots: Number(spots),
    });

    if (result.error || !result.programId) {
      setError(result.error ?? "Could not create program.");
      return;
    }

    router.push(`/dashboard/programs/${result.programId}`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6" data-testid="new-program-page">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            Admin Dashboard
          </Link>
          {" / "}
          New program
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Create program
        </h1>
        <p className="text-muted-foreground">
          Add a program with dates, availability, and player spots. A starting
          clinic is created automatically so you can manage the roster right
          away.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Program details</CardTitle>
          <CardDescription>
            Parents only see programs marked available (open).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            data-testid="new-program-form"
          >
            <div className="space-y-2">
              <Label htmlFor="program-name">Program name</Label>
              <Input
                id="program-name"
                className="h-11"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Spring Skills 2027"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program-description">Description</Label>
              <textarea
                id="program-description"
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What players and families should know about this program"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="program-start-date">Start date</Label>
                <Input
                  id="program-start-date"
                  type="date"
                  className="h-11"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-end-date">End date</Label>
                <Input
                  id="program-end-date"
                  type="date"
                  className="h-11"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="program-availability">Availability</Label>
                <Select
                  value={open ? "open" : "closed"}
                  onValueChange={(value) => setOpen(value === "open")}
                >
                  <SelectTrigger id="program-availability" className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open for registration</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="program-spots">Spots</Label>
                <Input
                  id="program-spots"
                  type="number"
                  min={1}
                  className="h-11"
                  value={spots}
                  onChange={(event) => setSpots(event.target.value)}
                  required
                />
              </div>
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" size="lg">
                Create program
              </Button>
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
              >
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
