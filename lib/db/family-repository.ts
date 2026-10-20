import { getDocStore } from "@/lib/db/doc-store";
import { listLiveOrganizations } from "@/lib/db/platform-repository";
import { validateChildInput, type ChildInput } from "@/lib/player-store";
import type { Child, Enrollment, Organization } from "@/lib/types";

export async function childrenForParent(parentUserId: string): Promise<Child[]> {
  return getDocStore().find<Child>("children", { parentUserId });
}

export async function addChild(
  parentUserId: string,
  parentEmail: string,
  input: ChildInput,
): Promise<{ child: Child } | { error: string }> {
  const error = validateChildInput(input);
  if (error) return { error };
  const name = input.name.trim();
  const child: Child = {
    id: `player-${crypto.randomUUID()}`,
    parentUserId,
    name,
    email: parentEmail.trim().toLowerCase(),
    grade: input.grade.trim(),
    level: input.level,
    avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(name)}&size=80`,
  };
  await getDocStore().insertOne("children", child);
  return { child };
}

/** Live orgs where any of the parent's children has a non-removed enrollment. */
export async function organizationsForParent(parentUserId: string): Promise<Organization[]> {
  const children = await childrenForParent(parentUserId);
  if (children.length === 0) return [];
  const enrollments = await getDocStore().find<Enrollment>("enrollments", {
    childId: { $in: children.map((child) => child.id) },
  });
  const orgIds = new Set(
    enrollments.filter((e) => e.status !== "removed").map((e) => e.orgId),
  );
  return (await listLiveOrganizations()).filter((org) => orgIds.has(org.id));
}
