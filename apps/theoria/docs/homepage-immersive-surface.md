# The home page as a place you enter

`/` presents the Imagined Place demo as a card that holds cards. This file
records what the page measures today, what it should become, and the work that
gets it there, so that each change can be judged against one standard. It
complements `imagined-place-landing-demo.md`, which records what the demo _is_
and what runs; this file records what a visitor should _experience_.

The short version: the demo builds an imagined place from a brief, two
proposals, a signed lineage and a live arrangement search. Today the page
describes that place in a dashboard. It should instead put the visitor inside
the place and let the page be the place's own account of how it came to be.

## The standard

Structure comes from position, grouping, type and space first. A surface,
border, shadow or animation is added only when it explains ownership, state,
containment or causality. Motion explains continuity, feedback, spatial
relation or a state change; it is short, interruptible, never the only cue,
and keeps its meaning under reduced motion. Continuous motion exists only
while a real continuous process runs. Responsive behaviour is recomposition
that preserves priority, not proportional shrinking. Nothing the page shows
may claim more than the code earns.

The page should feel expansive because the place is allowed to occupy it, and
alive because the things that are actually alive on it — the search, the
merge, the re-signing — are allowed to be seen. It should never feel alive by
decoration.

## What the page does today

Measured in Chromium at 1440×900, light theme, every element under `main`:

| Measure                               | Value |
| ------------------------------------- | ----- |
| Elements                              | 643   |
| With a visible border                 | 59    |
| With a border radius                  | 124   |
| Pill-shaped (`border-radius ≥ 999px`) | 74    |
| With a box shadow                     | 19    |
| Deepest bordered-ancestor chain       | 5     |

The depth-5 chains are page → demo card → proposal card → sealed-note box →
pill, and page → demo card → code panel → header rail → Copy button. The place
itself — its prose and discs, the artifact the demo exists to show — sits on a
bordered paper inside a bordered stage inside a `2rem`-radius card, at roughly
half the content width, below a hero that talks about libraries. On the first
viewport a visitor sees a headline and two buttons; the place is a scroll
away. Under the sticky stage the right column is empty for most of the page.
At 390 px the outer card is about twelve screens tall and its border and
padding take about 8 % of the width.

The vocabulary produced this. `view/primitives/designSystem.ts` once
declared seventeen `surfaceMaterials` with nine distinct radii, fifteen of
them without a caller, beside a dozen zero-caller theme resolvers
(`evidenceSectionThemeFor`, `obstacleToneClassesFor`, `surfaceThemeForCard`,
`badgeThemeFromSurface`, `metricPillClassesFor`, `panelButtonClassName`,
`appTheme.homeGrid`, `appTheme.compactNav`). That dead vocabulary is gone; the
two materials still in use, `raisedCard` and `calloutError`, are the card
vocabulary of the package catalog `/` replaced, and every new element still
reaches for them.

Two more findings, the first now resolved by the toolchain branch. The code
tabs were plain `Button`s without `tablist` semantics, the scenario chooser was
`aria-pressed` buttons and the merge switch a `Button role="switch"`; they are
now Base UI `Tabs`, `RadioGroup` and `Switch` (`TabBar.tsx`, `ChoicePills.tsx`,
`ToggleSwitch.tsx`), so the redesign changes their appearance, not their
semantics. The second stands: motion is still CSS only, so merging a proposal
makes a disc appear on the stage with no continuity from the proposal that
offered it — the one causal moment the demo exists to show.

## What the page should be

### The place is the page

The stage stops being an illustration inside the demo and becomes the page's
first and largest thing. On arrival the visitor is already inside _The
Unfinished Light_: the place's title is the display type, its atmosphere is
the lead, its prose and discs fill the first viewport, and the arrangement
search is visibly settling as the page loads. Theoria's own sentence
("Scientific computing and model programming with Effect") stays the `h1` for
meaning and search, set as a quiet lead above the place; the place's title is
an `h2` set as display. Heading rank and visual role are independent.

The header is three text links and an icon. There are no glow layers, no
frame around the stage, no eyebrow tags. The paper is the canvas.

### Scrolling is deepening, not paging

Below the place, the page is one continuous account in four acts — Compose,
Propose, Record, Build — separated by space and at most a hairline. The place
does not leave: on wide screens it stays pinned and the acts pass beside it;
on narrow screens it pins as a shrinking band at the top so the world is
present while the visitor reads how it was made. Each act is the same object
seen from one side. Which act is in view is state (`placeActAtom`, derived
from the intersection of act landmarks), and the stage answers it: in Compose
the composed features are named; in Propose the proposed features appear as
ghost discs at the margin of the paper; in Record the two versions are
distinguishable on the paper; in Build the disc, line or signature under the
pointer is answered by the code that made it.

No scroll-jacking, no parallax, no scroll-linked transforms. Scroll position
selects state; motion between states is the theme's short transition.

### Voices, not cards

Proposals are marginalia. Each proposal sits beside the sentence in the prose
it would add, with a 2 px left rule in the proposer's tone — dashed while
declined, solid while accepted — and no background, radius or shadow. The
neighbor's sealed note is a fold: closed, it shows the envelope size and the
seal glyph; opened with the author's key, it is a `blockquote` with the seal
tone's rule. Merging is the visitor's sentence joining the place: the feature
name in the proposal and its disc on the stage share a `layoutId`, so flipping
`Merge` moves the name onto the paper and the description re-flows around it.
Flipping back returns it to the margin. Declined proposals stay in view with
their signatures, as they stay in the result.

### Lineage is a strand, not a table

Versions are a thin vertical strand along the inside edge of the reading
column with a knot per version. `V1 · Origin` and `V2 · Current` are labels
on the knots; what changed and who contributed it reads as prose beside them;
the BLAKE3 ID is the fingerprint under each knot in technical type. When a
merge changes the version, the strand grows a knot and the current ID washes
once. The same strand appears on the pinned stage as two small knots so the
version is always visible without a badge.

### Every mark has a provenance

Theoria's promise is that evidence is retained. The page proves it at the
level of the pixel: pointing at or focusing any mark asks the page how it knows.
A disc answers with its feature, contributor and the trial that placed it; a
narrowed line answers with the disc that narrowed it and the `layoutLinesWith`
call; a signature answers with the key and the `sign` call; the version ID
answers with the digest and its parent. In the Build act the answer is also a
highlighted line in the code beside the value it produced. This is one atom
(`placeFocusAtom`) read by the stage, the proposals, the lineage and the code
block; there is no separate tooltip system. Provenance replaces the pills:
`Verified`, `Recorded inference`, `You signed`, `In v2` become glyph-and-text
`InlineStatus` marks whose provenance is one focus away.

### The world has weather

The three scenarios are three worlds, and switching worlds should change the
air of the page, not a chip. Each scenario declares a world tone
(`--th-world-*`: a canvas tint, a paper gradient, a rule colour, a disc
palette) in `styles.css`, authored separately for light and dark so that the
Library Under Cald Water is cool and dim in both themes and The Market of Lost
Things is warm in both. The tone is semantic — it tells the visitor which
world they are in — and is bounded: text and control colours do not change,
contrast minima hold in every world in both themes, and the tone is the only
"expressive" colour on the page.

### The search is the only continuous motion

The arrangement search is a real process with thirty-six trials, and it is
the one thing on the page allowed to move on its own. It runs at page size:
discs settle on the paper and the description re-wraps around them while the
trace below the paper draws its running best. When it finishes, the page is
still. Scrubbing the trace draws a rejected arrangement on the paper as a
ghost over the kept one, so a visitor can see what the search refused. Discs
are still placed outright while scrubbing, as the demo decided; continuity is
for merges and version changes, not for browsing trials.

### The underside

`How it's built` is the page turned over. The four acts' code is one Base UI
tab set with an underline indicator; the code block is the page's one
instrument surface; the live values sit as annotation rows under the lines
that made them; the files that ran link to GitHub at the build's commit. The
Build act is where provenance focus becomes bidirectional: pointing at a code
line highlights the mark on the stage it produced, and pointing at a mark
highlights the line.

## Composition

```
main (canvas; world tone on :root via data-world)
├─ SiteHeader                wordmark · Docs · GitHub · theme icon — text, no chips
├─ Arrive                    h1 (lead role) · place title (display) · atmosphere · brief
│  └─ PlaceStage             unframed paper, full content width; discs, walk, prose;
│                            search trace as a strand beneath; presets; version knots
├─ Act: Compose              lg: pinned stage right, act left [1fr | minmax(28rem, 44rem)]
│                            scenario radio group · brief textarea (instrument) · features inline
├─ Act: Propose              proposals as marginalia beside the prose they add
├─ Act: Record               lineage strand; IDs as fingerprints
├─ Act: Build                tabs · code (instrument) · references · files
└─ SiteFooter
```

At `lg` and above the stage is pinned and the acts scroll beside it. Below
`lg` the stage leads the page at full width, then pins as a band whose height
clamps between `12rem` and `40vh` while the acts scroll under it; the band
keeps the discs and the version knots and drops the prose, so the world is
never off screen. At 320 px the paper is at least 240 px wide; the scenario
group scrolls horizontally with `scroll-snap-type: x proximity`.

## Surfaces

Three roles replace `surfaceMaterials`:

| Role         | Carries                                           | Treatment                                                                  |
| ------------ | ------------------------------------------------- | -------------------------------------------------------------------------- |
| `canvas`     | the place, prose, discs, acts, proposals, lineage | the page; no border, radius or shadow                                      |
| `instrument` | code block, brief textarea, search trace          | one tint step above canvas (`stage-100`), `--radius-instrument`, no shadow |
| `overlay`    | provenance popover, docs preview, dialogs         | `stage-0`, `shadow-surface`, `--radius-instrument`; the only elevation     |

Boundaries: a hairline `border-t` between acts at `lg` and up; a 2 px left
rule on a proposal; the lineage strand. Nothing else draws a box. Pills remain
only for selections (scenario, stage presets). Package names are inline
monospace links in their tone.

## Motion

`motion` 13.x is added and configured once at the root: `MotionConfig
reducedMotion="user"` with the theme's enter transition, `LazyMotion strict`
with `domAnimation`, and `m` from `motion/react-m` in feature code. Durations
and easing are theme tokens (`--th-motion-duration-enter: 240ms`,
`--th-motion-duration-shift: 320ms`, `--th-motion-ease`). Five relationships
are animated, and nothing else:

| Relationship              | Mechanism                                                         |
| ------------------------- | ----------------------------------------------------------------- |
| A merged feature travels  | shared `layoutId` between proposal name and disc                  |
| A version re-flows        | `AnimatePresence mode="popLayout"` on prose lines, ≤ 300 ms total |
| Discs keep place on merge | `layout` on `PlaceMarker`; `layout={false}` while scrubbing       |
| The act changes           | opacity and 4 px rise on the act's stage answer                   |
| The search runs           | the existing per-frame render; the only continuous motion         |

Under reduced motion transforms are off and only opacity remains. No state is
carried by motion alone: the merge accompanies the switch and the `In v2`
mark, the version accompanies a changed content ID.

## Effect and Effect Atom

The experience layer is three atoms beside the existing ones, all pure
derivations or explicit effects:

- `placeActAtom`: `"arrive" | "compose" | "propose" | "record" | "build"`,
  written by one `IntersectionObserver` effect over the act landmarks, read by
  the stage.
- `placeFocusAtom`: `Option<PlaceProvenance>`, a tagged union
  (`Feature | Line | Signature | Version | Trial | CodeLine`) written by
  hover and focus handlers, read by every surface that can answer.
- `placeWorldAtom`: derived from `placeControlsAtom.scenario`; sets
  `data-world` on `:root` through one effect so the tone is CSS, not props.

Provenance answers are computed from `PlaceBuild` and the current
`PlaceRendering` with `Match.exhaustive`; nothing is stored that can be
derived.

## Work

### Act 0 — Vocabulary (removes the cards)

- [ ] `styles.css` `@theme inline`: `--color-rule`, `--color-rule-strong`,
      `--color-instrument`, `--radius-instrument: 0.75rem`,
      `--radius-control: 0.5rem`, with `--th-*` values in `:root` and
      `:root.dark`.
- [ ] `designSystem.ts`: `SurfaceRole` and `surfaceClassName(role)` via
      `Match.exhaustive` replace the two remaining `surfaceMaterials`
      (the zero-caller exports are already removed).
- [ ] `StatusPill` → `InlineStatus`; `TagBadge` → `ParticipantName`;
      `PackagePill` → `PackageName`; `ContentCard` removed from home and
      `DocsPage.tsx`; `ContentCardShape`/`ContentCardDensity` removed.
- [ ] `ArtifactStage.tsx`: `frame: "none" | "instrument"`; home uses `"none"`.
- [ ] `SiteHeader.tsx`, `HeaderChrome.tsx`: text links, icon-only theme
      toggle; `headerChromeSurfaceClassName` removed.
- [ ] `test/worker/home.test.ts`: the rendered `canvas` role has no border,
      radius or box shadow in computed style. Verification of the de-carding
      itself is visual — screenshots at 1440 and 390 inspected in review — not
      a test that counts bordered ancestors or `shadow-*` classes; a
      structure-counting test pins today's markup and is exactly the kind of
      governance test this repository removed.

### Act 1 — The place is the page

- [ ] `HomePage.tsx`: glow layers removed; padding
      `max-w-[88rem] px-5 sm:px-8 lg:px-12`; the stage is the first child
      after the header.
- [ ] `HomeHero.tsx` → `PlaceArrive.tsx`: `h1` in the lead role; place title
      in the display role (`text-balance`, 44/50 at `sm`, 64/68 at `lg`);
      atmosphere as lead; one filled action (`Read how it's built`), one text
      action (`Browse the packages`).
- [ ] `PlaceStage.tsx`: paper at full content width; `placeStageWidthAtom`
      reads the content width; version knots rendered on the paper.
- [ ] `ImaginedPlaceDemo.tsx` → `PlaceActs.tsx`: `lg:grid-cols-[1fr_minmax(28rem,44rem)]`
      with the stage `sticky top-6` in the first column; below `lg`, the stage
      pins as a band (`sticky top-0`, `max-h-[40vh] min-h-[12rem]`) that
      hides its prose via container query.
- [ ] `test/worker/home.test.ts` — _the place is in the first viewport_: at
      390×844 and 1440×900 the paper's top edge and at least one disc are
      inside the viewport before any scroll.

### Act 2 — Voices and lineage

- [ ] `PlaceProposalCard.tsx` → `PlaceProposal.tsx`: `article` with
      `pl-4 border-l-2`; dashed neutral while declined, solid proposer tone
      while accepted; sealed note as a fold that opens into a `blockquote`.
- [ ] `PlaceProposals.tsx`: proposals anchored beside the prose line they
      would add (`placeViewModel` exposes the anchor line index).
- [ ] `PlaceLineage.tsx` → `PlaceStrand.tsx`: strand and knots; IDs in
      technical type; the wash on version change stays.
- [x] `ToggleSwitch` on Base UI `Switch`; `ChoicePills` on `RadioGroup` with
      `appearance: "pill" | "segment"`; `TabBar` on `Tabs` (done on the
      toolchain branch).
- [ ] `TabBar`: the 2 px indicator; `ChoicePills` → `ChoiceGroup` rename.
- [ ] `test/worker/home-demo.test.ts` — _keyboard reaches every control_:
      scenario radio (arrows rebuild) → textarea → merge switch (Space) →
      tabs (arrows change the panel) → trace slider, asserting active roles
      in order.

### Act 3 — Motion

- [x] `package.json`: `motion` 13.x; `App.tsx`: `MotionConfig
    reducedMotion="user"` at the root (done on the toolchain branch).
- [ ] `App.tsx`: `LazyMotion strict` with the theme's enter transition; motion
      tokens in `styles.css`.
- [ ] `PlaceMarker.tsx`: `m.button` with `layout` and
      `layoutId="place-feature:<name>"`; `layout={false}` while
      `placeTrialPreviewAtom` is `Some`.
- [ ] `PlaceProposal.tsx`: the feature name carries the same `layoutId`
      while declined.
- [ ] `PlaceStage.tsx`: `AnimatePresence mode="popLayout"` on prose lines
      keyed by version content ID; stagger 20 ms, total ≤ 300 ms, exit 120 ms.
- [ ] `test/worker/home-demo.test.ts` — _a merged feature travels to the
      stage_: after the toggle the disc exists and the proposal no longer
      renders the name as a `layoutId` element; under
      `emulateMedia({ reducedMotion: "reduce" })` no element in `main` has a
      non-identity transform mid-transition.

### Act 4 — Acts, provenance and weather

- [ ] `atoms/imagined-place-experience.ts`: `placeActAtom`, `placeFocusAtom`,
      `placeWorldAtom`; `contracts/demo/imagined-place-provenance.ts`:
      `PlaceProvenance` and `provenanceFor` over `PlaceBuild` and
      `PlaceRendering`.
- [ ] `PlaceStage.tsx`: act answers (ghost discs in Propose, version
      distinction in Record); `PlaceProvenance.tsx`: one overlay that renders
      any `PlaceProvenance`; disc popovers, ID tooltips and status pills fold
      into it.
- [ ] `PlaceHowItsBuilt.tsx`: code lines carry `data-provenance`; focus on a
      line writes `placeFocusAtom`; a focused mark highlights its line.
- [ ] `styles.css`: `--th-world-{unfinished-light,lost-market,drowned-library}-*`
      for light and dark; `:root[data-world]` selects them; contrast checked
      per world per theme against rendered colors in `test/worker/home.test.ts`.
- [ ] `test/worker/home-demo.test.ts` — _every mark answers_: for each
      `[data-provenance]` in `main`, hover shows an overlay naming a package;
      the count of marks without provenance is zero. _The world changes the
      air_: switching scenario changes `data-world` on `:root` and the
      computed canvas colour, and text colour does not change.

### Act 5 — Responsive and environmental verification

- [ ] 320, 390, 768, 1024, 1280, 1440, 1920 × light and dark × three worlds:
      no element overflows; the paper and a disc are in the first viewport.
- [ ] 200 % zoom at 1280: no horizontal scroll; the display title wraps to
      ≤ 3 lines; the pinned band never covers the focused control.
- [ ] Forced colors: proposer rule, switch state, tab indicator and strand
      knots stay visible without background colour.
- [ ] Reduced motion: the search still renders per frame (it is a real
      process), merges and version changes are opacity only, nothing else
      moves.
- [ ] Re-run the measurement above and record the after values in the table;
      the target is ≤ 10 bordered elements and ≤ 4 shadows at 1440 with the
      overlay closed.

## Non-goals

- `/docs` beyond removing `ContentCard` and inheriting the header, footer and
  type scale.
- Demo content, scenarios, the server build or the arrangement search itself.
- Parallax, scroll-linked transforms, particles, ambient animation, sound.
- Any claim the build does not make: the page shows session keys, recorded
  inference and a seeded search, and says so.
- Adopting a shared external theme package; this work reshapes the app's own
  `styles.css` and `designSystem.ts` so that a later adoption has less to
  undo.

## Done when

```bash
bun run check && bun run check:tests && bun run lint && bun run test
bun run --filter @theoria/theoria-app build && bun run --filter @theoria/theoria-app test:worker
```

and a visitor at 390×844 with reduced motion on sees the place, a disc and the
version before scrolling, can merge a proposal from the keyboard and watch the
prose change, and can ask any mark on the page how it knows.
