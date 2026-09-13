# Shifty Player management platform

Great teams need a flexible team management solution that provides a simple way to manage programs, clinics and training for youth sports.  Connect parents, players and coaches in one place.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

![Shifty player registration](images/shifty-programs.png)

## Stripe payments (test mode)

Parent clinic checkout uses [Stripe Payment Element](https://docs.stripe.com/payments/payment-element) when keys are configured. Without `STRIPE_SECRET_KEY`, the app keeps a **demo card form** so local/CI Playwright tests keep working.

1. Copy [`.env.example`](.env.example) to `.env.local` and set test keys from the [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys):
   - `STRIPE_SECRET_KEY` — `sk_test_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — `pk_test_…`
   - `STRIPE_WEBHOOK_SECRET` — from `stripe listen` (below)
2. Restart `npm run dev` after changing env.
3. Forward webhooks locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Paste the printed `whsec_…` into `.env.local` as `STRIPE_WEBHOOK_SECRET`.
4. Pay with test card `4242 4242 4242 4242` (any future expiry, any CVC, any ZIP).

Flow: create PaymentIntent → confirm Payment Element → server `confirm-enrollment` retrieves the PaymentIntent from Stripe → only then the client enrolls in localStorage. The webhook records `payment_succeeded` metrics and is idempotent; it does not write browser storage.

Paid enrollments still increment Prometheus series via `/api/metrics/events` (and the webhook) — see Metrics below.

## Metrics (Prometheus / Grafana)

The app exposes Prometheus metrics for an **existing** Prometheus/Grafana stack (for example on another machine’s Kubernetes cluster). No local Prometheus/Grafana containers are required.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/metrics` | Prometheus scrape (text exposition format) |
| `POST /api/metrics/events` | Ingest demo events (`registration_started`, `payment_succeeded`, `payment_failed`) |

Useful series:

- `shifty_registrations_total` — continue-to-payment starts
- `shifty_payments_total{status="succeeded\|failed"}` — checkout outcomes
- `shifty_clinic_enrollments_total` — successful paid enrollments
- Default Node process metrics from `prom-client`

### Wire Prometheus (Docker Compose + ConfigMap)

Keep `npm run dev` running so `GET http://localhost:3000/api/metrics` works on the host.

#### A) Prometheus in **Docker Compose** (same machine as the app)

1. Add a scrape job that targets the host via `host.docker.internal:3000` (see [`observability/docker-compose-prometheus.yml`](observability/docker-compose-prometheus.yml)).
2. Ensure the Prometheus service has host access, e.g. `extra_hosts: ["host.docker.internal:host-gateway"]`.
3. Recreate/reload Prometheus, then open **http://localhost:9090/targets** and confirm `shifty-player` is **UP**.

#### B) Prometheus in **minikube** with a **ConfigMap** for `prometheus.yml`

1. From minikube, confirm the host app is reachable:
   ```bash
   minikube ssh -- curl -sS http://host.minikube.internal:3000/api/metrics | head
   ```
2. Edit your Prometheus ConfigMap and append this job under `scrape_configs` (full fragment: [`observability/prometheus-scrape-example.yml`](observability/prometheus-scrape-example.yml)):
   ```yaml
   - job_name: shifty-player
     scrape_interval: 15s
     metrics_path: /api/metrics
     scheme: http
     static_configs:
       - targets: ["host.minikube.internal:3000"]
         labels:
           app: shifty-player
           env: local
   ```
3. Apply and reload:
   ```bash
   kubectl -n <namespace> apply -f <your-prometheus-configmap>.yaml
   # Prefer lifecycle reload if enabled:
   curl -X POST http://<prometheus-ui>/-/reload
   # Or restart the Prometheus pod/deployment
   kubectl -n <namespace> rollout restart deploy/<prometheus-deployment>
   ```
4. Prometheus UI → **Status → Targets** → `shifty-player` **UP**.
5. Grafana (pointed at that Prometheus) → query `shifty_payments_total`.

**Target cheat sheet**

| Where Prometheus runs | Scrape target |
| --- | --- |
| Docker Compose on your Mac | `host.docker.internal:3000` |
| Pod inside minikube | `host.minikube.internal:3000` |

**Note:** Counters live in the Next.js process memory and reset when `next dev` restarts. This is for local/demo observability, not durable analytics.
