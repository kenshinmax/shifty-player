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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";
import { useRegistration } from "@/components/registration-provider";
import {
  formatClinicLabel,
  formatProgramTimeframe,
  getClinicCapacity,
  getClinicTuitionCents,
  getRemainingClinicSpots,
} from "@/lib/programs";
import {
  MERCHANDISE_CATALOG,
  MERCHANDISE_SIZES,
  computeRegistrationTotalCents,
  computeSwagCents,
  getMerchandiseItem,
  type CartLine,
  type MerchandiseSize,
  type MerchandiseSkuId,
} from "@/lib/merchandise";
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

function formatCents(cents: number): string {
  return formatUsd(cents / 100);
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

type SwagCartSectionProps = {
  cart: CartLine[];
  onChange: (cart: CartLine[]) => void;
  disabled?: boolean;
};

function SwagCartSection({ cart, onChange, disabled }: SwagCartSectionProps) {
  const [sizes, setSizes] = useState<Record<MerchandiseSkuId, MerchandiseSize>>({
    tshirt: "AM",
    shorts: "AM",
  });

  const addItem = (skuId: MerchandiseSkuId) => {
    const size = sizes[skuId];
    const existingIndex = cart.findIndex(
      (line) => line.skuId === skuId && line.size === size,
    );
    if (existingIndex >= 0) {
      onChange(
        cart.map((line, index) =>
          index === existingIndex
            ? { ...line, quantity: line.quantity + 1 }
            : line,
        ),
      );
      return;
    }
    onChange([...cart, { skuId, size, quantity: 1 }]);
  };

  const removeLine = (index: number) => {
    onChange(cart.filter((_, i) => i !== index));
  };

  return (
    <section className="space-y-4" data-testid="registration-swag-cart">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-tight">
          Team gear (optional)
        </h2>
        <p className="text-sm text-muted-foreground">
          Add a t-shirt or shorts to your registration. Sizes ship with camp
          gear.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {MERCHANDISE_CATALOG.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4"
            data-testid={`swag-product-${item.id}`}
          >
            {item.imageSrc ? (
              <img
                src={item.imageSrc}
                alt={item.name}
                className="mx-auto h-36 w-36 object-contain"
                data-testid={`swag-image-${item.id}`}
              />
            ) : null}
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm font-semibold">{formatUsd(item.priceUsd)}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[7rem] flex-1 space-y-1">
                <Label htmlFor={`swag-size-${item.id}`} className="text-xs">
                  Size
                </Label>
                <Select
                  value={sizes[item.id]}
                  onValueChange={(value) => {
                    if (!value) return;
                    setSizes((current) => ({
                      ...current,
                      [item.id]: value as MerchandiseSize,
                    }));
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger
                    id={`swag-size-${item.id}`}
                    className="h-10 bg-white"
                    data-testid={`swag-size-${item.id}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MERCHANDISE_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                data-testid={`swag-add-${item.id}`}
                onClick={() => addItem(item.id)}
              >
                Add
              </Button>
            </div>
          </div>
        ))}
      </div>

      {cart.length > 0 ? (
        <ul className="space-y-2 rounded-lg border border-zinc-200 bg-white p-4 text-sm">
          {cart.map((line, index) => {
            const item = getMerchandiseItem(line.skuId)!;
            return (
              <li
                key={`${line.skuId}-${line.size}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2"
                data-testid="swag-cart-line"
              >
                <span className="flex items-center gap-3">
                  {item.imageSrc ? (
                    <img
                      src={item.imageSrc}
                      alt=""
                      className="h-12 w-12 rounded object-contain"
                    />
                  ) : null}
                  {item.name} · {line.size} × {line.quantity}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {formatUsd(item.priceUsd * line.quantity)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => removeLine(index)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No gear added yet.</p>
      )}
    </section>
  );
}

function OrderTotalBreakdown({
  cart,
  tuitionCents,
}: {
  cart: CartLine[];
  tuitionCents: number;
}) {
  const swagCents = computeSwagCents(cart);
  const totalCents = computeRegistrationTotalCents(cart, tuitionCents);

  return (
    <dl
      className="space-y-2 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm"
      data-testid="registration-order-total"
    >
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">Clinic tuition</dt>
        <dd className="font-medium">{formatCents(tuitionCents)}</dd>
      </div>
      {swagCents > 0 ? (
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Team gear</dt>
          <dd className="font-medium">{formatCents(swagCents)}</dd>
        </div>
      ) : null}
      <div className="flex justify-between gap-4 border-t border-zinc-100 pt-2">
        <dt className="font-semibold">Total due</dt>
        <dd className="font-heading text-lg font-semibold">
          {formatCents(totalCents)}
        </dd>
      </div>
    </dl>
  );
}

type StripeCheckoutFormProps = {
  playerId: string;
  programId: string;
  clinicId: string;
  playerName: string;
  clinicLabel: string;
  cart: CartLine[];
  totalCents: number;
  onEnrolled: (message: string) => void;
};

function StripeCheckoutForm({
  playerId,
  programId,
  clinicId,
  playerName,
  clinicLabel,
  cart,
  totalCents,
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

      await completePaidRegistration(playerId, programId, clinicId, cart);

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
          {submitting ? "Processing…" : `Pay ${formatCents(totalCents)}`}
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
  cart: CartLine[];
  totalCents: number;
  onEnrolled: (message: string) => void;
};

function StripePaymentSection({
  playerId,
  programId,
  clinicId,
  parentUserId,
  playerName,
  clinicLabel,
  cart,
  totalCents,
  onEnrolled,
}: StripePaymentSectionProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const cartKey = JSON.stringify(cart);

  useEffect(() => {
    let cancelled = false;
    setClientSecret(null);
    setLoadError(null);

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
            cart,
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
    // cartKey tracks cart contents for PaymentIntent recreation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId, programId, clinicId, parentUserId, cartKey]);

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
      key={clientSecret}
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
        cart={cart}
        totalCents={totalCents}
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
  cart: CartLine[];
  totalCents: number;
  onEnrolled: (message: string) => void;
};

function DemoPaymentForm({
  playerId,
  programId,
  clinicId,
  playerName,
  clinicLabel,
  cart,
  totalCents,
  onEnrolled,
}: DemoPaymentFormProps) {
  const { completePaidRegistration } = useRegistration();
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [billingZip, setBillingZip] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handlePaymentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPaymentError(null);

    const result = await completePaidRegistration(
      playerId,
      programId,
      clinicId,
      cart,
    );
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
          Pay {formatCents(totalCents)}
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
  const [cart, setCart] = useState<CartLine[]>([]);

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

  const tuitionCents = useMemo(
    () => (clinic ? getClinicTuitionCents(clinic) : 0),
    [clinic],
  );

  const totalCents = useMemo(
    () => computeRegistrationTotalCents(cart, tuitionCents),
    [cart, tuitionCents],
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
            : "Review player and clinic details, optionally add team gear, then pay to finish enrollment."}
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
            </dl>
          </CardContent>
        </Card>
      </div>

      {paid || isPaid ? null : (
        <>
          <SwagCartSection cart={cart} onChange={setCart} />
          <OrderTotalBreakdown cart={cart} tuitionCents={tuitionCents} />
        </>
      )}

      <Card
        data-testid="registration-payment-card"
        className="border-zinc-200 bg-zinc-50 ring-zinc-200/80"
      >
        <CardHeader className="border-b border-zinc-200/80 bg-zinc-100/60">
          <CardTitle className="font-heading text-xl">Payment</CardTitle>
          <CardDescription className="text-base">
            {stripeEnabled
              ? `Pay ${formatCents(totalCents)} securely with Stripe for ${clinicLabel}.`
              : `Enter card details to pay ${formatCents(totalCents)} for ${clinicLabel}. Demo mode (Stripe keys not configured).`}
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
              cart={cart}
              totalCents={totalCents}
              onEnrolled={handleEnrolled}
            />
          ) : (
            <DemoPaymentForm
              playerId={player.id}
              programId={program.id}
              clinicId={clinic.id}
              playerName={player.name}
              clinicLabel={clinicLabel}
              cart={cart}
              totalCents={totalCents}
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
