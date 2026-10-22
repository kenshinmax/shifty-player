"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
import { useOptionalOrg } from "@/components/org-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  apiAddOwner,
  apiCreateOrganization,
  apiPublishOrganization,
  type OwnerFields,
} from "@/lib/platform-api";
import { slugify } from "@/lib/slug";
import type { Organization, OrganizationWithOwners } from "@/lib/types";

const EMPTY_OWNER: OwnerFields = { name: "", email: "", password: "" };

function hasOwnerFields(owner: OwnerFields): boolean {
  return Boolean(owner.name.trim() || owner.email.trim() || owner.password);
}

/** Name, email and starting password for an org owner account. */
function OwnerInputs({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: OwnerFields;
  onChange: (next: OwnerFields) => void;
}) {
  const field = (key: keyof OwnerFields) => ({
    id: `${idPrefix}-${key}`,
    value: value[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: event.target.value }),
  });
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Owner name</Label>
        <Input {...field("name")} placeholder="Sam Coach" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-email`}>Owner email</Label>
        <Input {...field("email")} type="email" placeholder="sam@bayhoops.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-password`}>Starting password</Label>
        <Input {...field("password")} type="password" autoComplete="new-password" />
      </div>
    </div>
  );
}

function AddOwnerDialog({
  org,
  onClose,
  onAdded,
}: {
  org: Organization | null;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [owner, setOwner] = useState<OwnerFields>(EMPTY_OWNER);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOwner(EMPTY_OWNER);
    setError(null);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!org) return;
    setError(null);
    setSaving(true);
    const result = await apiAddOwner(org.id, owner);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await onAdded();
    close();
  };

  return (
    <Dialog open={org !== null} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="sm:max-w-2xl" data-testid="add-owner-dialog">
        <DialogHeader>
          <DialogTitle>Add owner</DialogTitle>
          <DialogDescription>
            The owner can manage only {org?.name}. Enter the email of an
            existing account to make it the owner (it keeps its name and
            password), or fill in every field to create a new account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <OwnerInputs idPrefix="add-owner" value={owner} onChange={setOwner} />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Adding…" : "Add owner"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: Organization["status"] }) {
  const live = status === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium capitalize",
        live ? "text-tone-success-ink" : "text-tone-warning-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 rounded-full",
          live ? "bg-tone-success" : "bg-tone-warning",
        )}
      />
      {status}
    </span>
  );
}

type AdminOrganizationsProps = {
  organizations: OrganizationWithOwners[];
  loadError: string | null;
  onChanged: () => Promise<void>;
  /** "Open admin" on the org already open: show its dashboard overview. */
  onOpenCurrentOrg: () => void;
};

/** Create organizations, give them owners and publish drafts (platform admin only). */
export function AdminOrganizations({
  organizations,
  loadError,
  onChanged,
  onOpenCurrentOrg,
}: AdminOrganizationsProps) {
  const router = useRouter();
  const currentOrg = useOptionalOrg();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [owner, setOwner] = useState<OwnerFields>(EMPTY_OWNER);
  const [ownerFor, setOwnerFor] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreating(true);
    const result = await apiCreateOrganization({
      name,
      slug,
      ...(hasOwnerFields(owner) ? { owner } : {}),
    });
    setCreating(false);
    if (result.error || !result.organization) {
      setError(result.error ?? "Could not create the organization.");
      return;
    }
    // Land on the new org's (empty) dashboard so programs can be added.
    router.push(`/o/${result.organization.slug}/admin`);
  };

  const handlePublish = async (org: Organization) => {
    setError(null);
    setPublishingId(org.id);
    const result = await apiPublishOrganization(org.id);
    setPublishingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    await onChanged();
  };

  return (
    <section className="space-y-6" data-testid="dashboard-organizations">
      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-xl border bg-background p-4 shadow-sm sm:p-5"
        data-testid="create-organization-form"
      >
        <div className="space-y-1">
          <h3 className="font-heading text-lg font-medium">
            Create organization
          </h3>
          <p className="text-sm text-muted-foreground">
            New organizations start as drafts: only you and the org&apos;s owner
            can see them until you publish.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              value={name}
              placeholder="Bay Hoops"
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">URL</Label>
            <div className="flex items-center rounded-md border bg-surface-muted pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
              <span>/o/</span>
              <Input
                id="org-slug"
                value={slug}
                placeholder="bay-hoops"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugEdited(true);
                }}
              />
            </div>
          </div>
        </div>
        <div className="space-y-3 rounded-lg bg-surface-muted p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Owner</p>
            <p className="text-xs text-muted-foreground">
              The owner signs in to manage only this organization. Use an
              existing account&apos;s email, or fill in every field for a new
              account. Leave blank to add one later.
            </p>
          </div>
          <OwnerInputs idPrefix="org-owner" value={owner} onChange={setOwner} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={creating}>
          <Plus data-icon="inline-start" />
          {creating ? "Creating…" : "Create organization"}
        </Button>
      </form>

      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <Table>
          <TableHeader className="bg-surface-muted">
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((org) => (
              <TableRow key={org.id} data-testid={`organization-row-${org.slug}`}>
                <TableCell className="font-medium">{org.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  /o/{org.slug}
                </TableCell>
                <TableCell data-testid={`organization-owners-${org.slug}`}>
                  {org.owners.length > 0 ? (
                    <ul className="space-y-0.5 text-sm">
                      {org.owners.map((entry) => (
                        <li key={entry.email}>
                          {entry.name}{" "}
                          <span className="text-muted-foreground">{entry.email}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setOwnerFor(org)}
                    >
                      <UserPlus data-icon="inline-start" />
                      Add owner
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={org.status} />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  {org.status === "draft" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={publishingId === org.id}
                      onClick={() => void handlePublish(org)}
                    >
                      {publishingId === org.id ? "Publishing…" : "Publish"}
                    </Button>
                  ) : null}
                  <Link
                    href={`/o/${org.slug}/admin`}
                    onClick={(event) => {
                      // Same URL, so the router wouldn't change anything.
                      if (org.id !== currentOrg?.id) return;
                      event.preventDefault();
                      onOpenCurrentOrg();
                    }}
                    className="text-sm font-medium text-brand-ink underline-offset-4 hover:underline"
                  >
                    Open admin
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddOwnerDialog
        org={ownerFor}
        onClose={() => setOwnerFor(null)}
        onAdded={onChanged}
      />
    </section>
  );
}
