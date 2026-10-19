# Brand guidelines

How Shifty Player uses color. The tokens live in [`app/globals.css`](../app/globals.css)
and are exposed as Tailwind utilities (`bg-brand`, `text-tone-success-ink`, …).

**Rule of thumb:** use a token, not a raw palette class. If you reach for
`bg-sky-50` or `text-emerald-700`, there is a token for it. If no token fits,
add one here and in `globals.css` rather than inlining a new color.

## Palette

| Token | Utility examples | Light value | Use for |
| --- | --- | --- | --- |
| `--ink` / `--ink-foreground` | `bg-ink text-ink-foreground` | zinc-900 / near-white | Hero cards, active nav items, active filter tabs. The darkest surface. |
| `--canvas` | `bg-canvas ring-1 ring-canvas-ring` | slate-100 | The tinted panel a dashboard's content sits on, so white cards stand out. |
| `--surface-muted` | `bg-surface-muted` | slate-50 | Table header rows, form field panels, nested sub-forms inside a white card. |
| `--background` | `bg-background` | white | Every card, table container and sidebar sitting on the canvas. |
| `--brand` | `border-brand`, `bg-brand` | sky-500 | Section-heading accent bars, card top bars, the primary chart series. |
| `--brand-strong` | `stroke-brand-strong` | sky-600 | Chart lines and points that need a little more weight than `--brand`. |
| `--brand-soft` | `bg-brand-soft` | sky-50 | Highlighted surfaces: CTA strips, card headers, summaries, nav hover. |
| `--brand-border` | `border-brand-border` | sky-200 | Borders on `brand-soft` surfaces and brand badges. |
| `--brand-ink` | `text-brand-ink` | sky-900 | Text on `brand-soft` surfaces. |

### Status tones

Each tone has a fill (bars, dots, chart series) and an `-ink` variant for text
that passes contrast on white.

| Tone | Fill / ink | Meaning — use consistently |
| --- | --- | --- |
| `info` | sky-500 / sky-700 | Players, people, registrations |
| `success` | emerald-500 / emerald-700 | Paid, sent, completed, positive deltas |
| `warning` | amber-500 / amber-700 | Pending, needs follow-up |
| `accent` | violet-500 / violet-700 | Sessions, teams, programs |

Errors keep shadcn's `--destructive`.

### Charts

`--chart-1`…`--chart-5` map to brand, accent, success, warning and slate, in
that order. Assign series in that order (`fill-chart-1`, `bg-chart-1` for the
legend swatch) so every chart in the app shares one color story.

## Patterns

**Dashboard layout** — page header on white, then one canvas panel holding
everything else:

```tsx
<div className="space-y-8 rounded-3xl bg-canvas p-4 ring-1 ring-canvas-ring sm:p-6">
  …white cards…
</div>
```

**Section heading** — a brand accent bar on the left:

```tsx
<div className="border-l-4 border-brand pl-4">
  <h2 className="font-heading text-xl font-medium">Players</h2>
  <p className="text-sm text-muted-foreground">…</p>
</div>
```

**Metric tile** — use `StatTile` from
[`components/stat-tile.tsx`](../components/stat-tile.tsx) with the tone that
matches the metric's meaning (see the table above):

```tsx
<StatTile label="Payment links sent" value={sentCount} tone="success" />
```

**Table** — wrap in a white card and tint the header:

```tsx
<div className="overflow-hidden rounded-xl border bg-background shadow-sm">
  <Table>
    <TableHeader className="bg-surface-muted">…</TableHeader>
    …
  </Table>
</div>
```

**Highlight strip / callout** — `rounded-xl border border-brand-border bg-brand-soft text-brand-ink`.

**Hero / marketing card** — `bg-ink` (or `bg-zinc-950` on full-bleed marketing
bands) with a soft glow: `bg-linear-to-br from-cyan-400/20 via-transparent to-transparent`.
Sky and amber glows are also used on the marketing pages; keep glows at 20–25%
opacity.

## Don'ts

- Don't build a section from grey on grey (for example a `zinc-50` card on a
  white page). Put white cards on the canvas instead.
- Don't use a status tone for decoration. Green means paid or done; amber means
  something needs attention.
- Don't introduce a new hue without adding it here first.

## Not yet migrated

The marketing pages (`home-content`, `programs-values`, `showcases-content`,
`summer-2027-programs`, `sessions-showcase`, `sessions-table`) and the checkout
card in `registration-review` still use raw `zinc-*` classes and glow
gradients. They match this guide visually; move them to tokens when you next
touch them.
