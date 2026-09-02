# Imagined Place: the Theoria home page

`/` is one integrated demo of the eight Theoria packages. `/docs` is the
package catalog. This file records what the demo is, what runs, what the page
shows, and the decisions behind it, so that changes can be judged against the
same standard the demo was built to.

## What the demo has to do

1. Show what Theoria is _for_: one artifact a visitor would want to keep,
   produced by the packages working together, with controls that change it.
2. Give every package a visible job, so the code panel, the page, and the docs
   read as one story.
3. Stay honest and public. No claim the code does not earn; no Scene internals.
   The words are the public ones: imagine, propose, merge, version, signature,
   attribution.

## The story

A visitor briefs an imagined place. A composer program gives it a title, a
summary, an atmosphere, and three to six weighted features. Two proposals
arrive: a neighbor's (with a note sealed so only the author can read it) and a
second program's. The visitor decides what to merge. The merged version is
digested with its parent's ID inside it and signed by the author; declined
proposals stay listed with their proposer's signature. The page then arranges
the place for the screen it is on: a search places the features as discs and
the place's own description flows around them.

Three worlds ship, each written as a short piece of fiction that people would
plausibly build together, not as a product scenario:

| Scenario           | Place                        | Composed features                                          | Neighbor proposes | Program proposes |
| ------------------ | ---------------------------- | ---------------------------------------------------------- | ----------------- | ---------------- |
| `unfinished-light` | The Unfinished Light         | Causeway, The desk, Pigeonholes, The rota                  | Finishing shelf   | Ship's bell      |
| `lost-market`      | The Market of Lost Things    | The ledger, The stalls, The stool, The tin                 | Second telling    | Chalk arrow      |
| `drowned-library`  | The Library Under Cald Water | The steps, Reading room, Borrowers' cards, Waterline strip | Dry shelf         | Closing bell     |

Each sealed note is a private confidence that gives the neighbor's proposal
its stakes. Briefs and text live in
`app/contracts/imagined-place.ts` (`placeScenarioMeta`) and
`app/server/imagined-place/catalog.ts`.

## What runs

`POST /api/imagined-place/build` with `{ scenario, brief, acceptNeighbor,
acceptProgram }` runs `buildPlace` (`app/server/imagined-place/run.ts`) and
returns a `PlaceBuild`: the artifact, the proposals, and the evidence. Nothing
about rendering is in the response.

| Step    | Package(s)                              | What runs                                                                                                                                                                                                        | Visible result                                                                       |
| ------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Compose | effect-dsp, effect-inference            | `Signature.make` + `Module.predict("theoria-place-composer")` decode the recorded reply against `PlaceComposition`; `RuntimeResolver` records which runtime answered                                             | Title, summary, atmosphere, features; the `Recorded inference` pill                  |
| Propose | effect-dsp, sign, seal, digest          | `theoria-place-proposer` offers one feature; the neighbor's note is sealed with X25519 → HKDF-SHA256 → XChaCha20-Poly1305 and opened by the author; each proposal is digested and Ed25519-signed by its proposer | Two proposal cards, each with `Verified · key …` and its content ID; the opened note |
| Record  | digest, sign                            | `digestSchemaValue` over the canonical artifact; version 2 carries version 1's ID as `parent`; the author signs every version                                                                                    | Version rows with BLAKE3-256 IDs, `Built from v1`, `You signed · key …`              |
| Arrange | effect-text, effect-math, effect-search | In the browser, seeded TPE (`Sampler.tpe({ seed: 42 })`, 36 trials) over a six-parameter meander; `layoutLinesWith` wraps the description per line; distances and spread score each trial                        | Discs settle while the trace advances; text narrows beside each disc                 |
| All     | effect                                  | One `Effect.gen` pipeline, `PlaceBuildError` tagged by stage, `Effect.all` where steps are independent                                                                                                           | Build time in the evidence                                                           |

Inference is recorded, and the page says so: the composer's and proposer's
replies were recorded per scenario and replayed through the real `predict`
path, so schema decoding and evidence are live while the transport is not.
Editing the brief re-signs version 1 with the edited brief, and the composition
card explains that the recording answers the original brief.

Participants (`authority.ts`) are three real key pairs per process: author,
neighbor, program, each with Ed25519 signing and X25519 agreement keys.
Signatures prove a session key signed the content ID; the copy never claims
they prove a person's identity.

Rendering (`app/contracts/demo/imagined-place-flow.ts`,
`imagined-place-arrangement.ts`) is pure and shared: the server uses it in
tests and the CLI walkthrough, the browser runs the same search step by step in
`app/web/atoms/imagined-place-render.ts` with its own font metrics, showing the
best arrangement so far every frame. Stage width is presentation only, is
never sent to the server, and never changes a content ID. `placeMarkers` keeps
every disc on the stage and clear of the ones before it by construction, so the
loss only scores overflow, squeezed lines, raggedness, and sprawl.

## What the page shows

One column, four step cards on a spine (`Compose`, `Propose`, `Record`,
`Arrange`), each carrying the package pills that did the work (linked to
`/docs/<package>`) and the live object the step produced. Choosing a step
points the `How it's built` code panel at that step's source.

- Compose: scenario pills, the brief (editable, 280 characters, debounced
  400 ms), the composition's title with the `Recorded inference` pill, then the
  feature chips.
- Propose: two proposal cards with a `Merge` switch each. Header: proposer
  badge, then an `In v2` pill while the recorded version holds the proposal.
  The switch is the visitor's intent and never locks; the pill is the record.
  Between the two — the debounce, the server build — the card carries
  `data-place-pending`, and `data-place-recorded` always says what the build
  returned. A click during a build is kept, not dropped. Title: the feature's
  name, which becomes its disc. Then a labelled list — `Adds` (the sentence
  that merges into the place), `Why` (the proposer's reason), `Note` (the
  neighbor's sealed note, opened with the author's key). Footer: the proposal's
  signature pill and content ID.
- Record: version rows (`V1 · Origin`, `V2 · Current`), what changed and who
  contributed it, the BLAKE3 ID, the author's signature.
- Arrange: the stage with named or numbered discs (Base UI popovers with the
  feature's description and contributor), the dotted walk path, the description
  flowing around the discs, the search trace, stage presets, the participant
  legend (the author and every proposer whose proposal is in the drawn
  version), and the current version's ID with a one-shot wash when it changes.
  Whether discs carry names is measured, not guessed
  (`placeMarkerLabels.ts`): each name is laid out with effect-text at the
  disc's inner width and two narrower wraps, must break only at word
  boundaries, and fits when its block's diagonal is within the circle. A frame
  is named or numbered as a whole, so the numbers on the stage and in the
  legend always agree. The trace is a Base UI
  slider over every trial: each dot is one arrangement's loss (log scale), the
  step line is the running best, and dragging or arrowing the thumb draws that
  trial on the stage so a rejected arrangement can be seen, not just counted.
  The caption reads the shown trial (`Kept trial 33 of 36 · loss 1.520` or
  `Trial 1 of 36 · loss 16.999 · not kept`) and shares its row with the stage
  presets only when the Arrange column is wide enough (`@2xl` container
  query): the column is narrower beside the steps than above them. The stage is paper
  cut to the kept arrangement and keeps that size while another trial is drawn
  on it (`PlaceStage.tsx`, a Base UI `ScrollArea` sized to the kept frame): a
  trial that ran longer than the sheet is cut with a fade and scrolls, and the
  caption row is always as tall as the `Kept trial` pill. Nothing below the
  stage moves while the trace is scrubbed; before this, every trial resized the
  stage and the slider jumped under the pointer. Discs are keyed by the shown
  trial, so a swap places them outright while the search's own progress still
  animates them.

Every content ID on the page (`ContentId`) is a tooltip trigger: hover or focus
shows the whole BLAKE3-256 ID, a click copies it and the tooltip stays to say
`Copied`. The hero links to `#how-its-built` beside `Browse the packages`.

Below the steps, `How it's built` is always open. It shows the current step's
code with every package symbol linked to its reference page
(`placeReferences.ts`, checked by unit and e2e tests against the search index),
the values this page's build produced as annotation rows under the line that
made them (`placeLiveValues.ts`: the composition title and feature count, the
recorded response model, the proposal's ID and signature, the sealed envelope
size, the version chain, the line count at the stage width, the closest-marker
distance, the running trial count), and the files that ran, linked to GitHub at
the build's commit (`meta.buildSha`; `HEAD` when running locally).

Text goes through `SemanticText` roles only; layout through `Layer`, `Stack`,
`Cluster`, `Section`; state through effect-atom (`placeControlsAtom`,
`placeBuildAtom`, `placeVersionChangeAtom`, `placeStageWidthAtom`,
`placeStepAtom`, `placeRenderFrameAtom`). Disc gradients are per-theme tokens
(`--th-place-disc-*`) exposed as `.bg-place-disc-{sign,seal,dsp}`.

Visible text follows the earned-text rule: it names an unfamiliar object,
labels an action, carries content, states a constraint, or explains a result.
Metrics appear only where they are the result of a step the visitor can see.

## Decisions

- Recorded inference with the real evidence path, so the page works with no
  provider configured and does not pretend otherwise.
- Three participants with real keys, because attribution is the point; a single
  demo key would show cryptography but not authorship.
- Lineage by digesting the parent's ID: one field gives a tamper-evident chain.
- Declined proposals stay in the result and on the page with their signatures.
- Six meander parameters instead of one coordinate pair per feature: renders
  are fast, independent of feature count, and force the text to wrap around the
  discs, which is what the visitor should see.
- The description includes accepted features, so a merge changes the prose and
  the stage together.
- Rendering in the browser, not the response: the stage is live against the
  real viewport and the search is visible.
- The home page owns its own effect-atom runtime (`ImaginedPlaceClient`); the
  docs workbench's `DemoClient` is untouched.

## Evidence

- `test/server/imagined-place.test.ts`: composition for every scenario;
  lineage; declined proposals keep identity and signature; every signature
  verifies with its signer's key and fails with another key or a tampered
  subject; the sealed note opens to the fixture text; legibility (some line is
  narrowed by a disc, none below 40 %, every disc on stage, text equals the
  description); content IDs are deterministic and independent of stage width.
- `test/server/imagined-place-route.test.ts`: the route's method, origin, and
  schema checks.
- `test/worker/home.test.ts`: against the built Worker in workerd, the place
  is built by the real API and re-digested when a proposal is merged, and the
  catalog stays complete and unscrolled across responsive widths.
- `test/worker/home-demo.test.ts`: the search-trace slider draws trial 1 and
  the last trial with the discs moving on the stage, returns to the kept trial
  by Escape and by the `Kept trial` pill, content IDs open their full value on
  hover; no element leaks past the viewport at 320–1680 px; every symbol in
  `How it's built` links to an existing reference anchor while the annotations
  show values from the build.
- `test/worker/docs.test.ts`: the landing page's package pills enter the docs
  without a document reload.
- `scripts/imagined-place-walkthrough.ts`: the same pipeline from the CLI.

## Files

- `app/contracts/imagined-place.ts`, `imagined-place-result.ts`: scenarios,
  roles, features, composition, proposals, artifact, request, evidence,
  `PlaceBuild`, `PlaceRendering`.
- `app/contracts/demo/imagined-place-flow.ts`, `imagined-place-arrangement.ts`:
  stage geometry, meander → discs, text flow, loss, the search space, one
  trial, the rendering.
- `app/server/imagined-place/`: `catalog.ts` (worlds), `compose.ts` (programs
  and recorded replies), `authority.ts` (participants, content IDs, signing),
  `note.ts` (sealed note), `render.ts` (server-side search), `run.ts`
  (`buildPlace`).
- `app/server/routes/imagined-place.ts`: the route.
- `app/web/atoms/imagined-place.ts`, `imagined-place-render.ts`: controls,
  build, version change, stage width, step, browser-side search.
- `app/web/view/home/`: `HomePage`, `HomeHero`, `ImaginedPlaceDemo`,
  `PlaceStepCard`, `placeSteps`, `PlaceControls`, `PlaceComposition`,
  `PlaceProposals`, `PlaceProposalCard`, `PlaceLineage`, `PlaceArrangement`,
  `PlaceStage`, `PlaceMarker`, `PlaceWalk`, `PlaceSearchTrace`,
  `PlaceHowItsBuilt`, `placeViewModel`.
- `app/web/view/primitives/ChangedValue.tsx`, `ToggleSwitch.tsx`,
  `ChoicePills.tsx`: the controls the demo added or reshaped.
