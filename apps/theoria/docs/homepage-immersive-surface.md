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
now Base UI `Tabs`, `RadioGroup` and `Switch` (`TabBar.tsx`, `ChoiceGroup.tsx`,
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
tone's rule. Merging is the visitor's sentence joining the place: flipping
`Merge` opens a dashed ring on the paper where the search makes room, the
description re-flows around it, and the disc fills the ring where it stands
once the search settles. Nothing crosses the prose to get there. Flipping back
fades the disc where it stood. Declined proposals stay in view with their
signatures, as they stay in the result.

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
├─ Arrive                    place title (h2) · what this is and how it works (lead)
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

| Relationship              | Mechanism                                                    |
| ------------------------- | ------------------------------------------------------------ |
| A merged feature arrives  | a ring holds its room; the disc fills the ring in place      |
| A version re-flows        | `AnimatePresence mode="wait"` on prose lines, ≤ 300 ms total |
| Discs keep place on merge | the drawing travels frame by frame (`web/motion/travel.ts`)  |
| The act changes           | opacity and 4 px rise on the act's stage answer              |
| The search runs           | the existing per-frame render; the only continuous motion    |

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

- [x] `styles.css` `@theme inline`: `--color-rule`, `--color-rule-strong`,
      `--color-instrument`, `--radius-instrument: 0.75rem`,
      `--radius-control: 0.5rem`, with `--th-*` values in `:root` and
      `:root.dark`.
- [x] `designSystem.ts`: `SurfaceRole` and `surfaceClassName(role)` via
      `Match.exhaustive` replace the two remaining `surfaceMaterials`
      (the zero-caller exports are already removed).
- [x] `StatusPill` → `InlineStatus`; `TagBadge` → `ParticipantName`;
      `PackagePill` → `PackageName`; `ContentCard` removed from home and
      `DocsPage.tsx`; `ContentCardShape`/`ContentCardDensity` removed.
- [x] `ArtifactStage.tsx`: `frame: "none" | "instrument"`; home uses `"none"`.
- [x] `SiteHeader.tsx`, `HeaderChrome.tsx`: text links, icon-only theme
      toggle; `headerChromeSurfaceClassName` removed.
- [x] `test/worker/home.test.ts`: the rendered `canvas` role has no border,
      radius or box shadow in computed style. Verification of the de-carding
      itself is visual — screenshots at 1440 and 390 inspected in review — not
      a test that counts bordered ancestors or `shadow-*` classes; a
      structure-counting test pins today's markup and is exactly the kind of
      governance test this repository removed.

### Act 1 — The hero and the place

The hero and the demonstration are separate things and each is given its
own room: the hero says what Theoria is; the demonstration shows a place it
built. (The first draft of this act folded the hero into the arrival; that
was reversed — the page needs both.)

- [x] `HomePage.tsx`: glow layers removed; padding
      `max-w-[88rem] px-5 sm:px-8 lg:px-12`; header → hero → demonstration →
      footer, all on the canvas.
- [x] `HomeHero.tsx`: `h1` in the display role (`text-balance`, 44/50, 36/40
      below `sm`, 64/68 at `lg`); body as lead; one filled action
      (`Browse the packages`), one text action (`See how it's built`,
      `howItsBuiltActionLabel`) that scrolls to `#how-its-built`
      (`howItsBuiltSectionId`, the one id both the hero and the section
      use). The demonstration shares the first viewport with the hero, so an
      action pointing at it was a step to nowhere; the first draft's `See the
      place it built` was reversed.
- [x] `PlaceArrive.tsx`: the demonstration opens with its own title as an
      `h2` in the page-title role (`placeArriveTitle`, "The packages at work":
      this is a demonstration of the packages, not the place), then one lead
      statement of how it works (`placeArriveText`, naming the acts in order).
      The place's name is not repeated here: the composer named it, and the
      paper and the Compose card already carry it. (The first draft put the
      place's name here; that was reversed — it doubled the paper's heading.)
- [x] `ImaginedPlaceDemo.tsx` → `PlaceActs.tsx`:
      `lg:grid-cols-[minmax(24rem,1fr)_minmax(28rem,44rem)]` with the stage
      `sticky top-6` in the second column beside the arrival and the acts;
      below `lg` the arrival leads, the paper follows at full width, then the
      acts.
- [ ] `PlaceStage.tsx`: `placeStageWidthAtom` reads the content width;
      version knots rendered on the paper (Act 2, with the strand).
- [ ] Below `lg`, the stage pins as a band (`sticky top-0`,
      `max-h-[40vh] min-h-[12rem]`) that hides its prose via container query
      (Act 4, with `placeActAtom`).
- [x] `test/worker/home.test.ts` — _the hero and the place share the first
      viewport_: at 1440×900 the `h1`, its filled action, the place's title,
      the paper's top edge and a disc are inside the viewport before any
      scroll; at 390×844 the `h1`, both actions and the place's title are.

### Act 2 — Voices and lineage

- [x] `PlaceProposalCard.tsx` → `PlaceProposal.tsx`: `article` with
      `pl-4 border-l-2`; dashed neutral while declined, solid proposer tone
      while accepted; sealed note as a fold (Base UI `Collapsible`) that
      opens into a `blockquote`.
- [x] `PlaceProposals.tsx`: proposals anchored beside the prose line they
      would add (`placeViewModel.proposalAnchorLine` → `data-place-anchor-line`).
      The linkage is in the DOM only; drawing it (highlighting the line when
      the proposal is pointed at) is Act 4's provenance work.
- [x] `PlaceLineage.tsx` → `PlaceStrand.tsx`: strand and knots (`PlaceStrand`
      in the Record act, `StageKnots` on the pinned stage in place of the
      version badge); IDs in technical type; the wash on version change stays.
      The "Built from v1" line is gone: the strand's link is the parenthood.
- [x] `ToggleSwitch` on Base UI `Switch`; `ChoicePills` on `RadioGroup` with
      `appearance: "pill" | "segment"`; `TabBar` on `Tabs` (done on the
      toolchain branch).
- [x] `TabBar`: tabs as text on a hairline with the 2 px `Tabs.Indicator`;
      `ChoicePills` → `ChoiceGroup` rename; pills, segments and the brief's
      `TextAreaField` on the instrument tokens (`border-rule`, `bg-instrument`).
- [x] `test/worker/home-demo.test.ts` — _keyboard reaches every control_:
      scenario radio (arrows rebuild) → textarea → merge switch (Space) →
      tabs (arrows rove, Enter activates — Base UI 1.7 defaults
      `activateOnFocus` to false, which suits heavy code panels) → trace
      slider. _The neighbor's note is a fold, and a merged proposal stands
      beside its line of prose_ covers the fold and the anchor.

### Act 3 — Motion

- [x] `package.json`: `motion` 13.x; `App.tsx`: `MotionConfig
reducedMotion="user"` at the root (done on the toolchain branch).
- [x] `App.tsx`: `LazyMotion strict` (`domMax`, for layout animations) with
      the theme's transition; motion tokens are one contract,
      `contracts/motion.ts` (`MotionRelation` = enter | shift | exit as
      `Duration`s, one ease), generated into `styles.css` and handed to
      `MotionConfig` by `primitives/motion.ts`. Reduced motion is an atom,
      `atoms/motion.ts` `motionPreferenceAtom`, from the platform's
      `BrowserWindow.mediaQuery`, and drives `MotionConfig reducedMotion`.
- [x] `atoms/imagined-place-render.ts`: what the stage draws is one atom,
      `placeDrawnAtom` (`kept` | `sketch` | `trial`). The frame is
      `PlaceRenderFrame { search, rendering, paper }`: the paper's height is
      part of the drawing and travels with the discs (`PlaceDrawing
    { markers, paper }`, `drawingBetween`), so `placeSheetAtom` is the
      chosen width at once and the drawing's own height — `held` at the
      settled height while a search's trials run (a jump moves nothing
      around the stage, and the sticky stage column never shifts while the
      reader is near the end of the acts), following the discs once every
      trial is in, never less than the paper the arriving discs stand on
      (`paperUnder`). `PlaceSearch.settled` names what the last settled
      arrangement drew; `placeFeatureHomeAtom(name)` derives from the frame
      alone whether a feature is at home on the `stage` or in its
      `proposal`, and `placeDiscDrawnAtom(name)` (`settled` | `arriving` |
      `trial`) how its disc is drawn. `searching(search)` is the one
      predicate for running or landing (trace, caption, live values,
      `aria-busy`).
- [x] `contracts/demo/imagined-place-search.ts`, `web/place-search.worker.ts`,
      `web/platform/PlaceSearchWorker.ts`, `web/services/PlaceSearcher.ts`:
      the search's settings (`Meander`, `meanderSpace`, `renderSeed`,
      `renderTrials`, `renderSampler`) and its protocol (`OpenSearch`,
      `AskSearch`, `TellSearch`, `CloseSearch`) are one contract; the
      sampler runs in a worker (`@effect/platform` `Worker`; the platform
      module names its entry the standard way, `new Worker(new URL("…",
      import.meta.url), { type: "module" })`, which every bundler resolves
      at build time) and the page scores each proposed meander with its own
      text metrics, so the sampler's growing cost is off the drawing thread.
      `PlaceSearcher` is a service in `placeRenderRuntime`'s layer next to
      the text layout. A worker that closes or is reclaimed says nothing to
      the page, so every request is bounded (`answerWithin`, 3 s, far past
      any honest answer): past it, or on a worker error, the worker is
      forgotten and its scope closed, the render stream searches once more
      on the fresh worker the next `open` spawns, and only a second loss is
      a failed drawing with "Draw again".
- [x] `PlaceMarker.tsx`: the text and the discs are one arrangement and are
      always drawn from the same state, and no disc is ever a Motion layout
      node: the frames own every position. A feature just merged is a
      dashed ring in its proposer's tone while the search makes room for
      it; when the search settles, the disc fades in exactly where the ring
      stands as the ring fades out (`AnimatePresence propagate`, exit 120
      ms) — under reduced motion by opacity alone, with no scale written
      for Motion to cancel, so no transform is ever on the disc. A disc
      whose feature leaves the drawing fades where it stood. A
      trial's disc is a plain button, placed outright as the trace is
      scrubbed. Nothing flies across the prose: the earlier shared
      `layoutId` between the name and the disc drew the disc over the text
      on its way, and the rule is that text and discs never overlap.
- [x] `web/motion/travel.ts` and `atoms/imagined-place-render.ts`: the search
      moves in jumps (a better trial; a new artifact that places every disc
      anew) and the drawing does not. `Travelling<A>` is the Effect-native
      counterpart of a Motion layout animation for values Motion cannot
      animate because what they draw is computed: `toward` is a `Stream` of
      the value one per frame (`platform/AnimationFrame.ts` `frames`, Motion's
      frame loop) from where the drawing is to the target over the theme's
      `shift` with the theme's ease, landing on the target itself. The
      travel begins with the first frame drawn, not when the target is set,
      so a page busy while a merge arrives does not spend the travel unseen.
      A target set again continues; a new target starts from wherever the
      drawing is; reduced motion is a zero duration and places outright.
      The drawing arrives, and lands a frame later: the ring is committed
      exactly where the disc fills in before it is swapped for the disc,
      whether it travelled there or was placed there outright (placed
      outright, an exiting ring would otherwise be frozen at the previous
      best while the disc appeared at the new one). A
      `Journey` may owe a `rest`, counted from the first frame drawn: when
      the description changes, the drawing rests for the exit duration
      while the old lines leave, so lines flowed around where the discs
      were never stand over discs that have moved on — under reduced motion
      too, since Motion keeps the opacity fade. The drawing travels in
      marker space with the geometry's own rules kept at every step
      (`markersBetween`: straight lines, radii following, each marker pushed
      down to clear those before it, clamped to the stage; a merged feature
      grows in where it will stand), and every frame the prose is flowed
      around the discs as drawn (`arrangedAround`), so text and discs move
      together and never overlap. `PlaceSearch` changes once per trial and
      is the same instance through a travel's frames, so `placeSearchAtom`
      readers (trace, caption, code's live values) are not woken per frame.
      `get.self` carries the last drawing, its held paper, what had settled
      and its prose into the next search (`DrawingLeft`).
- [x] `atoms/syntax-highlighting.ts` `highlightedLinesAtom` (an `Atom.family`
      keyed by `CodeSource`) tokenises each source once instead of on every
      render of `HighlightedCode`.
- [x] `PlaceProposal.tsx`: the feature's name stays in its proposal; the
      proposal is marked `data-place-feature` so tests can find the feature
      whose room the search is making.
- [x] `PlaceStage.tsx`: the paper is a `ScrollArea` whose viewport, fade
      and scrollbar exist only while a sketch or a trial is drawn (Base UI
      measures overflow from the viewport's `scrollHeight`, which counts a
      disc still travelling in, and re-measures only on resize or scroll: a
      fade that outlived the kept state was stale, not true); the kept
      arrangement fits the sheet and is unclipped. The search has three
      phases: `running` (trials coming in; the paper is `held` so a jump
      moves nothing around the stage), `landing` (every trial in, the
      drawing travelling to the best; the paper is part of the drawing and
      travels with it, so it lands with the discs and a disc heading past
      the old edge is never cut), `complete`. `ArtifactStage` derives its
      clipping from the frame kind: `none` (the canvas) clips nothing.
      `AnimatePresence mode="wait"` on prose lines keyed by the frame's
      prose: replaced text fades through, never two texts at once
      (`popLayout` double-painted the crossfade); stagger 20 ms, arrival
      ≤ 300 ms, exit 120 ms. A line arrives by fading only, without the
      theme's 4 px rise: its place is the room the discs leave it, and
      rising from below would cross a disc's edge.
- [x] `test/worker/home-demo.test.ts` — _a merged feature fills the room the
      search made for it, never over the prose_: while the search runs the
      ring marks the room, the sheet holds its height and the paper is
      `sketch`; at every sampled frame of the hand-off — the ring still
      leaving as the disc arrives — both stand at one `translate`, the disc
      arrives at more than one transform, and at no sampled frame is a line
      of prose painted over any disc or ring (`platform/in-page.ts`
      `mergeFrame`: circle against every line's box, a line painted at its
      own opacity times its lines container's, so a set of lines that has
      finished leaving is not painted); _under reduced motion the feature is
      placed outright, never over the prose_: the same hand-off, one disc
      place, one transform, no overlaps. `test/web/travel.test.ts` covers
      the journey's rest, counted from the first frame drawn.
      `test/web/place-searcher.test.ts` gives the searcher a worker manager
      whose workers say nothing or fail: the request is given up on at the
      answer bound and named, the worker's scope is closed, and the next
      search spawns another.
      `test/contracts/motion.contract.test.ts` pins the tokens.
- [x] `atoms/imagined-place-render.ts`: before the artifact arrives the render
      stream is `Stream.never`, not `Stream.empty` — effect-atom turns a
      stream that ends without a value into a failure, which drew "The place
      could not be drawn" at first paint. A build on its way is waiting, not
      failed. `StageBanner` carries `data-stage-banner={tone}` so tests can
      count error banners frame by frame (`errorBannersUntilRendered`).
- [x] `contracts/demo/imagined-place-flow.ts` `paperExpected`,
      `atoms/imagined-place-render.ts` `placeExpectedPaperAtom`,
      `PlaceStage.tsx` `BlankPaper`, `PlaceSearchTrace.tsx`
      `PlaceSearchTracePending`, `services/PlaceSearcher.ts`: the stage is
      cut to size the moment the artifact is known and nothing around it
      moves until the drawing lands. `paperExpected` is the prose flowed with
      nothing in its way plus the lines the discs take out of the column,
      whole lines, from the same prepared text the drawing flows; it runs a
      line or two short by design, so the paper grows with the discs at
      landing rather than shrinking. `placeSheetAtom` is the expected paper
      until there is a frame; the first frame holds it (`held`) through
      `running`; `landing` travels to the true paper. `BlankPaper` is the
      paper-shaped skeleton (shimmer rows at the stage's own padding and line
      height) drawn while the sheet is known and the frame is not;
      `PlaceSearchTracePending` reserves the trace's and the caption's rows
      (`traceHeightClassName`) so the first frame moves nothing below the
      paper either. The searcher spawns its first worker when the runtime
      builds, not at the first search, so the worker boots while the build
      is fetched and the text measured: first frame ~780 ms from navigation
      in a production build, from ~1000 ms. Before the artifact only the
      width is known, so the placeholder stays small; that one change of
      size is accepted.
- [x] `test/worker/home-demo.test.ts` — the first test installs
      `recordPaperFrames` (`platform/in-page.ts`: a `MutationObserver` over
      the paper's `data-place-stage-height` and the trace's
      `data-place-render-phase`, installed as an init script so no state is
      lost to a round trip and the navigation cannot interrupt it) and
      asserts that a paper exists before the first trial is in and that every
      recorded height until `landing` is one height.
      `test/contracts/imagined-place-flow.contract.test.ts` pins
      `paperExpected`: whole lines, the prose alone with no features, more
      for every feature.

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
bun run check:all && bun run lint && bun run test && bun run build
bun run check:apps && bun run test:apps && bun run --filter @theoria/theoria-app test:worker
```

and a visitor at 390×844 with reduced motion on sees the place, a disc and the
version before scrolling, can merge a proposal from the keyboard and watch the
prose change, and can ask any mark on the page how it knows.
