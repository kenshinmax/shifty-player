import type { AppState, Child } from "@/lib/types";
import type {
  ChildInput,
  PlayerInput,
  ProgramInput,
  SessionInput,
} from "@/lib/player-store";

type ApiResult = {
  state?: AppState;
  error?: string;
  child?: Child;
  programId?: string;
};

async function parseJson(response: Response): Promise<ApiResult> {
  return (await response.json()) as ApiResult;
}

function orgUrl(orgId: string, path: string): string {
  return `/api/orgs/${orgId}${path}`;
}

export async function fetchRegistrationState(
  orgId: string,
): Promise<AppState> {
  const response = await fetch(orgUrl(orgId, "/state"), { cache: "no-store" });
  const body = await parseJson(response);
  if (!response.ok || !body.state) {
    throw new Error(body.error ?? "Failed to load registration state.");
  }
  return body.state;
}

export async function seedRegistrationViaApi(): Promise<AppState> {
  const response = await fetch("/api/admin/seed", { method: "POST" });
  const body = await parseJson(response);
  if (!response.ok || !body.state) {
    throw new Error(body.error ?? "Failed to seed registration state.");
  }
  return body.state;
}

async function postJson(
  url: string,
  body?: unknown,
  method: string = "POST",
): Promise<ApiResult> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const parsed = await parseJson(response);
  if (!response.ok) {
    return { ...parsed, error: parsed.error ?? "Request failed." };
  }
  return parsed;
}

export async function apiCreatePlayer(orgId: string, input: PlayerInput) {
  return postJson(orgUrl(orgId, "/players"), input);
}

export async function apiUpdatePlayer(
  orgId: string,
  playerId: string,
  input: PlayerInput,
) {
  return postJson(orgUrl(orgId, `/players/${playerId}`), input, "PATCH");
}

export async function apiDeletePlayer(orgId: string, playerId: string) {
  return postJson(orgUrl(orgId, `/players/${playerId}`), undefined, "DELETE");
}

export async function apiAddChild(input: ChildInput) {
  return postJson("/api/account/children", input);
}

export async function apiSendPaymentLink(orgId: string, playerId: string) {
  return postJson(orgUrl(orgId, `/players/${playerId}/payment-link`));
}

export async function apiCreateClinic(orgId: string, input: SessionInput) {
  return postJson(orgUrl(orgId, "/clinics"), input);
}

export async function apiUpdateClinic(
  orgId: string,
  clinicId: string,
  input: SessionInput,
) {
  return postJson(orgUrl(orgId, `/clinics/${clinicId}`), input, "PATCH");
}

export async function apiDeleteClinic(orgId: string, clinicId: string) {
  return postJson(orgUrl(orgId, `/clinics/${clinicId}`), undefined, "DELETE");
}

export async function apiSetClinicAvailable(
  orgId: string,
  clinicId: string,
  available: boolean,
) {
  return postJson(orgUrl(orgId, `/clinics/${clinicId}`), { available }, "PATCH");
}

export async function apiCreateProgram(orgId: string, input: ProgramInput) {
  return postJson(orgUrl(orgId, "/programs"), input);
}

export async function apiSetProgramOpen(
  orgId: string,
  programId: string,
  open: boolean,
) {
  return postJson(orgUrl(orgId, `/programs/${programId}`), { open }, "PATCH");
}

export async function apiUpdateProgram(
  orgId: string,
  programId: string,
  input: ProgramInput,
) {
  return postJson(orgUrl(orgId, `/programs/${programId}`), input, "PATCH");
}

export async function apiRemoveFromProgram(
  orgId: string,
  playerId: string,
  programId: string,
) {
  return postJson(
    orgUrl(orgId, `/programs/${programId}/players/${playerId}/remove`),
  );
}

export async function apiEnrollPaid(
  orgId: string,
  playerId: string,
  programId: string,
  clinicId: string,
  cart: import("@/lib/merchandise").CartLine[] = [],
) {
  return postJson(orgUrl(orgId, "/registrations/enroll"), {
    playerId,
    programId,
    clinicId,
    cart,
  });
}
