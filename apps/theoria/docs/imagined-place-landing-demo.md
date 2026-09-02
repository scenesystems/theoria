# Imagined Place: the integrated demo that replaces the Theoria home-page catalog

Status: first implementation built and awaiting review. The server pipeline
(`apps/theoria/app/server/imagined-place/`) and the page
(`apps/theoria/app/web/view/home/`) are both in place; `/` renders this demo and
`/docs` is the package catalog. The "UI implementation plan" below records what
was planned; "What was built" records where the build diverged from it.

## What the demo has to do

Three things at once, and nothing else:

1. Show what Theoria is _for_. One artifact a visitor cares about, produced by
   the packages working together, with a few controls that change it.
2. Explain every package by giving each one a visible job, so the code panel
   and the docs read as the same story.
3. Stay honest and public. No claim the code does not earn; no Scene internals.
   The words are the public ones: create, enter, contribute, merge, lineage,
   authorship, attribution, shared reality.

The documentation practice we surveyed points the same way. Diátaxis tutorials
take the learner through one meaningful project where every step shows a
result. MDN live samples and Effect doctests only show code that ran. The
example-first library sites (Observable Plot, D3, TensorFlow Playground,
scikit-learn's gallery) open on a consequential artifact with a few controls and
keep the API one click behind it.

## The story: one place, three participants, three moves

You describe a place. A model program gives it shape. A neighbor and a second
program each propose something. You accept what you want. What you accepted is
now part of the place, credited to whoever proposed it; what you declined is
still there for anyone to see. The place keeps its history, and everyone's
contribution carries their signature. Then the place is drawn so that its own
description flows around what it contains.

That is the public-safe core of "turn imagination into shared reality":
imagine → others contribute → explicit merge → visible lineage and attribution
→ render. People and programs are both participants; learning, inference and
verification are the substrate, not the promise.

| Move    | Package(s)           | What it does in the demo                                                                                 | Visible result                                   |
| ------- | -------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Imagine | effect-dsp           | `Signature.make` + `Module.predict("theoria-place-composer")`: brief → schema-checked `PlaceComposition` | Title, summary, atmosphere, 4 weighted features  |
| Imagine | effect-inference     | `RuntimeResolver` + `makeRuntimeEvidence`: which model answered, how, and why                            | "recorded · recorded/listening-garden · local"   |
| Propose | effect-dsp           | A second program, `theoria-place-proposer`, reads the composition and offers one feature with rationale  | The program's proposal card                      |
| Propose | seal + sign + digest | Neighbor's note: X25519 agreement → HKDF-SHA256 → XChaCha20-Poly1305, opened only by the author          | "Sealed to you · 122-byte envelope" + the text   |
| Merge   | digest               | `digestSchemaValue` over the canonical artifact; version 2 digests version 1's ID as `parent`            | Two content IDs, an arrow between them           |
| Merge   | sign                 | Ed25519: each proposal signed by its proposer; each version signed by the author; all verified           | "valid for session key ff91…" on every row       |
| Render  | effect-search        | Seeded TPE over a 6-parameter meander that places the markers                                            | Markers move when the viewport changes           |
| Render  | effect-text          | `layoutLinesWith`: the description wraps to a per-line width that stops left of intruding markers        | Text visibly narrows beside each marker          |
| Render  | effect-math          | Pairwise Euclidean distance, minimum, standard deviation of line widths                                  | min separation, raggedness in the evidence strip |
| All     | effect               | One `Effect.gen` pipeline, typed `PlaceBuildError` by stage, concurrency where the steps are independent | Built in ~1.2 s                                  |

## What the visitor sees

One stage, one control column, three numbered moves down the control column.
Evidence is always visible in a thin strip; the full evidence and code are one
toggle away.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Theoria                                                        Docs  GitHub  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Scientific computing and model programming with Effect                       │
│ Imagine a place. Let a neighbor and a program add to it. Keep every          │
│ contribution credited and every version traceable. Then draw it.             │
├──────────────────────────┬───────────────────────────────────────────────────┤
│ 1  IMAGINE               │  THE LISTENING GARDEN          Recorded inference │
│ Place    [Listening ▾]   │                                                   │
│ Brief                    │  A night garden shaped for telling,    ◉ Story    │
│ ┌──────────────────────┐ │  listening, and returning at your        canopy   │
│ │ A moonlit garden     │ │  own pace. Low lanterns hang in the               │
│ │ where neighbors ...  │ │  canopy; gravel paths bend around a  ○ Exchange   │
│ └──────────────────────┘ │  still pool that holds the moon.         shelf    │
│                          │  Story canopy: A ring of benches under broad      │
│ 2  PROPOSE · MERGE       │  leaves where stories are read aloud.   ◉ Listen- │
│ ┌ neighbor ────────────┐ │  Exchange shelf: A weatherproof shelf     ing     │
│ │ Open seat            │ │  where one-page stories are left and     pool     │
│ │ "One place at the    │ │  taken. Listening pool: Still water that          │
│ │ canopy left empty…"  │ │  gives a pause without ending the    ○ Quiet path │
│ │ ed25519 valid  [●  ] │ │  exchange. Quiet path: A dim, unhurried           │
│ │ 🔒 note sealed to you│ │  route that leads anyone back to    ○ Open seat   │
│ └──────────────────────┘ │  the gate. Open seat: One place at    ↑ neighbor  │
│ ┌ program ─────────────┐ │  the canopy left deliberately empty for whoever   │
│ │ Lantern keeper's     │ │  arrives next.                                    │
│ │ stool  ed25519 valid │ ├───────────────────────────────────────────────────┤
│ │ declined       [  ●] │ │ v1 2RYS6TSs… ──▶ v2 lhXNQhpW…   author signed ✓   │
│ └──────────────────────┘ │ tpe·36 trials · min sep 0.09 · 14 lines · 1.2 s  │
│                          │ [ Inspect evidence ]  [ Show code ]               │
│ 3  RENDER                │                                                   │
│ Viewport [────●────] 1100│                                                   │
└──────────────────────────┴───────────────────────────────────────────────────┘
```

The stage is the description of the place, set as running text, with the
features as circular markers down a meander on the right. Marker radius follows
the feature's weight. Markers that came from an accepted proposal carry the
proposer's name. The text is real: every line's width is what `effect-text`
measured, and it narrows where a marker intrudes.

### Move 1: Imagine

Controls: `Place` (three recorded patterns: Listening garden, Tidal workshop,
Story commons), `Brief` (editable, ≤280 characters).

`compose.ts` builds a typed program whose output fields _are_ the
`PlaceComposition` fields, so the artifact contract and the program contract
cannot drift. The model reply is a recorded fixture replayed through
`InferenceTesting.staticLanguageModel`, still parsed and schema-checked by the
real predict path. Inference evidence is produced by the real resolver path
(`staticRuntimeResolver` → `RuntimeResolver.resolve` → `makeRuntimeEvidence`),
so the page can say exactly what it did: `recorded · recorded/listening-garden ·
local-runtime · recorded-fixture`.

Honesty label on the stage: "Recorded inference. The composition was captured
for this pattern's original brief. Your edited brief is still part of the
signed place." Editing the brief changes both content IDs and all the author's
signatures, and nothing else.

### Move 2: Propose and merge

Controls: two toggles, `Accept` on the neighbor's card and on the program's
card. Default: neighbor accepted, program declined, so the first screen shows
both outcomes.

Two proposals arrive. The neighbor's is a fixture (a person typed it); the
program's comes from `theoria-place-proposer`, which was shown the composition
and asked for one missing feature with a rationale. Each proposal is digested
(`digestSchemaValue(Proposal)`) and signed by _its own_ participant's Ed25519
session key. The neighbor also sends a note sealed to the author: both derive
the same key from an X25519 agreement through HKDF-SHA256 with the context
string `theoria/imagined-place/sealed-note/v1`, and the author's key opens it.
The client gets the opened text only because the author opened it; the sealing
key never leaves the server.

Accepting a proposal produces version 2: the origin plus `parent: originId` and
the accepted proposals. Because `parent` is inside the digested value, version
2's ID commits to version 1's, and the lineage strip shows the chain. Declining
both leaves a single version. Declined proposals stay listed with their content
IDs and signatures: nothing is erased, only not merged.

Honesty label on every signature: "valid for session key ff91…". A signature
proves possession of the key that signed, not who a person is. Keys are
generated per server process; the page says "session key", never "identity".

### Move 3: Render

Control: `Viewport` slider (320–1600 px). Stage width is
clamp(0.6 × viewport, 280, 900).

`render.ts` writes the description as one text (summary, atmosphere, then
"Name: description" for every feature including accepted ones), then asks
`effect-search` (TPE, seed 42, 36 trials) for a six-number meander: where the
marker column sits (`edge`), how far it swings (`swing`), its `phase` and
`turns`, where it starts (`top`) and the spacing between markers (`step`). For
each candidate, `effect-text` flows the text with a per-line width resolver that
stops the line left of any marker it would hit, and the loss adds up crowding
(pairs of markers closer than their radii), off-canvas markers, squeezed lines
(narrower than 40% of the column), overflow, raggedness (`effect-math`
`standardDeviation` of line widths) and compactness (occupied height over width).
The stage height is the occupied height of the best arrangement.

Moving the slider reflows the text and moves the markers; the lineage strip
reads "Presentation changed, meaning didn't: same content IDs." That line is
tested: viewport 1100 → 420 changes 14 lines to 25 and leaves every content ID
alone.

## What actually ran

`bun apps/theoria/scripts/imagined-place-walkthrough.ts` (abridged; IDs vary
per process because session keys do, content IDs do not):

```
1. IMAGINE  (effect-dsp · effect-inference)
   program     theoria-place-composer   recorded · recorded/listening-garden · local-runtime
   program     theoria-place-proposer   recorded · recorded/listening-garden · local-runtime
   title       The Listening Garden
   feature     Story canopy       weight 0.90
   feature     Exchange shelf     weight 0.60
   feature     Listening pool     weight 0.70
   feature     Quiet path         weight 0.40

2. PROPOSE AND MERGE  (digest · sign · seal)
   proposal    neighbor  "Open seat"  accepted  id PRrbydhbQB…  ed25519 valid for session key a07cfe0f664cb568
   proposal    program   "Lantern keeper's stool"  declined  id ROhU34oy4k…  ed25519 valid for session key 73a68c9826ddc18d
   version 1   2RYS6TSsnr…  4 features  (origin)
   version 2   lhXNQhpWQV…  5 features  parent 2RYS6TSsnr…
   signature   author    over 2RYS6TSsnr…  valid for session key 6d8f1dc54369fb67
   signature   author    over lhXNQhpWQV…  valid for session key 6d8f1dc54369fb67
   signature   neighbor  over PRrbydhbQB…  valid for session key a07cfe0f664cb568
   signature   program   over ROhU34oy4k…  valid for session key 73a68c9826ddc18d
   sealed note neighbor → author: x25519 + hkdf-sha256 → xchacha20-poly1305, 122 byte envelope
               opened by author: "I left a story on the shelf for you. It is about the gate, and it is not finished."

3. RENDER  (effect-search · effect-text · effect-math)
   search      tpe seed 42, 36 trials, best loss 1.898, min separation 0.092
   stage       660px × 345px for a 1100px viewport; 14 lines, narrowest 0.50 of column, raggedness 0.12
   marker      Story canopy             (386px,  72px) r 47px
   marker      Exchange shelf           (482px, 127px) r 40px
   marker      Listening pool           (580px, 181px) r 43px
   marker      Quiet path               (553px, 236px) r 36px
   marker      Open seat                (437px, 291px) r 38px  from neighbor
    313px | A night garden shaped for telling,
    313px | listening, and returning at your
    416px | Story canopy: A ring of benches under broad
    512px | shelf: A weatherproof shelf where one-page stories are
    373px | the gate. Open seat: One place at the
   built in    1241 ms

WHAT CHANGES WHAT
   viewport 1100 → 420: 14 → 25 lines; version 2 id unchanged
   decline both: 4 features; lineage has 1 version(s); declined proposals still listed: 2
   accept both:  6 features; version 2 id 8WVB1KHLT6… differs from neighbor-only lhXNQhpWQV…
```

## The code the "Show code" panel shows

The panel shows `run.ts` as it is, trimmed to the four moves. This is the
pipeline; nothing in the page is drawn from data the pipeline did not produce.

```ts
const composed = yield * compose(scenario, request.brief) // effect-dsp, effect-inference
const origin: PlaceArtifact = {
  schemaVersion: 1,
  scenario: scenario.id,
  brief,
  composition: composed.composition,
  accepted: []
}
const originId = yield * versionId(origin) // digest

const [proposed, note] =
  yield *
  Effect.all(
    [propose(scenario, brief, composed.composition), sendSealedNote("neighbor", "author", scenario.neighbor.note)],
    { concurrency: "unbounded" }
  ) // effect-dsp again; seal + sign (X25519) + digest (HKDF)

const proposals =
  yield *
  Effect.forEach(offered, ([proposal, accepted]) =>
    Effect.gen(function* () {
      const contentId = yield* proposalId(proposal) // digest
      const signature = yield* signAs(proposal.proposer, contentId) // sign
      return { proposal, contentId, accepted, signature }
    })
  )

const artifact = Arr.isEmptyReadonlyArray(accepted) ? origin : { ...origin, parent: originId, accepted }
const currentId = yield * versionId(artifact) // version 2 commits to version 1

const [rendered, versionSignatures] =
  yield *
  Effect.all(
    [render(artifact, request.viewportWidth), Effect.forEach(versions, (v) => signAs("author", v.contentId))],
    { concurrency: "unbounded" }
  ) // effect-search + effect-text + effect-math; sign
```

## Decisions, and what was rejected

- **Recorded inference, real evidence path.** The page must work with no
  provider configured and must not pretend otherwise. Live inference is a
  later toggle (`mode: "live"`) once a provider key is available on the server.
- **Three participants with real keys, not one demo key.** Per-participant
  signing is the point of attribution; a single key would show cryptography but
  not authorship. Keys are per process; the copy says "session key".
- **Lineage by digesting the parent's ID.** One field, `parent`, gives a
  tamper-evident chain without a Merkle structure the demo does not need.
- **Declined proposals stay in the result.** Alternatives are not erased; the
  UI lists them next to the accepted ones with their signatures.
- **Meander parametrization for render.** A first version searched twelve
  coordinates (one `(x, y)` per feature). TPE needed ~1.6 s and found trivial
  arrangements (all markers below the text), which showed nothing about
  text-flow. Six meander parameters give ~1.0 s renders independent of feature
  count and force the text to wrap around the markers, which is what the
  visitor should see. The old per-feature version is gone.
- **Description text includes accepted features.** Otherwise accepting a
  proposal changes a marker but not the prose, and the merge looks cosmetic.
- **Compactness in the loss, stage height derived.** Without it the search
  pushed everything down; with it the stage is as tall as the text needs.
- **UI specified, not built.** The pipeline and its evidence contract are
  stable enough to build against; building the page before the copy and
  structure were agreed would have been wasted work.

Alternatives considered for the story itself: a "shared timeline" (people add
events, the demo orders and signs them: weaker render, no search), a "walk
through a place" (path optimization: strong search, weak attribution), and a
"caption reflow" first slice (the previous draft: one participant, one key,
captions only, no lineage). The current design is the only one where every
package's job is visible _and_ the outcome is something a person would want to
keep.

## Honesty labels (exact copy)

- Stage corner: "Recorded inference" (tooltip: "The composer and proposer
  replies were recorded for this pattern and replayed through the real predict
  path. Schema checks and evidence are live.")
- Signatures: "valid for session key ‹fingerprint›" (tooltip: "Proves the
  signer held this key. It does not prove who a person is.")
- Sealed note: "Sealed to you by the neighbor · X25519 + HKDF-SHA256 →
  XChaCha20-Poly1305 · ‹n›-byte envelope" (tooltip: "The sealing key was derived
  on both sides and never sent. You see the text because your key opened it.")
- Lineage strip after a viewport change: "Presentation changed, meaning didn't:
  same content IDs."
- Content IDs: "BLAKE3-256 over the canonical encoding. A digest names content;
  it does not judge it."

## What was built

The page follows the plan above with these differences:

- Hybrid split. `POST /api/imagined-place/build` returns a `PlaceBuild` with
  no rendering: composition, lineage, signatures, sealed note. The browser
  renders with its own font metrics, running the TPE study step by step
  (`Study` ask/tell) and showing the best-so-far arrangement every 28 ms, so
  the stage-width slider is live and the search is visible. Stage width is
  presentation only and is never sent to the server.
- Geometry invariants. `placeMarkers` clamps every marker inside the padded
  stage and pushes each one down just far enough to clear the markers before
  it by the 10 px gap. Overlap and side overrun are impossible by construction,
  so the loss no longer scores them; it scores bottom overflow, squeezed lines,
  raggedness, and vertical sprawl.
- Markers show their feature name inside the disc when the disc is at least
  56 px across, otherwise the feature number; a legend under the stage lists
  every feature and who added it.
- Proposals are toggled in place (each card has a Merge switch); there is no
  Inspect drawer. Evidence is shown inline: lineage cards, a metric strip, the
  condensed pipeline as a code block, and links to the eight package docs.
- The `marker-label` text role (12 px semibold, wraps) was added to the
  typography contract for the disc labels.
- Builds are debounced 400 ms while the brief is edited; the previous
  artifact stays on the stage until the next build arrives.
- The home page has its own effect-atom runtime (`ImaginedPlaceClient`), so
  the docs workbench's `DemoClient` and its tests are untouched.

### Second pass: show, don't tell; every screen size

The first build was reviewed and redone against the earned-text rule (visible
text must identify an unfamiliar object, label an action, carry content, state
a constraint, or explain a result or error) and verified in a real browser at
1920, 1440, 1280, 1024, 820, 390 and 360 px, in light and dark, with real
interactions (scenario switch, brief edit, merge toggles, slider, API failure
and retry).

- Removed: the numbered step headings and their summaries, the hero's demo
  sentence, the brief hint, the slider hint, the "built in n ms" banner, and
  the crypto route under the sealed note. The heading is "An imagined place";
  row labels are "Brief", "Proposals", "Lineage", "Stage width".
- Kept because it earns its place: participant badges, feature name,
  description and rationale (content); "Sealed note · opened with your key"
  with the opened text (identifies the object); "Recorded inference" beside
  the composition title (an honest label the stage would otherwise not carry);
  "Verified · key ‹8 hex›" and "You signed · key ‹8 hex›" (a signature proves
  a key, not a person); the live "Searching arrangements · trial n of 36" →
  "36 arrangements searched · loss x.xxx" line.
- Behind "How it's built": the metric strip and the condensed pipeline. The
  eight package links stay visible; they are navigation.
- Errors: "The place could not be built." with a Try again button that
  refreshes the build atom; the last successful place stays on the stage.
- Layout: one grid. Below `lg` the order is stage → lineage → brief →
  proposals, so a phone shows the result first. From `lg` the brief and
  proposals sit in a 18–21 rem left column and the stage column is sticky
  (`top-6`, `self-start`) so the drawing stays in view while the proposals
  scroll. Proposals go two-up between `sm` and `lg`. The legend appears only
  when discs are too small to carry names. The stage-width slider is hidden
  when the column leaves it less than 60 px of range.
- Two layout rules learned the hard way. A projected-wrap `SemanticText`
  block (the default `wrapAuthority`) must never sit in a flex row without a
  definite width: its measured width feeds back into the flex item's size and
  the page never mounts (seen at ≤ 1024 px). Give it a grid cell
  (`grid-cols-[minmax(0,1fr)_auto]`) or `wrapAuthority="native-browser"`. And
  `overflow-x-hidden` on the app root made `main` a scroll container, which
  silently disabled `position: sticky` for the whole page; the root now uses
  `overflow-x-clip`, as the docs shell already did.

### Third pass: one spine, four steps, no random metrics

The second pass was reviewed as a set of correct parts without a line through
them: the visitor could not tell in what order the packages ran, the metric
strip was numbers without a question, and the slider asked for a decision that
had no meaning. Three research passes (narrative demo patterns on library
sites, CSS-only motion for state changes, provenance and attribution UI) fed
this redesign.

- One story spine. Four steps in pipeline order, each labelled with a verb and
  the packages it uses as small toned pills that link to the docs: Compose
  (effect-dsp, effect-inference) → Propose (sign, seal) → Record (digest,
  sign) → Arrange (effect-text, effect-math, effect-search). Steps one to three
  run down the left rail under a vertical line with a dot per step (visible
  from `lg`); Arrange is the sticky right column because the drawing is the
  result of the other three. Below `lg` the stage still comes first. Step
  numbers are gone; the spine carries the order.
- One selected step. `placeStepAtom` holds the current step. Clicking a step
  name (an `aria-pressed` button) or a tab under "How it's built" selects it,
  and the code panel shows that step's snippet, labelled `Step · pkg, pkg`.
  Step definitions and snippets live in `placeSteps.ts`.
- One vocabulary for actors. You (sign tone), Neighbor (seal tone), Proposer
  program (dsp tone) everywhere: proposal cards, feature chips, markers, the
  lineage, and a legend that is always under the stage.
- Record is a timeline, not a table: `v1 · Origin`, `v2 · Current · Built from
v1`, what changed (`4 features from your brief`, `+ Open seat · Neighbor`),
  the truncated content ID, and `You signed · key ‹8 hex›`.
- "Drawn at" presets replaced the slider: 320 px, 520 px and the full column
  width, shown only when at least two fit with 80 px between them. The point
  is the one comparison that matters (the drawing changes, the content ID does
  not), and the phone, which has no room to compare, hides them.
- The search trace is a real trace: a 176 × 36 sparkline of every trial's
  loss on a log scale with the running best as a step line, and the text
  `36 trials · best loss x.xxx`. It replaced the metric strip.
- Motion is CSS only. Markers are positioned with `translate` and transition
  translate, size and opacity over 200 ms with `@starting-style` entry; the
  stage transitions its size; everything honours `prefers-reduced-motion`.
- The layout model was retuned so markers cluster instead of forming a
  diagonal column (`meanderBounds` edge 0.5–0.9, swing 0–0.3, step 0.03–0.24)
  and the stage has a 640 px minimum height so narrow stages are not punished
  for overflow. At 780 px the stage height fell from 502 to 353 and the best
  loss from 1.89 to 1.35; at 324 px (a phone) the loss fell from 14.3 to 4.3.
- Verified at 1440 × 900, 820 × 1180 and 390 × 844, light and dark: no
  horizontal overflow, step ↔ tab sync, merge toggles change the content ID
  and the lineage, presets change the drawing and not the ID.

### Fourth pass: the place reads as a place, and changes are visible where they land

Two research passes (cause → effect patterns on library demo sites: Effect,
Liveblocks, Stripe Elements, Observable, tldraw, Motion, Radix; stage
presentation: shape-outside, cartographic marks, Base UI Popover) fed a pass on
legibility and narrative rather than on parts.

- The description reads as prose. `description()` no longer prefixes each
  feature with its name; the summary, atmosphere and feature descriptions flow
  as one paragraph and the names live on the discs. At 780 px the stage got
  shorter and the best loss fell (1.49 for the garden).
- Every disc is a Base UI `Popover.Trigger` with `openOnHover`, so hover,
  focus and tap all open the same card: name, contributor badge, description.
  Nothing on the stage is hover-only and `role="img"` is gone from anything
  interactive. Numbered discs (drawn under 56 px) carry an invisible 4 px ring
  so the touch target stays at or above 44 px on a phone without changing the
  drawing.
- The stage is quiet paper (a token radial wash, no invented geography).
  Discs are lit spheres: `--th-place-disc-{sign,seal,dsp}` gradients defined
  per theme in `styles.css`, because the dark tone scales run the other way
  (100 nearest the background) and the light-mode `from-stage-0` highlight
  became a hole in dark mode.
- A dotted walk (`PlaceWalk`) passes through the disc centres in real feature
  order and draws itself once (`pathLength="1"`, mask-based, 900 ms, off under
  `prefers-reduced-motion`). It says only what is true: the order the place
  lists its features in.
- Changes show where they land. `placeVersionChangeAtom` (`get.self`) counts
  how many times the current version's content ID has changed since the place
  was first built; `ChangedValue` remounts on that count and plays a 1200 ms
  digest-tone wash. Zero on first arrival, +1 on a merge or an edited brief,
  unchanged on a redraw, reset to zero when another pattern is chosen (a
  different place, not a change to this one). Used on the title-row version ID
  and the current lineage entry.
- Provenance captions. `ProposalRecord.offeredBy` (not digested) gives each
  proposal a line under its badge: `visited on the first night`, `shown the
composition, asked for one feature it lacks`. `PlaceMarker.description` puts
  the feature text in the popover. When the brief is edited, Compose says once:
  `The recording answers the original brief; your edited brief is what version
1 signs.`
- Caption wording follows measure · value · scope: `Searching arrangements ·
n of 36` / `36 arrangements searched · best loss x.xxx`; the row with the
  presets wraps instead of truncating on a tablet.
- One lead sentence under "An imagined place" names the four moves in order;
  `ChoicePills` buttons expose `aria-pressed`.
- Verified in the browser at 1440 × 900, 820 × 1180 and 390 × 844, light and
  dark: popover opens by click with a resolvable `aria-labelledby`; merging
  the program's proposal moves `data-changes` 0 → 1 and adds the sixth disc;
  a preset change leaves it at 1; an edited brief moves it to 2; switching to
  Tidal workshop resets it to 0; no horizontal overflow at any width.

## Files

- `app/contracts/imagined-place.ts`: scenario, roles, features, composition,
  proposal, artifact, `placeFeatures`, `PlaceRequest`, `PlaceBuildError`.
- `app/contracts/imagined-place-result.ts`: projection (markers, lines),
  inference/render evidence, versions, signatures, sealed note, `PlaceResult`.
- `app/server/imagined-place/catalog.ts`: the three recorded patterns.
- `compose.ts`: composer and proposer programs, recorded replies, inference
  evidence.
- `authority.ts`: `Participants` (author, neighbor, program; Ed25519 + X25519
  key pairs), content IDs, `signAs`.
- `note.ts`: the sealed note.
- `app/contracts/demo/imagined-place-flow.ts`: stage geometry, meander →
  markers (with the on-stage and no-overlap invariants), text flow, loss terms.
- `app/contracts/demo/imagined-place-arrangement.ts`: description text, the
  search space, one trial, the rendering.
- `render.ts`: the server-side search (tests and the CLI walkthrough).
- `app/web/atoms/imagined-place.ts`, `imagined-place-render.ts`: controls,
  build, stage width, and the browser-side step-by-step search.
- `app/web/view/home/`: `ImaginedPlaceDemo`, `PlaceStepCard`, `placeSteps`,
  `PlaceControls`, `PlaceProposals`, `PlaceProposalCard`, `PlaceLineage`,
  `PlaceArrangement`, `PlaceStage`, `PlaceMarker`, `PlaceWalk`,
  `PlaceSearchTrace`, `PlaceHowItsBuilt`, `placeViewModel`.
- `app/web/view/primitives/ChangedValue.tsx`: the one-shot wash on a value
  that just changed.
- `run.ts`: `buildPlace`.
- `test/server/imagined-place.test.ts`: composition for every pattern;
  lineage; declined proposals keep identity and signature; every signature
  verifies with its signer's key and fails with another key or a tampered
  subject; the sealed note opens to the fixture text; legibility (some line
  narrowed by a marker, none below 40%, markers on stage, text equals the
  description); determinism and viewport independence of content IDs.
- `scripts/imagined-place-walkthrough.ts`: the CLI walkthrough above.
