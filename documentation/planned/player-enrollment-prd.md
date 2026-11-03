# Product Requirements Document: Player Enrollment

**Product:** Shifty Player Platform
**Status:** Planned
**Date:** 2026-11-02
**Owner:** TBD

## 1. Background

Basketball organizations on Shifty Player run **programs** (for example, Summer Camp 2026). Each program has one or more **clinics**, usually one per week. Parents add their children to their account and enroll them in a clinic, then pay through Stripe. A background worker checks each payment and confirms the enrollment once Stripe reports it as paid.

Today the platform already:

- Only offers programs an admin has opened, and clinics an admin has made available.
- Gives each clinic a capacity (50 by default) and counts the spots taken.
- Confirms each Stripe payment once, so retries and webhooks don't create a second enrollment.

What the platform doesn't do is check for an existing enrollment **before** the parent pays. If a player is already enrolled, a second checkout still takes the money and then quietly makes no change. The rules for who can enroll, and when, are also spread across the code instead of being written down in one place.

## 2. Problem Statement

Parents can pay twice for the same program, and admins have to sort out refunds and roster confusion by hand. Without written enrollment rules, it's unclear what the platform should allow, block or tell the parent.

## 3. Goals

1. A player can't be enrolled twice in the same program.
2. Parents find out a player is ineligible **before** they pay, not after.
3. Clinics never take more players than their capacity.
4. Every enrollment matches exactly one successful payment.
5. Parents and admins can always see each enrollment and its status.

## 4. Non-Goals

- Waitlists for full clinics.
- Refunds, transfers between clinics, or partial payments.
- Sibling, early-bird or promo-code discounts.
- Requirements on age, grade or skill level for a program.
- Changing how organizations create programs and clinics.

## 5. Functional Requirements

### FR1 — No duplicate enrollment

- A player can hold only one active enrollment in a given program.
- If a parent picks a program the player is already enrolled in (pending or paid), the platform stops them before checkout. It shows a message such as "Maya is already enrolled in Summer Camp 2026."
- The server enforces the same rule, so a stale page, a second browser tab or a direct API call can't create a duplicate.
- An enrollment an admin has removed doesn't count, so the player can enroll again.

### FR2 — Eligibility before checkout

A player can only be enrolled when all of these are true. If any of them fails, checkout doesn't start and the parent sees the reason.

| Check | Message shown to the parent |
| --- | --- |
| The organization is live | "This organization isn't taking registrations yet." |
| The program is open | "Registration for this program is closed." |
| The clinic is available | "This clinic isn't available." |
| The clinic has a spot left | "This clinic is full." |
| The player isn't already enrolled in the program (FR1) | "[Player] is already enrolled in [Program]." |

### FR3 — Capacity

- A clinic never has more paid enrollments than its capacity.
- Full clinics show as full and can't be selected.
- If two parents compete for the last spot, only one enrollment succeeds. The other parent is told the clinic is full and isn't charged.

### FR4 — Payment and confirmation

- An enrollment is created as **pending** when checkout starts and becomes **paid** only after Stripe confirms the payment.
- One successful payment creates exactly one enrollment, however many times Stripe retries the webhook.
- A failed or abandoned payment doesn't create a paid enrollment.

### FR5 — Visibility

- Parents see each child's enrollments: program, clinic, status (pending or paid) and date paid.
- Admins see each clinic's roster with each player's status, plus spots taken out of capacity.

### FR6 — Removal by an admin

- An admin can remove a player from a program. The enrollment is marked **removed**, not deleted, so the history is kept.
- Removing a player frees their spot in the clinic straight away.

## 6. Non-Functional Requirements

- **Consistency:** the browser and the server check the same eligibility rules. The server is the source of truth.
- **Privacy:** enrollment messages and logs never expose another family's player names or details.
- **Clarity:** every blocked action tells the parent what happened and what they can do next. Messages don't apologise and aren't vague.

## 7. Success Metrics

1. Zero duplicate program enrollments created after release.
2. Zero payments taken for players who were already enrolled.
3. Zero clinics over capacity.
4. Fewer duplicate-payment refunds handled by admins.

## 8. Open Questions

1. **Multiple clinic weeks:** for programs with several weekly clinics, can a player enrolled in week 1 also sign up for week 3? This PRD assumes yes: extra weeks in the same program are allowed, but the same clinic twice isn't. Confirm this is right.
2. **Pending enrollments and capacity:** does a pending (unpaid) enrollment hold a spot, and for how long before it expires?
3. **Abandoned checkouts:** should a pending enrollment block a new checkout for the same program, or should the parent be able to restart payment?
4. **Confirmation email:** should parents get one after a successful enrollment? It's out of scope today.
