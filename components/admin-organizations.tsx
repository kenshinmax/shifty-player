"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  apiCreateOrganization,
  apiPublishOrganization,
} from "@/lib/platform-api";
import { slugify } from "@/lib/slug";
import type { Organization } from "@/lib/types";
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
  organizations: Organization[];
  loadError: string | null;
  onChanged: () => Promise<void>;
};

/** Create organizations and publish drafts (admins only). */
export function AdminOrganizations({
  organizations,
  loadError,
  onChanged,
}: AdminOrganizationsProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setCreating(true);
    const result = await apiCreateOrganization({ name, slug });
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
            New organizations start as drafts: only admins can see them until
            you publish.
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
    </section>
  );
}
