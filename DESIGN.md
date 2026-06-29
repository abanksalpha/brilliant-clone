# DESIGN.md

The visual language already lives in `frontend/src/styles.css` (the
`theme-handdrawn` system). Read it for exact variables. This file captures the
tokens new UI must reuse so the five-phase lesson stays consistent with the app.

## Color (OKLCH, tinted neutrals, never #000 or #fff)

- Paper surface: `oklch(99% 0.006 82)`; page background `--sketch-paper` with a
  24px dot grid (`--sketch-texture-dot`).
- Ink (text): the `--ink` token (a warm near-black, not pure black).
- Borders: `oklch(82% 0.025 78)`, 1px sketch borders.
- Muted label: `oklch(45% 0.035 72)`; form label `oklch(34% 0.025 72)`.
- Focus ring: `oklch(52% 0.105 236)`.
- Accents (use sparingly, one per surface): amber `#e7a13a` (primary action),
  blue `#2f7ad1`, green `#4cae7a` (success/complete), terracotta `#dd7159`
  (active/attention). Translate to OKLCH when adding new rules.

Color strategy: Restrained. Tinted neutrals plus one accent per surface. Green
signals completed phases; amber the current action.

## Theme

Light. Scene: a student at a desk in the evening, working problems on paper under
a warm lamp. The hand-drawn paper theme is the product's identity; do not switch
to dark.

## Typography

- Headings: the pixel display face (`--font-text` family per styles.css), large,
  tight letter-spacing (h1 2.25rem/720, h2 1.2rem/680).
- Body: 1.22rem base, line-height ~1.5 to 1.58, max width 68ch (cap 65 to 75ch).
- Hierarchy by scale and weight, not color.

## Motion

- Exponential ease-out only (ease-out-quart/quint/expo). No bounce, no elastic.
- Do not animate layout properties. Confetti via `lib/confetti.ts`, always
  guarded by `prefers-reduced-motion`.

## Components and bans

- Reuse the existing `panel`, `secondary-button`, `secondary-link` classes and
  the `theme-handdrawn` containers. Min tap target 44px.
- Banned: hero-metric template, side-stripe accent borders, gradient text,
  decorative glassmorphism, identical card grids, modal-as-first-thought.
- No em dashes in any copy. No restated headings or filler.
