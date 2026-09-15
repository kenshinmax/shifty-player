import { CLINIC_WEEKLY_FEE_USD } from "@/lib/programs";

/** Clinic tuition in cents — shared by Stripe + merchandise totals (no Stripe SDK). */
export const CLINIC_FEE_CENTS = CLINIC_WEEKLY_FEE_USD * 100;
