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

Measured in Chromium at 1440×900, light theme, every element under `main`.
_Before_ is the card page this plan replaces; _after Act 4_ is the branch at
`4bb60e4` with the overlay closed; _target_ is what Act 5 must reach.

| Measure                               | Before | After Act 4 | After Act 5 | Target |
| ------------------------------------- | ------ | ----------- | ----------- | ------ |
| Elements                              | 643    | 686         | 695         | —      |
| With a visible border                 | 59     | 28          | 23          | —      |
| With a border radius                  | 124    | 154         | 154         | —      |
| Pill-shaped (`border-radius ≥ 999px`) | 74     | 69          | 69          | —      |
| With a box shadow                     | 19     | 11          | 8           | —      |
| Deepest bordered-ancestor chain       | 5      | 4           | 3           | —      |
| Enclosures > 24 px                    | —      | —           | 6           | ≤ 10   |
| Drop shadows                          | —      | —           | 2           | ≤ 4    |
| Deepest enclosure chain               | —      | —           | 1           | ≤ 2    |

The final three measures read computed paint: state marks ≤ 24 px and
single-edge rules are excluded on purpose.

What remains bordered or shadowed after Act 4: the five marker chips
(`shadow-chip` with an inset ring), the two status marks, the code section
(`rounded-[1.35rem] border shadow-chip` — the one instrument surface), the two
content-ID chips, the switch thumb, the spine dots and the strand knots. The
spine dots, knots, proposer rules and the switch are borders that say state or
ownership and stay; the chips and the code section's shadow are the Act 5
work. After Act 5 the marker chips, the annotation rows, the code section and
the Copy control have no shadow; the only drop shadows left are the two switch
thumbs, and the six enclosures are the brief field, the code section, the
checked story and width pills, and the two switches.

Before, the depth-5 chains were page → demo card → proposal card → sealed-note box →
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

### One palette across the stories

The three scenarios are three places, not three pages. Choosing another
changes the drawing — the title, the prose, the discs, the walk — and nothing
of the page around it: the canvas, the paper and the rule down the acts'
spine are the stage's own greys in every story and in both themes. An
earlier draft tinted the page per story ("the world has weather"); it was
taken out because a page that recolours under the visitor reads as a theme
change, not a story change, and the drawing already says which place this is.
The only colour that varies on the page is the participants' tones.

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
main (canvas; the stage's own greys in every story)
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

The experience layer is two atoms beside the existing ones, all pure
derivations or explicit effects:

- `placeActAtom`: `"arrive" | "compose" | "propose" | "record" | "build"`, a
  projection of where the reading line (half the viewport) stands among the
  act landmarks, re-read on every scroll, resize and hash change — so a jump
  from below the viewport to above it, which no observer entry reports, still
  answers. Read by the stage.
- `placeFocusAtom`: `Option<PlaceProvenance>`, a tagged union
  (`Feature | Line | Signature | Version | Trial | CodeLine`) written by
  hover and focus handlers, read by every surface that can answer.

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
      radius or box shadow in computed style. Act 5 measures computed paint —
      enclosures and drop shadows, not markup or class names — in
      `test/worker/home-surfaces.test.ts`.

### Act 1 — The hero and the place

The hero and the demonstration are separate things and each is given its
own room: the hero says what Theoria is; the demonstration shows a place it
built. (The first draft of this act folded the hero into the arrival; that
was reversed — the page needs both.)

- Typography metrics live in `contracts/text.ts`; generated CSS carries the
  responsive tokens and complete safelist, while `stage-prose` stays 16/26 at
  every viewport to match the projected paper geometry.

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
- [x] `ImaginedPlaceDemo.tsx` → `PlaceActs.tsx`: the arrival leads the
      demonstration at full width; under it,
      `lg:grid-cols-[minmax(24rem,1fr)_minmax(28rem,44rem)]` with the acts in
      the first column and the stage `sticky top-6` in the second, so Compose
      and Arrange start on one line and the first scroll reads down both
      columns; below `lg` the arrival leads, the paper follows at full width,
      then the acts. (The first draft set the arrival beside the stage in the
      grid's first row; Arrange then began a paragraph above Compose.)
- [x] `PlaceStepCard.tsx`: the spine's dot is in the header's grid row and
      centred on it, level with the step's name; the dot is positioned so it
      paints over the spine's rule (`PlaceActs.tsx`, `left-[calc(0.375rem-0.5px)]`,
      the centre of the `w-3` dot column), so an open ring is open. The name
      and its packages are `items-center`.
- [x] `PlaceComposition.tsx` reads down: the scenarios, the title the composer
      gave the chosen one, the brief that scenario gives the composer
      (`PlaceControls.tsx` → `ScenarioChoice` and `BriefField`), then the
      features under a `Features` label beside the recorded-inference status.
- [x] One wash for what is lit: `designSystem.ts` `markClassName`,
      `litMarkClassName` (the mark's own box) and `litChipClassName` (a chip set
      inside a mark, on the chip's box) — the same `stage-100/80` under the
      pointer, while answered, and while a popup is open, on a feature's name,
      a line of the prose, a code line's number, a value under a line of code,
      and a step's name. `Elevation` (`contracts/layout.ts`) orders what stands
      over the page: band under answer under preview, so a docs preview opened
      from an answer stands over it.
- [ ] `PlaceStage.tsx`: `placeStageWidthAtom` reads the content width;
      version knots rendered on the paper (Act 2, with the strand).
- [x] Below `lg` — and at `lg` once the full-width Build act scrolls the
      pinned stage away — the place stays as a band: `PlaceBand.tsx`, a
      `sticky top-0` slot of no height at the head of the demonstration, so
      the band coming and going moves nothing in the flow; the band is a
      legend-sized strip — a pill one line of text tall — with the discs in a
      row in their stage proportions (`bandRow`, a viewBox drawn at `h-5`), no
      prose, and an arrow up: one link back to the stage; shown by
      `placeBandAtom`, derived from the stage column crossing the viewport's
      top edge (Act 4). (The first draft drew the row at stage size; at 390 it
      was a sheet, not a strip.)
- [x] `test/worker/home.test.ts` — _the hero and the place share the first
      viewport_: at 1440×900 the `h1`, its filled action, the arrival's title
      and lead, and the Compose and Arrange headers are inside the viewport
      before any scroll; at 390×844 the `h1`, both actions and the arrival's
      title are. `test/worker/home-form.test.ts` measures the form: dots
      centred on the spine and over it, names level with their packages, one
      wash on everything lit, the preview over the answer, the band's height
      and its arrow, the arrival over both columns, the Compose act's order.

### Act 2 — Voices and lineage

- [x] `PlaceProposalCard.tsx` → `PlaceProposal.tsx`: `article` with
      `pl-4 border-l-2`; dashed neutral while declined, solid proposer tone
      while accepted; sealed note as a fold (Base UI `Collapsible`) that
      opens into a `blockquote`.
- [x] `PlaceProposals.tsx`: proposals anchored beside the prose line they
      would add (`placeViewModel.proposalAnchorLine` → `data-place-anchor-line`,
      from `placeProposalLineAtom`, the drawing shown this instant). The
      linkage is drawn by Act 4: pointing at a merged proposal's feature
      lights that line on the stage (`placeFocusedLineAtom`); the attribute is
      the same fact said in the DOM, which the tests read back.
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
- [x] `App.tsx`: `LazyMotion strict` (`domAnimation`; the drawing travels by
      its own measured positions, so nothing animates layout) with the
      theme's transition; motion tokens are one contract,
      `contracts/motion.ts` (`MotionRelation` = enter | shift | exit as
      `Duration`s, one ease), generated into `styles.css` and handed to
      `MotionConfig` by `primitives/motion.ts`. Reduced motion is an atom,
      `atoms/motion.ts` `motionPreferenceAtom`, from the platform's
      `BrowserWindow.mediaQuery`, and drives `MotionConfig reducedMotion`.
- [x] `atoms/imagined-place-render.ts`: what the stage draws is one atom,
      `placeDrawnAtom` (`kept` | `sketch` | `trial`). The frame is
      `PlaceRenderFrame { search, rendering, paper, trial }`: `trial` is the
      trial the rendering is drawn from, so a disc's answer can name it, and
      say `Toward trial N` while the drawing is still on its way there; the
      paper's height is
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
      any honest answer) and so is the worker's boot (`bootWithin`, 10 s,
      inside `spawn`, so a script that never reports ready cannot hold the
      searcher): past either, or on a worker error, the worker is forgotten
      and its scope closed, the render stream searches once more on the
      fresh worker the next `open` spawns, and only a second loss is a
      failed drawing with "Draw again". Opening a search is one
      uninterruptible step around the request and its finalizer; an open
      interrupted between them forgets the worker, so nothing is left
      allocated in it without an owner.
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

### Act 4 — Acts and provenance

- [x] Code-line marks carry one canonical `CodeSiteId`; `codeSite(id)` is the
      total source for the site's step, line-locating match and package.
- [x] `placeGoToSiteAtom`: the answer's credited line is a route, not a hash.
      It selects the line's step, lets the answer go where it is (focus does
      not return to the mark), enters `#how-its-built` through
      `navigateToElementAtom`, and after the step renders centres and focuses
      the line's gutter mark (`data-place-code-site`) — smooth or instant by
      `scrollBehaviorFor(motionPreference)`. Tested on a registry with the
      window (sequence, manner per preference, focus) and in Chromium by
      pointer, by keyboard (`:focus-visible` on the landing) and under reduced
      motion.
- [x] `stillUnderReducedMotion` (`designSystem.ts`): the one CSS-side rule for
      things that travel by transition — switch thumb, tab indicator, drawer,
      search dialog, package menu, navigation folds — since Motion's
      configuration does not reach CSS. Chromium checks the thumb's computed
      `transition-duration` is `0.15s` and `0s` by preference.
- [x] `atoms/imagined-place-experience.ts`: `placeActAtom`, `placeFocusAtom`,
      `placeBandAtom`; `contracts/demo/imagined-place-provenance.ts`:
      `PlaceMark`, `PlaceProvenance`, `PlaceAct`; `view/home/placeProvenance.ts`:
      `provenanceFor` over `PlaceBuild` and the search. Focus is a mark; the
      answer is derived.
- [x] `PlaceStage.tsx`: act answers (ghost discs in Propose, version
      distinction in Record); `PlaceProvenance.tsx`: one overlay that renders
      any `PlaceProvenance`; disc popovers, ID tooltips and status pills fold
      into it.
- [x] `PlaceHowItsBuilt.tsx`: the value beside each line that produced
      something carries `data-provenance` for that line; pointing at it
      writes `placeFocusAtom`; a focused mark highlights its line, and a
      focused line lights every disc it made, on the stage and in the band.
      The line's number in the gutter is the line's own mark
      (`codeSiteOnLine` in `contracts/demo/imagined-place-provenance.ts`,
      `renderLineNumber` on `HighlightedCode`): `Line N`, carrying the site
      the line is, so the code is a trigger without a control around its
      links — a trigger around the line took the link's press so its preview
      never opened (tried, measured, reverted). The gutter is not shown below
      `sm`, where the annotation beside the line is the same mark.
- [x] Focus is bidirectional through one atom, `placeMarkFocusedAtom(mark)`,
      read by every `ProvenanceMark` and said as `data-place-focused`: a
      feature lights its disc, its name in the composition and its
      proposal's title; a line lights on the stage when pointed at, when the
      code that set it is pointed at, or when the merged proposal whose
      sentence stands on it is pointed at (`placeFocusedLineAtom`, from
      `proposalAnchorLine` on the drawing shown this instant); a content ID
      or signature lights wherever it is said.
- [x] `PlaceStage.tsx`: the lines of the prose are one stop in the tab order,
      a vertical Base UI `Toolbar` — arrows move between lines, Enter opens
      the line's answer — so every line's facts have a keyboard route; the
      answers are read from `placeShownFrameAtom`, the drawing on the stage
      this instant, not the search's best, so a hovered line's width and
      count agree with what is visible, and a disc's answer names the trial
      it is drawn from.
- [x] `styles.css`: the canvas, the paper and the spine's rule are the stage's
      own greys in every story; the prose on the paper is contrast-checked
      per story per theme against rendered colours in `test/worker/home-demo.test.ts`.
- [x] `test/worker/home-demo.test.ts` — _every mark answers_: for each
      `[data-provenance]` in the demonstration, hover shows an overlay naming
      a package; each annotation's answer names its own title and package
      (`Statistics.minimum(` → effect-math, `Study.tell(` → effect-search,
      `Text.layoutLinesWith(` → effect-text); a code line lights its discs;
      the lines answer from the keyboard. _The acts answer on the
      stage_: scrolling to Propose changes `data-place-stage-act` and shows a
      ghost. _Choosing another story changes the drawing and nothing of the
      page_: after the story is taken and the discs are at rest, the computed
      canvas colour, the paper's paint and the title's ink are what they were,
      and the prose on the paper reads at ≥ 4.5:1 in every story and mode. _The band_: past the stage at 390 the band shows one disc per
      marker and nothing in the flow moves; at 1280 it appears only for the
      Build act, and a code line lights its discs there.
- [x] Hover intent is owned by the app: pointer handlers write
      `placePointerOverAtom`, one latest-wins timed intent stream writes
      `placeAnswerAtom`, and that answer controls the shared Base UI root and
      its explicit active trigger. Unmounting an unrelated detached trigger
      therefore cannot cancel another mark's pending answer.
- [x] Every answer is read from its own source. `PlaceSearch.source` is the
      build a drawing is of, so the stage keeps its story while the next is
      built and nothing reads across (`placeArtifactAtom` is gone; the
      render stream takes the build). A disc on the paper is a `Disc { name,
source }`, a line of the prose a `Line { index, drawing }`, a trial a
      `Trial { index, drawing }` (`DrawingId = { source, stageWidth }`,
      compared by `sameDrawing`); a `Feature` in the column is of the build
      the column describes, and tells where it stands only if the paper is
      drawing that same build. `PlaceProvenance.about` names the features an
      answer is about, read from the answer's own source, so
      `placeFeatureFocusedAtom` lights nothing of another build. An answer
      lives as long as the page can answer it: `placeAnswerLifetimeAtom` lets
      it go when its drawing is replaced and leaves focus where it is
      (`AnswerFocusReturn`); a pressed answer dismissed by hand still returns
      focus to its mark. `PlaceEvidence.lineage` is non-empty by schema, so
      the current version is total. Checked in `test/web/place-provenance.test.ts`
      (_answers from the drawing's own source_), `test/atoms/place-answer.contract.test.ts`
      (_answer lifetime_) and `test/worker/home-demo.test.ts` (_an answer
      opened on the drawing survives the next story's build and closes with
      its drawing_).

### Act 5 — Responsive and environmental verification

- [x] 320, 390, 768, 1024, 1280, 1440, 1920 × light and dark × three stories:
      no element overflows, checked by _at W×H every story fits in light and
      dark, and … leads the first viewport_ in `home-environment.test.ts`. What
      leads the first viewport is a rule the test states, not a hope: below
      640 px tall (320×568) the hero owns the screen — title, lead and both
      actions wholly in view, "See how it's built" pointing down — and the
      arrival is a scroll away; from 640 px tall the arrival's title is in
      view; at `lg` (1024 px wide) and above both Compose and Arrange headers
      stand beside it; below `lg` the columns stack with Arrange first, above
      the paper, and that header is in view. The hero's lead and trail keep
      their `clamp(…, svh, …)` rhythm at every height; a `max-height` step that
      cut them to nothing bought 4 px of the arrival at 320×568 for a 38 px
      jump at 576 px, so it was not kept. What made room at 320×568 is the
      display role: its narrow metrics are fluid, `clamp(32px, 10vw, 36px)`
      over `clamp(36px, 11.25vw, 40px)`, so the five-line title stands 180 px
      at 320 and 200 px from 360, at one ratio, with no width where it steps
      (`text.ts`, held by the typography contract test).
- [x] 200 % zoom at 1280: no horizontal scroll; the display title wraps to
      ≤ 3 lines; the pinned band never covers the focused control. _The 200
      percent reflow equivalent fits and focus clears the pinned band_ uses a
      640×360 viewport, the faithful reflow equivalent of 1280×720 at 200 %;
      Playwright has no browser-zoom API and CSS zoom does not change layout
      viewport or media queries.
- [x] Forced colors: proposer rule, switch state, tab indicator and strand
      knots stay visible without background colour. `home-forced-colors.test.ts`
      checks every state in light and dark with Canvas, CanvasText, Highlight
      and HighlightText system colours. Focus has one authority:
      `focusEdgeClassName` drops the outline and restores a solid `Highlight`
      one under forced colours; `focus-edge.contract.test.ts` holds that no
      other class string writes `outline-none`.
- [x] Reduced motion: the search still renders per frame (it is a real
      process), merges and version changes are opacity only, nothing else
      moves. Checked by _under reduced motion the search still has frames, and
      merges and story changes move only by opacity_ in
      `home-environment.test.ts`: every retained element — title, step headers,
      paper, each disc by name — is sampled each frame and may stand only where
      it stood before or where it stands after, and no running animation names
      a property outside opacity and colour.
- [x] The measurement above reaches its targets: the marker chips and content-ID
      chips lose `shadow-chip` and stand by their ring and wash; the code
      section loses its shadow and keeps its rule; ≤ 10 bordered, ≤ 4 shadowed,
      bordered chain ≤ 2 at 1440 with the overlay closed. A worker test measures
      it so the counts cannot drift back: _the home page keeps its painted
      surfaces within the de-carding budget_.
- [x] The first viewport at 1440×900 shows the paper's top and the first disc,
      not only the two column headers: the hero's vertical spacing is cut so
      the place is seen before any scroll, as `Done when` says. (Act 4 re-stated
      the claim to the headers when the form work moved the arrival above the
      grid; the plan's intent stands.) Checked in _the hero and the place share
      the first viewport_.
- [x] 320: the paper is ≥ 240 px wide; the story chooser wraps or scroll-snaps,
      never overflows. Checked in _at 320 the paper and story chooser fit the viewport_.
- [ ] `Done when` is run as a test: at 390×844 with reduced motion, the place,
      a disc and the version are visible before scrolling; a proposal is merged
      from the keyboard and the prose changes; every mark answers from the
      keyboard. Done so far: the merge and answers are checked in _at 390
      reduced motion a keyboard merge changes the prose and every marker
      answers_, and the paper's top before scrolling in _the hero and the place
      share the first viewport_. Open: a disc is another 143 px down in the
      hero → arrival → column header → paper order, and the version depends on
      Act 6's **Version knots on the paper** decision; the item closes when
      both are in the first viewport and the test says so.

### Act 6 — Deferred from the reviews and the build

Not in the plan's original acts; each was raised while building Acts 0–4 and
left on purpose. Every item takes the same route: failing test, then the change.

- [ ] **Version knots on the paper** (Act 2's open box). `PlaceStrand` draws
      knots beside the pinned stage; the plan has them on the paper's edge at
      the stage's width from `placeStageWidthAtom`. Decide once against the
      rendered stage whether the strand beside the stage already says lineage
      well enough; if it does, tick the box and record why.
- [x] **Canonical `CodeSite` identities.** A code-line mark is
      `{ _tag: "CodeLine", site: CodeSiteId }`; `CodeSiteId` is the closed
      `Schema.Literal` of sites, `codeSite(id)` the total lookup, and
      `allCodeSites` is derived from the literals. `markMadeBy` matches
      exhaustively on the id; `match` is the site's line-locating data, not
      its identity. No brand: a closed literal set is already one identity per
      site, and the contract test checks each resolves to one line of its
      step's code.
- [ ] **The CSS animations the toolchain branch left for this work.**
      `animate-path-draw` (`PlaceWalk`) and `animate-value-changed`
      (`ChangedValue`) are still CSS keyframes beside Motion. Either move them
      to Motion under `MotionConfig reducedMotion="user"` so one system owns
      presence, or record why a CSS keyframe is the honest tool for each.
- [x] **Per-trial render cost.** Measured on the production build
      (`vite preview` of `dist/`, Chromium, `PerformanceObserver` on
      `long-animation-frame` and `event`, one story change): 36 trials arrive
      ≈40 ms apart (the deliberate 28 ms `frameDelay` plus the worker's own
      time), 3 long animation frames in the whole search (73 ms of blocking in
      total), and no interaction ≥16 ms. The development cost was Vite's
      unminified React; per-trial coalescing is not needed and was not added.
      The same profile found the real delay: the whole request was debounced
      400 ms, so a story or a merge clicked waited 400 ms before the build
      began. Now only the typed brief settles (`placeBriefDraftAtom` →
      `settledBriefDraftAtom`); a story or merge chosen is built at once
      (`placeBuildRequestAtom`, `test/atoms/place-build-request.test.ts`).
- [ ] **The edited-brief status line.** `PlaceComposition` says "The recording
      answers the original brief; your edited brief is what version 1 signs."
      once the brief is edited. Decide whether this is the field's description
      (then it belongs to `FieldDescription`, present from the start, in fewer
      words) or a state the page should show another way.
- [x] **Dark theme and forced colors across every state.** Every state the
      light checks cover — answers open, band shown, Build act lit, a search
      running, a story changing — checked in dark and in `forced-colors`;
      contrast asserted from rendered colours as `home-demo.test.ts` does for
      the prose. The dark half is complete in _light and dark keep every
      interactive state readable_ (`home-environment.test.ts`), which takes the
      lowest ratio over every visible element holding its own words within the
      answer, the band's link, the lit line and the search's caption, so a
      muted secondary line cannot hide behind a readable heading. Forced
      colours now covers focus edges, switch state, tab indicator, strand
      knots, discs, lit code wash and solid/dashed proposer rules in both
      colour schemes (`home-forced-colors.test.ts`).
- [ ] **Web vitals on the preview.** No LCP, CLS or INP budget was set. Measure
      on `theoria-pr-<N>.staging.scenesystems.io` and record: LCP ≤ 2.5 s, CLS
      ≤ 0.1 (the skeleton exists for this; prove it), INP ≤ 200 ms while a
      search runs, and the size of the homepage's JavaScript. Set the budgets
      in the doc and, where the toolchain allows, in CI.
- [ ] **Stale comments.** One sweep of `view/home/` and `atoms/` for comments
      that describe the layout animations, the world tones, or the card page
      that no longer exist.
- [ ] **A third review** of the form work (`b8a56b6` onward) by the Oracle,
      once Act 5 lands, with the same must/should/nice discipline as the first
      two.

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
