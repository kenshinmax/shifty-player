"use client";

import { useMemo, useState } from "react";
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
import { getAvailableClinics } from "@/lib/clinics";
import { formatSessionLabel } from "@/lib/format";
import { getChildrenForParent } from "@/lib/player-store";
import { LEVELS, type Level } from "@/lib/types";

type ParentClinicRegistrationProps = {
  onRegistered?: () => void;
};

export function ParentClinicRegistration({
  onRegistered,
}: ParentClinicRegistrationProps) {
  const { user } = useAuth();
  const { state, addChild, registerForClinic } = useRegistration();

  const children = useMemo(
    () => (user ? getChildrenForParent(state.players, user.id) : []),
    [state.players, user],
  );

  const clinics = useMemo(
    () => getAvailableClinics(state.sessions),
    [state.sessions],
  );

  const [childId, setChildId] = useState<string | undefined>(undefined);
  const [clinicId, setClinicId] = useState<string | undefined>(undefined);
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildGrade, setNewChildGrade] = useState("");
  const [newChildLevel, setNewChildLevel] = useState<Level>("beginner");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedChild = children.find((child) => child.id === childId);
  const selectedClinic = clinics.find((clinic) => clinic.id === clinicId);

  const handleRegister = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!childId) {
      setError("Select a child to register.");
      return;
    }
    if (!clinicId) {
      setError("Select a clinic to attend.");
      return;
    }

    const result = registerForClinic(childId, clinicId);
    if (result.error) {
      setError(result.error);
      return;
    }

    const childName = selectedChild?.name ?? "Your child";
    const clinicName = selectedClinic
      ? formatSessionLabel(
          selectedClinic.year,
          selectedClinic.month,
          selectedClinic.label,
        )
      : "the clinic";
    setSuccess(`${childName} is registered for ${clinicName}.`);
    setClinicId(undefined);
    onRegistered?.();
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
    setSuccess("Child added. Select a clinic to complete registration.");
  };

  if (!user) return null;

  return (
    <Card data-testid="parent-clinic-registration">
      <CardHeader>
        <CardTitle className="font-heading text-xl">Register for a clinic</CardTitle>
        <CardDescription>
          Choose one of your children and the clinic they will attend.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="register-child">Child</Label>
              <Select
                value={childId}
                onValueChange={(value) => {
                  setChildId(value ?? undefined);
                  setError(null);
                  setSuccess(null);
                }}
              >
                <SelectTrigger id="register-child">
                  <SelectValue placeholder="Select a child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.name} (Grade {child.grade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-clinic">Clinic</Label>
              <Select
                value={clinicId}
                onValueChange={(value) => {
                  setClinicId(value ?? undefined);
                  setError(null);
                  setSuccess(null);
                }}
              >
                <SelectTrigger id="register-clinic">
                  <SelectValue placeholder="Select a clinic" />
                </SelectTrigger>
                <SelectContent>
                  {clinics.map((clinic) => (
                    <SelectItem key={clinic.id} value={clinic.id}>
                      {formatSessionLabel(
                        clinic.year,
                        clinic.month,
                        clinic.label,
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">Register</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddChild((open) => !open)}
            >
              {showAddChild ? "Cancel new child" : "Add a child"}
            </Button>
          </div>
        </form>

        {showAddChild ? (
          <form
            onSubmit={handleAddChild}
            className="space-y-4 rounded-lg border p-4"
            data-testid="add-child-form"
          >
            <p className="text-sm font-medium">Add a new child</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="new-child-name">Name</Label>
                <Input
                  id="new-child-name"
                  value={newChildName}
                  onChange={(event) => setNewChildName(event.target.value)}
                  placeholder="Child's name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-child-grade">Grade</Label>
                <Input
                  id="new-child-grade"
                  value={newChildGrade}
                  onChange={(event) => setNewChildGrade(event.target.value)}
                  placeholder="e.g. 5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-child-level">Level</Label>
                <Select
                  value={newChildLevel}
                  onValueChange={(value) =>
                    setNewChildLevel((value ?? "beginner") as Level)
                  }
                >
                  <SelectTrigger id="new-child-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" size="sm">
              Save child
            </Button>
          </form>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-green-700 dark:text-green-400" role="status">
            {success}
          </p>
        ) : null}

        {children.length === 0 && !showAddChild ? (
          <p className="text-sm text-muted-foreground">
            You have no children on file yet. Add a child to get started.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
