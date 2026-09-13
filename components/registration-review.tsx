"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { useRegistration } from "@/components/registration-provider";
import {
  CLINIC_WEEKLY_FEE_USD,
  formatClinicLabel,
  formatProgramTimeframe,
  getClinicCapacity,
  getRemainingClinicSpots,
} from "@/lib/programs";
import { emitMetricsEvent } from "@/lib/metrics-client";
import { formatSessionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

const publishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";

/** Client uses publishable key presence; server still requires STRIPE_SECRET_KEY. */
const stripeEnabled = Boolean(publishableKey);

let stripePromise: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise ?? Promise.resolve(null);
}

type StripeCheckoutFormProps = {
  playerId: string;
  programId: string;
  clinicId: string;
  playerName: string;
  clinicLabel: string;
  onEnrolled: (message: string) => void;
};

function StripeCheckoutForm({
  playerId,
  programId,
  clinicId,
  playerName,
  clinicLabel,
  onEnrolled,
}: StripeCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { completePaidRegistration } = useRegistration();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      emitMetricsEvent("payment_failed");
      setError(confirmError.message ?? "Payment failed.");
      setSubmitting(false);
      return;
    }

    const paymentIntentId = paymentIntent?.id;
    if (!paymentIntentId || paymentIntent.status !== "succeeded") {
      emitMetricsEvent("payment_failed");
      setError("Payment did not complete. Please try again.");
      setSubmitting(false);
      return;
    }

    try {
      const verifyResponse = await fetch("/api/stripe/confirm-enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentIntentId,
          playerId,
          programId,
          clinicId,
        }),
      });
      const verifyBody = (await verifyResponse.json()) as {
        approved?: boolean;
        error?: string;
      };

      if (!verifyResponse.ok || !verifyBody.approved) {
        emitMetricsEvent("payment_failed");
        setError(verifyBody.error ?? "Could not verify payment.");
        setSubmitting(false);
        return;
      }

      const result = completePaidRegistration(playerId, programId, clinicId);
      if (result.error) {
        emitMetricsEvent("payment_failed");
        setError(result.error);
        setSubmitting(false);
        return;
      }

      emitMetricsEvent("payment_succeeded");
      onEnrolled(
        `Payment received. ${playerName} is registered for ${clinicLabel}.`,
      );
    } catch {
      emitMetricsEvent("payment_failed");
      setError("Could not verify payment. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      data-testid="registration-payment-form"
      data-payment-mode="stripe"
    >
      <PaymentElement />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={!stripe || submitting}>
          {submitting ? "Processing…" : `Pay ${formatUsd(CLINIC_WEEKLY_FEE_USD)}`}
        </Button>
        <Link
          href="/player"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

type StripePaymentSectionProps = {
  playerId: string;
  programId: string;
  clinicId: string;
  parentUserId: string;
  playerName: string;
  clinicLabel: string;
  onEnrolled: (message: string) => void;
};

function StripePaymentSection({
  playerId,
  programId,
  clinicId,
  parentUserId,
  playerName,
  clinicLabel,
  onEnrolled,
}: StripePaymentSectionProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createIntent() {
      try {
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId,
            programId,
            clinicId,
            parentUserId,
          }),
        });
        const body = (await response.json()) as {
          clientSecret?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok || !body.clientSecret) {
          setLoadError(body.error ?? "Could not start payment.");
          return;
        }
        setClientSecret(body.clientSecret);
      } catch {
        if (!cancelled) {
          setLoadError("Could not start payment. Please try again.");
        }
      }
    }

    void createIntent();
    return () => {
      cancelled = true;
    };
  }, [playerId, programId, clinicId, parentUserId]);

  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {loadError}
      </p>
    );
  }

  if (!clientSecret) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Preparing secure payment…
      </p>
    );
  }

  return (
    <Elements
      stripe={getStripePromise()}
      options={{
        clientSecret,
        appearance: { theme: "stripe" },
      }}
    >
      <StripeCheckoutForm
        playerId={playerId}
        programId={programId}
        clinicId={clinicId}
        playerName={playerName}
        clinicLabel={clinicLabel}
        onEnrolled={onEnrolled}
      />
    </Elements>
  );
}

type DemoPaymentFormProps = {
  playerId: string;
  programId: string;
  clinicId: string;
  playerName: string;
  clinicLabel: string;
  onEnrolled: (message: string) => void;
};

function DemoPaymentForm({
  playerId,
  programId,
  clinicId,
  playerName,
  clinicLabel,
  onEnrolled,
}: DemoPaymentFormProps) {
  const { completePaidRegistration } = useRegistration();
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handlePaymentSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPaymentError(null);

    const result = completePaidRegistration(playerId, programId, clinicId);
    if (result.error) {
      emitMetricsEvent("payment_failed");
      setPaymentError(result.error);
      return;
    }

    emitMetricsEvent("payment_succeeded");
    onEnrolled(
      `Payment received. ${playerName} is registered for ${clinicLabel}.`,
    );
  };

  return (
    <form
      onSubmit={handlePaymentSubmit}
      className="space-y-5"
      data-testid="registration-payment-form"
      data-payment-mode="demo"
    >
      <div className="space-y-2">
        <Label htmlFor="cardholder-name" className="font-semibold">
          Cardholder name
        </Label>
        <Input
          id="cardholder-name"
          className="h-12 bg-white text-base"
          autoComplete="cc-name"
          value={cardholderName}
          onChange={(event) => setCardholderName(event.target.value)}
          placeholder="Name on card"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="card-number" className="font-semibold">
          Card number
        </Label>
        <Input
          id="card-number"
          className="h-12 bg-white text-base"
          inputMode="numeric"
          autoComplete="cc-number"
          value={cardNumber}
          onChange={(event) => setCardNumber(event.target.value)}
          placeholder="ACCT-000015"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="card-expiry" className="font-semibold">
            Expiry
          </Label>
          <Input
            id="card-expiry"
            className="h-12 bg-white text-base"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
            placeholder="MM / YY"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="card-cvc" className="font-semibold">
            CVC
          </Label>
          <Input
            id="card-cvc"
            className="h-12 bg-white text-base"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvc}
            onChange={(event) => setCvc(event.target.value)}
            placeholder="123"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billing-zip" className="font-semibold">
            Billing ZIP
          </Label>
          <Input
            id="billing-zip"
            className="h-12 bg-white text-base"
            autoComplete="postal-code"
            value={billingZip}
            onChange={(event) => setBillingZip(event.target.value)}
            placeholder="06883"
            required
          />
        </div>
      </div>

      {paymentError ? (
        <p className="text-sm text-destructive" role="alert">
          {paymentError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg">
          Pay {formatUsd(CLINIC_WEEKLY_FEE_USD)}
        </Button>
        <Link
          href="/player"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

export function RegistrationReview() {
  const router = useRouter();
  const params = useParams<{ playerId: string; clinicId: string }>();
  const playerId = params.playerId;
  const clinicId = params.clinicId;

  const { user, canViewPlayerDashboard } = useAuth();
  const { state } = useRegistration();

  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(false);

  const player = useMemo(
    () => state.players.find((entry) => entry.id === playerId),
    [state.players, playerId],
  );

  const clinic = useMemo(
    () => state.sessions.find((entry) => entry.id === clinicId),
    [state.sessions, clinicId],
  );

  const program = useMemo(
    () =>
      clinic
        ? state.programs.find((entry) => entry.id === clinic.programId)
        : undefined,
    [state.programs, clinic],
  );

  useEffect(() => {
    if (!user) {
      router.replace("/");
      return;
    }
    if (!canViewPlayerDashboard) {
      router.replace("/dashboard");
    }
  }, [user, canViewPlayerDashboard, router]);

  useEffect(() => {
    if (user && player && player.parentUserId !== user.id) {
      router.replace("/player");
    }
  }, [user, player, router]);

  if (!user || !canViewPlayerDashboard) {
    return null;
  }

  if (!player || !clinic || !program) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6" data-testid="registration-review">
        <p className="text-muted-foreground" role="alert">
          Registration details could not be found.
        </p>
        <Link
          href="/player"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  const enrolled =
    player.sessionIds.includes(clinic.id) &&
    player.programIds.includes(program.id);
  const paid = Boolean(player.paymentLinkSentAt) && enrolled;
  const clinicLabel = formatClinicLabel(clinic);

  const handleEnrolled = (message: string) => {
    setIsPaid(true);
    setPaymentMessage(message);
    router.push("/player");
  };

  return (
    <div
      className="mx-auto max-w-5xl space-y-8 p-6"
      data-testid="registration-review"
    >
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/player" className="underline-offset-4 hover:underline">
            My Dashboard
          </Link>
          {" / "}
          Registration
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {paid || isPaid ? "Registration complete" : "Complete payment"}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {paid || isPaid
            ? "This clinic enrollment is paid and confirmed."
            : "Review player and clinic details, then pay to finish enrollment. The player is not registered until payment succeeds."}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="registration-player-card">
          <CardHeader>
            <CardTitle>Player</CardTitle>
            <CardDescription>Registered athlete details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                {player.avatarUrl ? (
                  <AvatarImage src={player.avatarUrl} alt={player.name} />
                ) : null}
                <AvatarFallback>{initials(player.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading text-lg font-medium">{player.name}</p>
                <p className="text-sm text-muted-foreground">{player.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Grade</dt>
                <dd className="font-medium">{player.grade}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Level</dt>
                <dd className="font-medium capitalize">{player.level}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card data-testid="registration-clinic-card">
          <CardHeader>
            <CardTitle>Clinic</CardTitle>
            <CardDescription>Program and session details</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Program</dt>
                <dd className="font-heading text-base font-medium">
                  {program.name}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Clinic</dt>
                <dd className="font-medium">{clinicLabel}</dd>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-muted-foreground">Timeframe</dt>
                  <dd className="font-medium">
                    {formatProgramTimeframe(program)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium">
                    {formatSessionStatus(clinic.status)}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium">
                  {program.location ?? "TBD"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Spots</dt>
                <dd className="font-medium">
                  {getRemainingClinicSpots(state.players, clinic)} of{" "}
                  {getClinicCapacity(clinic)} available
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Amount due</dt>
                <dd className="font-heading text-lg font-semibold">
                  {formatUsd(CLINIC_WEEKLY_FEE_USD)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card
        data-testid="registration-payment-card"
        className="border-zinc-200 bg-zinc-50 ring-zinc-200/80"
      >
        <CardHeader className="border-b border-zinc-200/80 bg-zinc-100/60">
          <CardTitle className="font-heading text-xl">Payment</CardTitle>
          <CardDescription className="text-base">
            {stripeEnabled
              ? `Pay ${formatUsd(CLINIC_WEEKLY_FEE_USD)} securely with Stripe for ${clinicLabel}.`
              : `Enter card details to pay ${formatUsd(CLINIC_WEEKLY_FEE_USD)} for ${clinicLabel}. Demo mode (Stripe keys not configured).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {paid || isPaid ? (
            <div className="space-y-4">
              <p
                className="rounded-lg border border-zinc-200 bg-zinc-100/70 px-4 py-3 text-sm text-zinc-700"
                role="status"
              >
                {paymentMessage ??
                  `${player.name} is enrolled in ${clinicLabel}.`}
              </p>
              <Link
                href="/player"
                className={cn(buttonVariants({ variant: "default", size: "lg" }))}
              >
                Back to dashboard
              </Link>
            </div>
          ) : stripeEnabled ? (
            <StripePaymentSection
              playerId={player.id}
              programId={program.id}
              clinicId={clinic.id}
              parentUserId={user.id}
              playerName={player.name}
              clinicLabel={clinicLabel}
              onEnrolled={handleEnrolled}
            />
          ) : (
            <DemoPaymentForm
              playerId={player.id}
              programId={program.id}
              clinicId={clinic.id}
              playerName={player.name}
              clinicLabel={clinicLabel}
              onEnrolled={handleEnrolled}
            />
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          {stripeEnabled
            ? "Card data is handled by Stripe. Enrollment is confirmed only after the server verifies payment."
            : "Card data is not stored. Configure Stripe keys in .env.local for live test payments."}
        </CardFooter>
      </Card>
    </div>
  );
}
