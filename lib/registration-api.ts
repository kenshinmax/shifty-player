import type { AppState } from "@/lib/types";
import type {
  ChildInput,
  PlayerInput,
  ProgramInput,
  SessionInput,
} from "@/lib/player-store";

type ApiResult = {
  state?: AppState;
  error?: string;
  childId?: string;
  programId?: string;
};

async function parseJson(response: Response): Promise<ApiResult> {
  return (await response.json()) as ApiResult;
}

export async function fetchRegistrationState(): Promise<AppState> {
  const response = await fetch("/api/state", { cache: "no-store" });
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

export async function apiCreatePlayer(input: PlayerInput) {
  return postJson("/api/players", input);
}

export async function apiUpdatePlayer(playerId: string, input: PlayerInput) {
  return postJson(`/api/players/${playerId}`, input, "PATCH");
}

export async function apiDeletePlayer(playerId: string) {
  return postJson(`/api/players/${playerId}`, undefined, "DELETE");
}

export async function apiAddChild(
  parentUserId: string,
  parentEmail: string,
  input: ChildInput,
) {
  return postJson("/api/players/children", {
    parentUserId,
    parentEmail,
    ...input,
  });
}

export async function apiSendPaymentLink(playerId: string) {
  return postJson(`/api/players/${playerId}/payment-link`);
}

export async function apiCreateClinic(input: SessionInput) {
  return postJson("/api/clinics", input);
}

export async function apiUpdateClinic(clinicId: string, input: SessionInput) {
  return postJson(`/api/clinics/${clinicId}`, input, "PATCH");
}

export async function apiDeleteClinic(clinicId: string) {
  return postJson(`/api/clinics/${clinicId}`, undefined, "DELETE");
}

export async function apiSetClinicAvailable(
  clinicId: string,
  available: boolean,
) {
  return postJson(`/api/clinics/${clinicId}`, { available }, "PATCH");
}

export async function apiCreateProgram(input: ProgramInput) {
  return postJson("/api/programs", input);
}

export async function apiSetProgramOpen(programId: string, open: boolean) {
  return postJson(`/api/programs/${programId}`, { open }, "PATCH");
}

export async function apiUpdateProgram(
  programId: string,
  input: ProgramInput,
) {
  return postJson(`/api/programs/${programId}`, input, "PATCH");
}

export async function apiRemoveFromProgram(
  playerId: string,
  programId: string,
) {
  return postJson(`/api/programs/${programId}/players/${playerId}/remove`);
}

export async function apiEnrollPaid(
  playerId: string,
  programId: string,
  clinicId: string,
  cart: import("@/lib/merchandise").CartLine[] = [],
) {
  return postJson("/api/registrations/enroll", {
    playerId,
    programId,
    clinicId,
    cart,
  });
}
