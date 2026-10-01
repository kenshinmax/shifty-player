#!/usr/bin/env node
/**
 * One-time setup: creates the custom HubSpot contact and deal properties Shifty writes.
 *
 *   HUBSPOT_ACCESS_TOKEN=pat-... node scripts/hubspot-setup.mjs
 *
 * The private app needs the crm.schemas.contacts.write and
 * crm.schemas.deals.write scopes for this script.
 * Safe to re-run: properties that already exist are skipped.
 */

const token = process.env.HUBSPOT_ACCESS_TOKEN?.trim();
if (!token) {
  console.error("Set HUBSPOT_ACCESS_TOKEN first.");
  process.exit(1);
}

const yesNo = [
  { label: "Yes", value: "true", displayOrder: 0 },
  { label: "No", value: "false", displayOrder: 1 },
];

const CONTACT_PROPERTIES = [
  { name: "shifty_marketing_opt_in", label: "Shifty: marketing opt-in", type: "bool", fieldType: "booleancheckbox", options: yesNo },
  { name: "shifty_signup_date", label: "Shifty: signup date", type: "date", fieldType: "date" },
  { name: "shifty_player_count", label: "Shifty: number of players", type: "number", fieldType: "number" },
  { name: "shifty_player_grades", label: "Shifty: player grades", type: "string", fieldType: "text" },
  { name: "shifty_last_program", label: "Shifty: last program", type: "string", fieldType: "text" },
  { name: "shifty_last_payment_date", label: "Shifty: last payment date", type: "date", fieldType: "date" },
  { name: "shifty_last_payment_amount", label: "Shifty: last payment amount (USD)", type: "number", fieldType: "number" },
];

// shifty_payment_id is the deal's unique key, so a retried sync updates the same deal.
const DEAL_PROPERTIES = [
  { name: "shifty_payment_id", label: "Shifty: Stripe payment ID", type: "string", fieldType: "text", hasUniqueValue: true },
  { name: "shifty_program", label: "Shifty: program", type: "string", fieldType: "text" },
];

const TARGETS = [
  ...CONTACT_PROPERTIES.map((property) => ({ objectType: "contacts", groupName: "contactinformation", property })),
  ...DEAL_PROPERTIES.map((property) => ({ objectType: "deals", groupName: "dealinformation", property })),
];

let failed = false;
for (const { objectType, groupName, property } of TARGETS) {
  const response = await fetch(`https://api.hubapi.com/crm/v3/properties/${objectType}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ groupName, ...property }),
  });
  if (response.ok) {
    console.log(`created  ${objectType}.${property.name}`);
  } else if (response.status === 409) {
    console.log(`exists   ${objectType}.${property.name}`);
  } else {
    failed = true;
    console.error(`FAILED   ${objectType}.${property.name}: ${response.status} ${await response.text()}`);
  }
}
process.exit(failed ? 1 : 0);
