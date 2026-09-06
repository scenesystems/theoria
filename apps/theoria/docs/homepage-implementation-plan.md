# Homepage redesign: engineering and delivery plan

Status: researched implementation plan, 2026-09-06. No UI implementation is
claimed here. The [experience brief](./homepage-immersive-surface.md) owns the
creative direction; this document owns execution, boundaries, tests, sequence,
and completion evidence. Keep both in the standalone homepage PR. The brief
was committed first as
[`6820728`](https://github.com/scenesystems/theoria/commit/6820728863a7653ef0bf8d363c3c249af338d620)
(local commit at the time of writing; the link is available remotely after push).

## 1. What implementation must accomplish

Deliver the living-atlas experience, not a primitive cleanup disguised as a
redesign: place-led arrival, adjacent real contribution, recognizable
consequence, three authored scenarios, optional technical depth, and useful
compact-screen composition. Preserve the demo's recorded-example disclosure,
real build evidence, and presentation-only arrangement controls.

### Governing posture: target quality, not preservation

The target is the best production-grade experience we can deliver for this
vision. Existing code, dependencies, tests and visual conventions describe
the starting point; none is evidence that the target has already been met.
“We already have it” is never sufficient justification for retaining it or
declining an improvement. A passing regression suite is not an aesthetic,
interaction, accessibility or architectural quality certificate.

Define the desired experience and its quality criteria first. Then assess each
affected foundation against them and choose to retain, enhance or replace it.
Reuse is earned by suitability. Prefer the simplest design that fully meets
the target, not the smallest diff that leaves the target unmet. Improvements
to the theme, design system, interactivity and their engineering foundations
are first-class deliverables, not incidental polish or optional follow-up.

New fonts, assets, primitives, module boundaries, rendering techniques or
dependency capabilities are valid when they materially improve the intended
experience. Evaluate visual benefit, accessibility, performance, lifecycle,
maintainability and migration cost; neither familiarity nor novelty wins by
default. Do not introduce unrelated products or infrastructure, but do not
use scope discipline to exclude necessary foundation improvements.

### Target-state assessment before implementation

For each affected concern, record: target quality, observed gap, proposed
retain/enhance/replace decision, owning module, affected consumers, and evidence
required to accept it. A retained implementation needs a reason tied to the
target just as a replacement does. This is a decision section in the delivery
record, not a new governance framework or inventory of every repository file.

Required assessment areas:

- **Theme and typography:** expressive hierarchy, font suitability, readable
  measures, responsive scale, color semantics, light/dark art direction,
  contrast, spacing rhythm and agreement between measured and painted text.
- **Styled primitives:** control anatomy, affordance, focus/selection/disabled
  states, comfortable targets, overlay behavior, composition APIs and visual
  coherence. Using Base UI alone does not establish their quality.
- **Interaction:** invitation, direct consequence, reversibility, progressive
  disclosure, keyboard/touch equivalence, interruption and recovery. Existing
  controls are candidates, not a mandatory design vocabulary.
- **State and resources:** explicit identity, truthful pending/committed states,
  testable service seams, cancellation and lifetime ownership. Effect-native
  syntax alone is not proof of correct or maintainable architecture.
- **Verification:** coverage of target behavior, reliable browser observation,
  representative visual states and meaningful performance measurements.
  Existing tests may preserve incidental constraints that must be replaced.

### Theme and design-system deliverable

Develop a coherent target language for typography, color, space, surfaces,
controls, feedback and motion. Prototype it in the actual arrival, contribution,
reading and detail compositions before treating individual tokens as settled.
The system must support all three worlds and both themes without per-component
patchwork. Improve semantic roles, variants and generation tooling where needed;
do not make the new experience conform to inadequate old APIs or token scales.

Validate affected shared consumers as part of that improvement. Compatibility
means preserving their meaningful capabilities and accessibility, not freezing
their old appearance. Migrate callers and remove superseded implementations
within the affected concern rather than layering a parallel homepage-only
design system over the old one. Do not expand into unrelated product redesigns.

### Resolved dependency baseline

Read from `bun.lock`, not inferred from package ranges:

| Dependency               | Resolved version | Role                                                                |
| ------------------------ | ---------------- | ------------------------------------------------------------------- |
| Effect                   | 3.22.1           | Work, services, interruption, scope, typed errors                   |
| Effect Atom / Atom React | 0.7.0 / 0.7.0    | Shared state, resource lifetimes, React subscriptions               |
| React / React DOM        | 19.2.8 / 19.2.8  | Rendering, refs, composition                                        |
| Base UI                  | 1.7.0            | Accessible control and overlay mechanics                            |
| Motion / framer-motion   | 13.2.0 / 13.2.0  | Visual continuity, animation                                        |
| Tailwind                 | 4.3.3            | CSS-first token-backed styling                                      |
| Vitest / Playwright      | 4.1.11 / 1.62.1  | Existing test runners; do not introduce a competing browser harness |

Upstream sources below explain dependency behavior; default branches can
advance. The app's tests against its resolved versions are the integration
authority. Do not translate Effect v4 examples into this Effect v3 app by guesswork.

## 2. Source-backed practices

### Effect and Effect Atom

Research references:
[Atom construction](https://github.com/tim-smart/effect-atom/blob/main/packages/atom/src/Atom.ts),
[Result](https://github.com/tim-smart/effect-atom/blob/main/packages/atom/src/Result.ts),
[runtime cleanup](https://github.com/tim-smart/effect-atom/blob/main/packages/atom/src/internal/runtime.ts),
[registry lifetime](https://github.com/tim-smart/effect-atom/blob/main/packages/atom/src/internal/registry.ts),
[React RegistryProvider](https://github.com/tim-smart/effect-atom/blob/main/packages/atom-react/src/RegistryContext.ts).

- Assess the dependency-driven build atom against the target interaction and
  lifecycle contracts. It is currently not an `Atom.fn` mutation queue.
  Ordinary async atom refresh disposes prior work; the researched `Atom.fn`
  non-concurrent default has related latest-request behavior. Retain or improve
  the owning state design based on demonstrated correctness and clarity, not
  because either API is already present or more fashionable.
- Interruption is cooperative. Prove the app's obsolete work cannot publish;
  do not assume aborting a client undoes a request already executing remotely.
  Never make builds uninterruptible or concurrent merely to simplify animation.
- `Result` has `Initial`, `Success`, `Failure`, and an independent `waiting`
  flag. Failure may retain `previousSuccess`. Use the existing `Result.value`
  projection deliberately; retaining data must not erase error/pending meaning.
- Scope subscriptions, observers, streams, and animation-related browser
  observation. Use existing platform services, `Effect.acquireRelease`, scoped
  streams and atom finalizers where those resources belong. Do not launch
  unmanaged fibers from React events or invent a second registry.
- Registry idle TTL and provider disposal mean cleanup is not necessarily
  synchronous with the last React unmount. Test eventual disposal under the
  actual configured lifetime, not a guessed timeout or a private timer value.
- Prefer derived state to cached copies of facts. Keep requested controls,
  committed build, render work and transient selection distinct. `keepAlive`
  is not a cure for a subscription bug or a reason to retain DOM elements.
- Follow local Effect discipline: Schema for data contracts, Option for absence,
  Match for exhaustive dispatch, Effect services for browser/network access,
  and typed errors for recoverable failures. Do not broaden `appRuntime` when
  a feature service already owns the operation.

### React 19 and observation

[React StrictMode](https://react.dev/reference/react/StrictMode) deliberately
replays rendering, effect setup/cleanup and ref callbacks in development.

`atoms/element-observation.ts` already uses a callback ref into local React
state to carry the mounted element, then an element-keyed atom for observation.
This is the narrowly justified local-state exception; do not migrate it into
an unmounted writable atom or copy the pattern for domain state. Its helper
returns cleanup on attachment and does nothing on a null callback: do not
claim null alone is an independent cleanup path. Test the actual React 19
attachment/cleanup lifecycle and ensure setup/cleanup is balanced.

Keep domain hooks and browser resources out of speculative render-time work.
One scene instance must survive responsive changes. Do not mount hidden
desktop/mobile demos with separate observers and searches. Stable React keys
must represent scenario/feature identity, not array positions, render frames,
random values, or an ever-changing version ID for an entire interactive subtree.

### Base UI

Research references:
[Tabs list](https://github.com/mui/base-ui/blob/master/packages/react/src/tabs/list/TabsList.tsx),
[RadioGroup](https://github.com/mui/base-ui/blob/master/packages/react/src/radio-group/RadioGroup.tsx),
[Switch](https://github.com/mui/base-ui/blob/master/packages/react/src/switch/root/SwitchRoot.tsx),
[Popover root](https://github.com/mui/base-ui/blob/master/packages/react/src/popover/root/PopoverRoot.tsx),
[Popover focus](https://github.com/mui/base-ui/blob/master/packages/react/src/popover/popup/PopoverPopup.tsx),
[render composition](https://github.com/mui/base-ui/blob/master/packages/react/src/use-render/useRender.ts).

- Audit `TabBar`, `ChoicePills`, `ToggleSwitch`, field and overlay primitives
  against the target design and interaction. Enhance or replace their styled
  anatomy and APIs when needed, retaining Base UI's applicable browser mechanics.
  Do not replace provider behavior with buttons carrying hand-written roles.
- Controlled value callbacks update requested state. Decode provider values
  through the established typed boundary. Do not duplicate hidden form inputs.
- Specify tab activation policy. The researched Base UI implementation defaults
  to manual activation unless `activateOnFocus` is enabled. Test focused versus
  selected tabs separately; do not assume arrow keys select code panels.
- A component passed to `render` must preserve injected props, handlers and ref.
  React 19 accepts ref as a prop. Avoid nested buttons/links and lost ARIA
  attributes when adding Motion or layout primitives.
- Details containing controls are popovers/dialogs, not interactive tooltips.
  Choose modality explicitly. Modal/trap-focus popovers need an accessible
  close control. Verify touch initial focus avoids unnecessary keyboard opening,
  Escape/outside dismissal, collision behavior, and focus return if a trigger
  disappears during a scenario change.
- Keep hover preview distinct from persistent keyboard/touch selection. A mouse
  leaving the scene must not erase a detail chosen from the keyboard.

### Motion, CSS and typography

Research references:
[domAnimation](https://github.com/motiondivision/motion/blob/main/packages/framer-motion/src/render/dom/features-animation.ts),
[domMax](https://github.com/motiondivision/motion/blob/main/packages/framer-motion/src/render/dom/features-max.ts),
[Motion accessibility](https://motion.dev/docs/react-accessibility),
[Tailwind class detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).

- `App.tsx` already provides `MotionConfig reducedMotion="user"`. Do not add a
  conflicting second preference authority.
- Under `LazyMotion`, `domMax` includes layout projection; `domAnimation` does
  not. Decide between ordinary Motion imports and a measured lazy boundary;
  lazy loading is not mandatory. Mixing full `motion` imports into a supposedly
  lightweight `m` subtree undermines its bundle rationale.
- Scope shared layout identity by scenario and stable feature. Do not rely on
  duplicate feature names, simultaneous source/destination copies, or a
  `layoutId` prop alone as proof the transition works. If SVG projection is
  unsuitable, animate a local HTML label or use immediate source/destination
  emphasis rather than add a fragile coordinate bridge.
- Motion's reduced-motion handling does not govern CSS keyframes, every SVG
  property, or the search stream. Supply static geometry and explicit stepping
  for reduced motion. Keep semantic updates independent of animation completion.
- Animate a bounded relationship, not every measured prose line. Avoid permanent
  `will-change`, large animated blur/backdrop filters and independent transforms
  fighting the geometry produced by the arrangement engine.
- Keep full Tailwind class literals and `Match` mappings. `styles.css` already
  registers `semantic-text-safelist.txt`; new generated role classes must be
  included. Do not fix missing production styles with broad speculative safelists.
- Typography authority is `contracts/text.ts`; the generator
  `scripts/generate-text-tokens.ts` **prints** token CSS to stdout. It does not
  update `styles.css` or the safelist. This describes a tooling limitation,
  not a workflow to preserve indefinitely. Improve generation if the target
  typography needs a safer reproducible update path. Until then, generate to
  scratch, apply generated output and update needed safelist entries together.
  Keep one semantic authority; do not hand-tune generated numbers independently.
- Font size and metrics used for Effect text measurement must match painted
  text. Prefer native wrapping for ordinary editorial copy and preserve
  Effect-owned obstacle-aware layout for the artifact. A larger title is not
  permission to scale the entire stage bitmap/DOM and invalidate hit targets.

## 3. State and identity contracts to prove first

| Concern                          | Source of truth                                        | Must not control                      |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------- |
| Requested brief/scenario/merge   | `placeControlsAtom`                                    | Claim that a request has succeeded    |
| Committed artifact/evidence      | `placeBuildAtom` / envelope                            | Browser width or decorative theme     |
| Arrangement computation          | Artifact + stage width + text metrics                  | Server build parameters or signed IDs |
| Trial inspection                 | Selection within current search                        | Current signed version                |
| Displayed atmosphere/attribution | The artifact actually displayed                        | A newer request not yet displayed     |
| Selected detail                  | Stable optional identity resolved against current data | Copied stale proposal/build records   |
| DOM size/visibility              | Mounted element observation                            | Durable world/session identity        |

### Concrete high-risk transition

The current view reads build information and render results independently.
The render atom retains old values, and `PlaceRenderFrame` carries no explicit
originating content ID. This creates a contract question to test before new continuity is
built: after build B arrives but before its first render frame, can title,
evidence or attribution from B accompany a retained drawing from A?

This is a source-level risk, not a confirmed visual defect from this research.
The desired rule is clear: the drawn scene and any claim about that drawing
must refer to the same artifact. Either retain the whole previous displayed
pair, or show current readable content with the previous drawing explicitly
identified until its replacement is ready. Prefer the former for continuity.

Add origin identity to the client frame/projection only if needed to make that
pairing explicit. Use the existing committed artifact identity, not a new
server protocol or durable history service. Do not let a late A frame satisfy
B's “ready” condition. Trial indices and focused feature identities must reset
or re-resolve when their search/artifact changes.

### Temporal cases

1. Initial request succeeds/fails; retry has no prior success to display.
2. Requested choice changes while committed A remains visible and identified.
3. B succeeds; consistent scene/evidence appears, then contribution emphasis.
4. B fails; A remains usable, failure is visible, requested intent is retained.
5. B is superseded by C; B must not commit or announce after C.
6. Scenario changes with a detail open or trial selected; old selection cannot
   point into unrelated data or retain detached focus.
7. Width changes during search; old search stops, preview clears, IDs and build
   request count do not change. A frame's dimensions must match its own stage.
8. Reduced motion, page unmount or navigation interrupts presentation; domain
   completion is neither delayed nor fabricated by visual lifecycle.

The current stream deliberately sleeps 28ms between 36 trials. Do not add more
delay for ceremony. Separate computation from presentation if needed to deliver
the static reduced-motion experience; keep work bounded and interruptible.

## 4. File and concern ownership

All paths below are relative to `apps/theoria`. Existing directory guidance
continues to apply. Keep contracts → web/server dependency direction; neither
web nor server imports the other.

The table maps current owners for investigation and coordination; it does not
freeze the target file structure. Improve boundaries when the desired behavior
exposes mixed responsibilities or weak contracts, and update the ownership map
before parallel implementation begins.

| Owner area                                                                   | Owns                                                               | Excludes                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `app/web/view/home/HomePage.tsx`, `HomeHero.tsx`, `ImaginedPlaceDemo.tsx`    | Arrival and narrative assembly, single scene, reading order        | Networking, observation implementation, a second state machine     |
| `PlaceStage.tsx`, `PlaceArrangement.tsx`, `PlaceMarker.tsx`, `PlaceWalk.tsx` | Scene rendering, geometry presentation and contribution continuity | Digest/signature computation                                       |
| `PlaceControls.tsx`, `PlaceProposals.tsx`, `PlaceProposalCard.tsx`           | Brief, scenario selection and attributed decision                  | Optimistically editing committed evidence                          |
| `PlaceLineage.tsx`, `PlaceHowItsBuilt.tsx`, `ContentId.tsx`                  | Evidence, explanatory source and references                        | Invented accumulating history or runtime tracing                   |
| `placeViewModel.ts`, focused home projection modules if warranted            | Pure display derivations and identity resolution                   | DOM handles, HTTP, subscriptions                                   |
| `app/web/atoms/imagined-place*.ts`                                           | Requested/committed/render state and shared selection              | Styling and component construction                                 |
| `app/web/atoms/element-observation.ts`, `platform/`                          | Element-scoped resources and host boundary                         | Persisted DOM identities                                           |
| `app/web/view/primitives/`, `app/web/styles.css`                             | Reusable appearance and provider composition                       | Place-specific content and product decisions                       |
| `app/contracts/text.ts`, text token generator/safelist                       | Typography semantics and generated output                          | Per-component font overrides                                       |
| `app/contracts/`                                                             | Shared domain data schemas where actually needed                   | Putting a web-only interaction controller into the server contract |

Design files around coherent target responsibilities. Improve an existing
owner when it fits; split or replace it when it does not. Extract a component
for rendering or a projection for derivation—not to name every wrapper. Avoid
catch-all managers, speculative registries and directories of one-line style
adapters. Names and APIs should express the resulting design, not retain old
card assumptions or undergo cosmetic renaming without a responsibility change.
Migrate affected callers and delete superseded code. Preserve unrelated Docs
capabilities without treating its current styling as an immutable standard.

## 5. Visual and interaction requirements

- Establish an opening silhouette different from the current hero-over-demo
  card. World, invitation and consequence must form one composition. A CSS
  border deletion, accent swap or larger existing diagram is insufficient.
- Author the lighthouse, market and library separately using shared semantic
  vocabulary. Scenario-specific spatial character must not falsify coordinates
  supplied by the arrangement engine; atmosphere is clearly illustrative.
- Keep one dominant action, readable primary prose and subordinate instruments.
  Preserve clear input boundaries and selected/focus states while removing
  repetitive panels, pills and decorative chrome.
- Use the existing unaccepted proposal as a real first invitation; do not claim
  the already accepted neighbor contribution was just made by the visitor.
- Compact layout puts a contribution close to its scene, without persistent
  40vh pinning. Use content-driven breakpoints/container queries and logical
  reading order. Reflow must not lose drafts, selection, focus or search state.
- During trial scrubbing keep the control under the pointer/finger stable.
  Removing the nested prose scroller must not reintroduce a jumping slider;
  consider a stable preview measure plus an explicit expanded reading view.
- Pending and failed states carry the same quality as success. Keep last-good
  content legible and marked as previous where necessary. No blank replacement,
  success-shaped skeleton, simulated typing, or fake online participant.
- Hover is optional enhancement. Details, source, note and trial operations
  have keyboard/touch equivalents and useful accessible names. Tab/focus order
  follows reading order; Escape returns to a sensible surviving control.
- Light/dark/world colors remain token-backed and contrast checked. Validate
  focus and selections in forced colors using visible shape/text/system colors.
- Reduced motion is a fully composed static alternative, not the same large
  movement at a shorter duration. No scroll hijacking, mandatory introduction,
  autoplay sound, cursor replacement or motion-gated content.

## 6. Testing strategy: smallest real boundary

### Existing coverage to assess against the target

`test/worker/home.test.ts` exercises real POST builds, default acceptance,
merge/re-digest, two-node lineage and the Docs package exit.
`home-demo.test.ts` exercises trial stepping/return, stable preview geometry,
responsive widths, content-ID details, source annotations/reference anchors
and docs-preview keyboard dismissal/navigation.

`test/web/semantic-text.test.tsx` covers projection/whitespace behavior using
deterministic metrics. Happy-dom does not perform real layout and its observer
is stubbed there; those tests cannot prove typography, contrast or responsiveness.
No dedicated imagined-place atom lifecycle or observer-cleanup tests were found
in this inspection. These are priority additions, not claims the behavior fails.

### Layered additions

| Boundary        | Target tests                                        | Evidence                                                                                                                 |
| --------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Pure projection | Existing contract tests or focused `test/web/` test | Matching scene identity, provenance lookup, missing selection, origin/current semantics                                  |
| Atom/service    | Proposed `test/web/imagined-place-state.test.ts`    | Deferred A/B/C completions, debounce, interruption, previous-success/error, width isolation, coherent display pairing    |
| Render stream   | Proposed focused render test if state suite grows   | Previous-frame handling, new width/search interruption, preview invalidation, final result equivalence in reduced motion |
| React lifetime  | Proposed `test/web/element-observation.test.tsx`    | StrictMode attachment/cleanup balance, one live observer after remount, none after release/TTL                           |
| Real browser    | Extend `test/worker/home*.test.ts`                  | Roles, keyboard/touch flows, geometry, network count, stale/pending visual state, media preferences                      |
| Visual review   | Supervised dev preview plus inspected captures      | Composition, art direction, readable measure, non-default states, motion continuity                                      |

Use `@effect/vitest` Effect tests and scoped layers. Use TestClock for the
400ms debounce, Deferred for request ordering, and controllable services for
failure/interruption—not real sleeps or random races. Retain the service's
public seam when it is suitable; if injection is awkward, improve the owning
service/runtime boundary so production behavior is independently testable.
Do not duplicate production logic or add a test-only algorithm. Testability
is a production engineering requirement, not an excuse for an unrelated rewrite.

Mount UI tests through `test/helpers/react-mount.tsx`; supply deterministic
text measurement where layout is not the subject. Observe live resource counts
after lifecycle settles, not the total number of StrictMode setup invocations.

Browser work uses existing `test/worker/browser.ts` Effect wrappers and
`test/worker/platform/in-page.ts` for page-context operations. Add a wrapper
only for a needed browser capability. Register response waits before the
action, use retrying assertions/observable ready states, and capture page
errors. Do not leak raw browser globals into app code or add `async/await`
throughout tests. Controlled request delay/failure interception is for the
local test server only; successful integration cases still use the real Worker.

Test the user-visible relationship, not the implementation: no wrapper counts,
Tailwind-string assertions, `layoutId` inspections, or snapshots of file/export
inventories. Existing selectors may move with the redesigned structure, but
do not silently weaken the behavior they verify. In particular, a stable trial
control and usable complete text matter more than keeping today's scroll box.

### Visual matrix and evidence

- All three worlds × light/dark at 390×844 and 1440×900 for arrival and committed
  contribution. This is the minimum visual art-direction comparison set.
- Width/reflow checks at 320, 390, 768, 1024, 1440 and 1920; short landscape;
  200% zoom/text and 320px effective width. Use representative content extremes
  rather than a costly full Cartesian product of every failure and viewport.
- Pending, failed rebuild, initial failure, open details, trial preview and
  reduced motion at compact/wide representative sizes. Exercise forced colors
  for the actual controls and focused/open states.
- Inspect Docs index, a long API page and its navigation after shared chrome,
  typography or primitive changes.
- Wait for fonts, matching frame identity and settled geometry before stills.
  Record the state and viewport. Never use arbitrary waits as readiness proof.
  Keep reviewed artifacts under `.amp/in/artifacts`; discard intermediate noise.
- Capture a short clip for contribution continuity/reversal when timing is the
  question. Inspect it. Still images do not prove reversibility or keyboard use.

Core accessibility checks include meaningful headings/landmarks, names and
state, contrast (4.5:1 ordinary text, 3:1 large text and applicable non-text
controls), focus visibility/not obscured, target size, touch equivalents and
motion preference. Aim for comfortable 44px targets while checking WCAG 2.2
AA's actual target-size rules/exceptions. Automated checks do not establish
screen-reader usability; include a manual pass when an assistive reader is
available and report that limitation otherwise.

### Performance

Record baseline and changed build assets, request count, layout shifts and
main-thread stalls using the same browser, viewport, throttling and interaction.
Profile initial load, merge, resize during search, scenario switch, and first
opening of code. Repeat noisy measurements and report conditions, not one
unqualified score. Verify finite animation settles and background work releases.

[Core Web Vitals](https://web.dev/articles/vitals) targets are LCP ≤2.5s,
INP ≤200ms and CLS ≤0.1 at the 75th percentile, segmented mobile/desktop.
These are field goals, not something an orb screenshot or Lighthouse load
proves. Lighthouse's TBT is not INP. Use local measurements to diagnose
regressions; do not add telemetry/shared infrastructure as incidental scope.
Any heavier font/asset/animation dependency needs measured benefit and cost.

## 7. Sequence, commits, and parallel ownership

One standalone feature PR; reviewable commits inside it. Use a dedicated local
feature branch from the current local `main` that includes the brief commit.
Do not reset to `origin/main` and lose that unpushed work. Another checkout
must receive local commits explicitly (patch/bundle/file transfer), not assume
that naming this branch makes them available.

| Stage / suggested commit                                                         | Dependency             | Definition of done                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. `docs(root): define homepage experience redesign brief`                       | Complete               | Brief committed before implementation planning                                                                                                                              |
| 1. Planning/baseline checkpoint                                                  | 0                      | This plan reviewed; current app commands run; baseline captures/performance recorded; current contracts and file ownership settled                                          |
| 2. `refactor(root): prepare homepage presentation boundaries` only if needed     | 1                      | Necessary extraction/injection seam preserves behavior; targeted tests pass; no art-direction change bundled into refactor                                                  |
| 3A. `fix(root): keep homepage scene and evidence coherent` if tests expose a gap | 2, or 1 if no refactor | Requested/committed/displayed identity and A/B/C failure tests pass; no fabricated success; not a speculative state rewrite                                                 |
| 3B. `feat(root): establish homepage visual vocabulary`                           | 2, or 1                | Token/type/control source updated with generated output; light/dark and Docs consumers inspected; no competing token authority                                              |
| 4. `feat(root): compose place-led homepage arrival`                              | 3A and 3B              | Real first scenario and invitation work at compact/wide; one scene instance; pending/failure and reduced motion are usable; inspected captures establish the new silhouette |
| 5A. `feat(root): connect contributions to the displayed place`                   | 4                      | Merge/reverse/pending/failure continuity proven; stable focus and identity; static alternative complete                                                                     |
| 5B. `feat(root): reveal homepage evidence progressively`                         | 4                      | Lineage, details, source and trial access preserve truth and existing behavioral coverage; keyboard/touch complete                                                          |
| 6. `feat(root): complete homepage scenario art direction`                        | 5A and 5B              | All three worlds and both themes composed; responsive alternatives, technical depth and shared theme coherent                                                               |
| 7. Focused fix/test commits followed by final evidence update                    | 6                      | Full gates and visual/accessibility matrix pass or explicit blockers remain; no home-only obsolete code; PR evidence maps to final tree                                     |

Tests belong with the behavior they protect in each commit. RED → GREEN is a
local development process, not permission to publish a sequence of knowingly
broken commits. Record the failing test before the fix; commit green behavior
and tests together. Keep formatting/renames narrowly scoped. If a refactor is
not needed, omit that stage rather than invent work to fill the table.

Stage 1 includes the target-state assessment above, not merely a baseline
inventory. Stage 3B includes the theme/design-system deliverable, not merely
restyling existing tokens. Add focused foundation commits where that assessment
requires them; complete and validate affected consumers before dependent work.
Stage 4 must demonstrate the desired visual and interactive quality, not just
that the old behavior still works in a new layout. Findings from that prototype
can reopen foundation decisions; the sequence is not a reason to accept weak
typography, primitives or state contracts as already finished.

### Parallelism that earns its coordination cost

Default to one implementer for the visual spine. Do not split hero, stage,
responsive composition and motion among competing designers before their
relationship is proven in stage 4.

- After stage 1, state/lifecycle work (3A) can run independently of tokens and
  primitive appearance (3B), with explicit interfaces and disjoint edits.
- After stage 4, the stage/contribution owner (5A) and evidence/source owner
  (5B) can work in parallel if shared selection identity and props are fixed.
  Both request integration edits to `ImaginedPlaceDemo.tsx` from its owner.
- A bounded browser-test or accessibility task can run against a fixed commit
  while implementation continues elsewhere. Its report must name the tree
  inspected; it is not approval of subsequent edits.
- Do not parallelize three scenario implementations against `styles.css` and
  `PlaceStage.tsx`. One owner integrates the scenario family for coherence.

Single-writer files: `styles.css`, `contracts/text.ts`, generated text output,
`designSystem.ts`, `App.tsx`, `ImaginedPlaceDemo.tsx`, shared atom identity
contracts, and `test/worker/browser.ts`. Assign each explicitly before work.
File ownership is not enough if two tasks change the same logical contract;
those tasks must sequence even when their filenames differ.

Use isolated worktrees/checkouts for separate coding owners. A handoff states:
base commit, owned files/concern, exported contracts, requirements/non-goals,
tests with decisive output, screenshots inspected, concerns and dependency
commits. The integrator reads the diff, applies commits in dependency order,
and runs combined verification. Text messages alone do not transfer code.
Avoid concurrent formatters, Git index edits or build-output writers in one
checkout. In particular `dist/`, `.wrangler-out` and generated docs cannot be
rebuilt while a browser test is reading them.

Keep the branch history readable; no history rewrite, push, PR publication,
merge or deployment without the corresponding authorization. Do not amend the
already-requested brief commit to conceal later planning changes.

## 8. Verification commands and definitions of done

All commands use Bun. Run app-scoped commands from `apps/theoria`, or use the
existing root filter. For development in this orb use `amp orb services ensure`
and the declared fixed 5175 frontend; retain the supervised service workflow.

During a work unit, run the targeted app check/test and inspect affected UI.
For typography, `bun run gen:text-tokens` emits output to review; do not assume
it wrote files. Markdown uses the repository's Prettier, source uses dprint.

Before a code commit, follow repository-required checks, not just an assumed
Git hook. The checked-in `.husky/pre-commit` exists, but this orb's configured
hooks path is outside `.husky`; hook execution must not be claimed from the
presence of that file. Never bypass failing checks to create a green narrative.

Full integration gate from repository root:

```bash
bun run check:all && bun run lint && bun run test && bun run build
bun run check:apps && bun run test:apps
bun run --filter @theoria/theoria-app deploy:dry-run
bun run --filter @theoria/theoria-app build:check
bun run --filter @theoria/theoria-app test:worker
```

`bun run build` includes the app's `build:web`. If running only focused browser
checks, first run `bun run build:web && bun run deploy:dry-run` in the app.
`test:worker` consumes the existing deployable bundle and does not rebuild it;
running it against stale output verifies the wrong tree. `deploy:dry-run`
packages locally; it is not a deployment. Keep Worker file parallelism disabled
as configured rather than accelerating it blindly.

### A work unit is done when

Its contract is satisfied, behavior is tested at the owning boundary, changes
are scoped, affected UI is inspected in representative states, resources are
released, and handoff evidence names exactly what was run and what remains.
“Types pass,” “screenshot captured,” or “agent finished” is not enough.

The owner must also show how the affected concern meets target quality and
which gaps were resolved. “Unchanged from baseline,” “already implemented,” or
“existing tests pass” cannot close a known design, interaction or engineering
gap. A blocker is reported as a blocker, not reclassified as acceptable reuse.

### The feature PR is ready when

The complete three-scenario experience—not only one polished arrival—meets
the brief; all integration gates pass on the integrated tree; the visual and
interaction matrix has been inspected; Docs consumers remain usable; actual
state/evidence remains truthful; performance regressions are resolved or a
specific tradeoff is made explicit; and a reviewer can assess the final
experience through a working preview and a small representative evidence set.

The theme and design system must be demonstrably suitable for that experience,
including responsive typography, authored light/dark treatments and complete
interaction states. Better than the old homepage is not, by itself, done.
Review against the target standard independently of the before/after comparison.

The PR description should link both documents, explain the changed visitor
journey, list exact verification and limitations, and distinguish technical
correctness from subjective art-direction approval. Do not claim usability
research, field performance, screen-reader testing or browser coverage that
was not performed. Publication and merge are separate from local readiness.

## 9. Pitfalls to reject during review

| Anti-pattern                                                 | Better decision                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| De-card and call it visionary                                | Review new composition, invitation and emotional consequence     |
| Enforce an arbitrary border/shadow quota                     | Preserve useful boundaries; judge hierarchy visually             |
| Invent live AI, neighbors, history or execution traces       | Show only supported facts; label recorded/explanatory material   |
| Animate requested intent as recorded success                 | Distinguish intent, commit, rendering and visual acknowledgement |
| New title/evidence over an old unlabelled frame              | Pair display identity or explicitly identify previous rendering  |
| `concurrent: true`, uninterruptible work or extra registries | Reuse latest-work lifecycle and test cancellation/release        |
| Keep DOM atoms alive to fix lost writes                      | Follow mounted-element identity and callback-ref ownership       |
| Put every hover/scroll value into durable domain state       | Local/provider mechanics or a justified shared identity          |
| Replace Base UI semantics with styled role attributes        | Preserve provider behavior and test actual keyboard flow         |
| Force every code line to be interactive                      | Contextual explanation with manageable focus order               |
| `domAnimation` plus assumed layout continuity                | Correct Motion feature boundary and executed interaction check   |
| `MotionConfig` treated as global motion disable              | Explicit CSS/SVG/search static alternatives                      |
| Hand-edit generated CSS or dynamically concatenate utilities | Canonical text semantics, generated output, static classes       |
| Hide overflow to make screenshots pass                       | Fix geometry; preserve accessible complete content               |
| Mobile sticky miniature plus reordered DOM                   | Recompose around task/consequence and coherent reading order     |
| Parallel visual owners editing shared files                  | One visual spine, bounded handoffs and serial integration        |
| Screenshot snapshots or passing unit tests as full proof     | Browser behavior, inspected captures, and honest limitations     |
| Rewrite the app to make testing easy                         | Minimal existing service seam and tests of real behavior         |

This document is a plan, not a record of completed implementation checks.
