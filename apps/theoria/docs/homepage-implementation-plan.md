# Homepage redesign: engineering and delivery plan

Status: corrective implementation proposal, 2026-09-06, after user rejection
of the unapproved visual identity change and Oracle consultation. No renewed
implementation is authorized by this document. The user owns design approval;
the [experience brief](./homepage-immersive-surface.md) proposes the experience,
and this document defines execution, boundaries, tests and acceptance gates.
Keep both in the standalone homepage PR. The original brief
was committed first as
[`6820728`](https://github.com/scenesystems/theoria/commit/6820728863a7653ef0bf8d363c3c249af338d620)
(local commit at the time of writing; the link is available remotely after push).

## 1. What implementation must accomplish

Deliver the user-selected composition, not a primitive cleanup disguised as a
redesign: place-led arrival, adjacent real contribution, recognizable
consequence, three authored scenarios, optional technical depth, and useful
compact-screen composition. Preserve the demo's recorded-example disclosure,
real build evidence, and presentation-only arrangement controls.

### Governing posture: target quality within established identity

The target is the best production-grade experience within Theoria's established
identity: Figtree display/body, JetBrains Mono technical text, cool blue-white
light and blue-black dark palette family. These are requirements, not candidates
for replacement. Existing implementation is not proof of target quality.
“We already have it” is never sufficient justification for retaining it or
declining an improvement. A passing regression suite is not an aesthetic,
interaction, accessibility or architectural quality certificate.

Define the desired experience and its quality criteria first. Then assess each
affected implementation against them and choose to retain, enhance or replace
it within that identity boundary. Prefer the simplest design that fully meets
the target, not the smallest diff that leaves the target unmet. Improvements
to the theme, design system, interactivity and their engineering foundations
are first-class deliverables, not incidental polish or optional follow-up.

Replacing fonts, base palette/material language or broader brand treatment
requires separate explicit user approval before implementation, including
homepage-only substitutions. No agent comparison, research recommendation or
green test can grant it. Shared changes require a demonstrated quality gap,
affected-consumer list and before/after evidence, not incidental Docs restyling.
Contrast adjustments within existing families, hierarchy, semantic roles,
spacing and controls can improve substantially without a rebrand. If the
boundary is ambiguous, present a comparison and seek a decision.

Assess assets, primitives, modules and rendering techniques against specific
experience needs, accessibility, performance and maintenance. Do not invent
infrastructure or retain inadequate APIs merely because they exist. Asset
benefit/cost does not override identity approval requirements.

Discovery authorization and production authorization are separate. Gate 1A
authorizes bounded comparison/probe work, not a selected design. Gate 1B
records the user's selection and authorizes prerequisite fixes and its slice
after the relevant feasibility decisions. Gate 2 approves a named rendered
slice before expansion; Gate 3 accepts the final integrated design. Material
departures reopen the relevant gate. The user's subsequent instruction to commit,
push and begin this coordination plan authorizes Gate 1A discovery. New bounded
workers may start under that gate; archived experiment threads remain archived.

### Dispatch authority and current readiness

**Current status: GATE 1A DISCOVERY AUTHORIZED; PRODUCTION IMPLEMENTATION BLOCKED.**
The composition has not been selected/approved and technical verification below is outstanding.
This plan resolves how decisions and failures are handled; it does not claim
that unimplemented behavior has passed, or that research eliminates unknowns.

Authority order: latest direct user instruction → applicable repository rules
→ recorded user-approved direction → contracts and acceptance in this plan
→ task packet. Agent messages, proposed designs and historical briefs are
evidence, never authorization. The brief owns experience hypotheses; this plan
is the single authority for task sequence, technical acceptance and risk status.
If they conflict, **stop dispatch and correct them**, rather than choose a
convenient interpretation. Do not let later worker prompts silently amend either.

There are three distinct statuses for each risk: **decision settled** (the
required behavior is specified), **proof outstanding** (implementation or
verification still needed), and **closed** (named evidence satisfies it).
“Documented,” “probably safe,” and “previously green” do not mean closed.
Unknowns block their dependent task, not unrelated read-only research.

| Risk / current status                                                | Resolution and proof required                                                                                                                                                                                                                                | Accountable owner / blocked successor                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| R1 Identity replacement: decision settled                            | Preserve families, cool palette and product identity. Existing hex values remain the starting point; each proposed shared token change names its role, reason, consumers and comparison. No blanket token replacement. User approves any identity departure. | Coordinator / all visual dispatch                                              |
| R2 Composition: user decision outstanding                            | Select one hypothesis from the brief using identical content/identity and compact/wide before/after-contribution storyboards. Approve a named revision; no worker chooses the alternative independently.                                                     | User decision; coordinator records / visual slice                              |
| R3 Display coherence: proof outstanding                              | Scene/title/proposals/evidence/source SHA all come from the same originating envelope; retain the whole display on pending/failure. Request and rendering status remain independent. Execute A/B/C ordering and failed-render cases.                         | State owner / integrated visual slice                                          |
| R4 Reduced-motion scheduling: decision researched, proof outstanding | Final-only output with all trials available, cancellation between bounded work units, no presentation pacing. Trial computation must return to host; test through actual Atom runtime and real browser, not only TestClock.                                  | State owner / static-state acceptance                                          |
| R5 Measured text/reflow: observed source mismatch, proof outstanding | Baseline `card-summary` is 16/26 in `contracts/text.ts` but mobile CSS paints 15/22; `PlaceStage.Lines` fixes absolute line boxes. Resolve painted/measured agreement and user spacing without clipping, shrinking text to fit or hiding missing prose.      | Visual owner with measurement contract / geometry and accessibility acceptance |
| R6 Font availability: proof outstanding                              | Exercise delayed/blocked font requests as well as loaded fonts; fallback must remain readable. Re-measure/invalidate affected cached geometry when fonts resolve if required. Do not certify by waiting for fonts in every test.                             | Visual owner / text acceptance                                                 |
| R7 Retained old scene in a narrower viewport: proof outstanding      | A retained frame uses its own geometry, never the new width with old coordinates. It must not overflow the page while replacement search is pending. Explicit readable fallback/local exploration if needed; no scaled-away text or targets.                 | State contract then visual owner / responsive acceptance                       |
| R8 Interaction/focus: decision settled, proof outstanding            | Stable focus and reversibility; stale-scenario proposal cannot change newly requested scenario; trial slider remains stable with complete prose accessible. Keyboard, touch and non-drag pointer paths required.                                             | Visual owner / contribution/evidence acceptance                                |
| R9 Verification coverage/environment: source gaps identified         | Existing Worker harness is Chromium-only; add missing homepage delayed/failing response, reduced motion, spacing and input cases through existing Effect wrappers. Record any additional engine/device/assistive-reader gaps, never imply coverage.          | Verification owner / final evidence                                            |
| R10 Integration drift: decision settled                              | One visual owner, fixed base/contract per packet, serial cherry-picks and generated-output writes, full combined checks; any later change invalidates affected evidence. No dispatch on obsolete experiment branches.                                        | Coordinator / every integration                                                |

In this ledger, **state owner means the technical owner**, responsible for
state/render mechanics, not a second visual designer. For R5/R6, the visual
owner specifies typography and reading treatment; the technical owner owns
measurement, cache/font invalidation and geometry mechanics. R7 follows the
same technical-contract → visual-presentation handoff. Shared-file changes are
assigned serially as specified in section 7, not inferred from this shorthand.

R1/R10 are policy decisions, not proof of a future diff. R3–R9 remain open
until their tests/reviews run. Before production implementation, a specifically
authorized bounded feasibility probe must settle the implementation approach
for R4–R7 where source reading cannot establish behavior. Minimal experimental
source changes and instrumentation are permitted only under its isolated probe
packet, with no production integration. That is not permission to implement
the new composition, change identity, import the old checkpoint wholesale or
design a new platform framework.
If it exposes a need for a broader contract/renderer change, return a decision
with alternatives and evidence; do not quietly expand the visual owner's task.

### Target-state assessment before implementation

For each affected concern, record: target quality, observed gap, proposed
retain/enhance/replace decision, owning module, affected consumers, and evidence
required to accept it. A retained implementation needs a reason tied to the
target just as a replacement does. This is a decision section in the delivery
record, not a new governance framework or inventory of every repository file.

Required assessment areas:

- **Theme and typography:** expressive hierarchy within Figtree/JetBrains Mono,
  readable measures, responsive scale, cool light/dark color semantics,
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

Improve typography, color semantics, space, surfaces, controls, feedback and
motion within the established identity. Prototype the improvements in actual
arrival, contribution, reading and details before treating tokens as settled.
The system must support all three worlds and both themes without per-component
patchwork. Improve semantic roles, variants and generation tooling where needed;
do not make the new experience conform to inadequate old APIs or token scales.

Validate affected shared consumers for capability, accessibility and identity.
Do not use “Docs still works” to approve an unrelated appearance change.
Migrate callers and remove superseded implementations
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

### Excluded experiment and unresolved evidence

The restored code baseline is
[`9c3f99f`](https://github.com/scenesystems/theoria/commit/9c3f99fc7b378896d5325994c5067cb361aaa7fc)
on local `homepage-regroup`. The previous coordinator branch preserves the
isolated state checkpoint; archived child threads preserve experimental work.
None is part of the regroup baseline or automatically authorized for reuse.

The state candidate captures the whole originating success envelope in
`frame.source` and derives a displayed build/SHA/frame projection. This is a
candidate approach to coherent display, not a new server identity or history
service. It still needs review, separate build-status/lifecycle subscription,
and tests of retained display on request/render failure before integration.

Post-checkpoint tests reported a real responsiveness limitation: Atom's
`SyncScheduler.flush` can drain `Effect.yieldNow()` synchronously, so final-only
reduced-motion search could finish before the host observes pending work.
Static output is not proof of host responsiveness. Version-specific source
research now supports trying `Effect.sleep(Duration.zero)` at the render owner,
before expensive initial work and between trials: Effect 3.22.1's live clock
uses an interruptible `setTimeout`, even at zero. This is a preferred feasibility
candidate, **not a verified fix** and not a guarantee that an individual trial
is short enough. Do not add a new browser scheduler service by default.
Test cancellation/input through the actual Atom/browser
path separately from deterministic final-result parity and manual trial access.
An earlier green checkpoint cannot override stronger subsequent RED evidence.

Test clocks must match the actual boundary: Effect TestClock for Effect search
work, restricted host fake timers where Atom debounce/TTL uses host scheduling.
Pending replacement text-layout layers may retain previous services; gate
search directly rather than assuming layer replacement stalls rendering.
Prove interruption receipt, eventual release and late-publication exclusion;
do not add a semaphore solely because interruption finalizers briefly overlap
without a demonstrated harmful shared-resource invariant.

Version-pinned research checked against the installed published sources:

- [Effect 3.22.1 clock](https://github.com/Effect-TS/effect/blob/effect%403.22.1/packages/effect/src/internal/clock.ts):
  `ClockImpl.sleep` calls `core.async`; its default scheduler uses `setTimeout`
  and a `clearTimeout` canceler. The newer-source claim that zero sleep becomes
  `yieldNow` does not apply to this locked version.
- [Atom 0.7.0 execution](https://github.com/tim-smart/effect-atom/blob/60bcae0d6824af59b5887fd09466c5dca6a07855/packages/atom/src/internal/runtime.ts):
  `runCallbackSync` creates and flushes `SyncScheduler`; cooperative fiber yield
  is not necessarily host yield.
- [Atom 0.7.0 debounce](https://github.com/tim-smart/effect-atom/blob/60bcae0d6824af59b5887fd09466c5dca6a07855/packages/atom/src/Atom.ts)
  uses native `setTimeout`/`clearTimeout`, **not Effect.sleep**;
  [TTL eviction](https://github.com/tim-smart/effect-atom/blob/60bcae0d6824af59b5887fd09466c5dca6a07855/packages/atom/src/internal/registry.ts)
  uses `Date.now` and host timers. A conflicting research summary was rejected
  after direct source verification. Recheck these contracts on dependency upgrades.

### View/state handoff contract

Agree these behaviors before either owner codes against the other's exports;
the originating-envelope approach is the preferred API candidate, not an
instruction to import the failed checkpoint wholesale.

- `placeControlsAtom` remains requested intent, including the 400ms debounce
  interval before network waiting begins. Do not derive “updating” solely from
  `Result.waiting`; compare intent with displayed scenario/brief/accepted records.
- The proposed `placeDisplayedAtom` is a Result of build, originating build SHA
  and **shown** frame (including trial preview), derived from `frame.source`.
  All claims about the drawn scene use that projection. Read build status
  separately so retained display does not conceal failure or release its owner.
- Proposal toggles read current requested state via functional update. Both
  remain reversible during same-scenario rebuilding. When requested scenario
  differs from displayed scenario, disable those old proposal actions with a
  visible explanation; keep scenario/brief controls and retry accessible.
  Preserve the current scenario-switch policy for acceptance flags; changing
  that domain policy is a separate explicit decision, not layout discretion.
- Recorded labels use `record.accepted`, not switch intent. Before any frame,
  a successful build may supply an explicitly labelled readable result while
  drawing is unavailable; never pair it with an unrelated retained drawing.
- Build retry refreshes build work; render retry refreshes presentation only.
  Width, preview and motion preference changes must issue zero build requests.
  Initial failure has no fake scene; failed rebuild retains identified last-good
  scene; failed replacement render retains coherent previous display and status.
- No initial-arrival success wash, no request-driven highlight on retained IDs,
  no late A success after C, no animation-gated semantic update. Use persistent
  named attribution first; exact sentence highlight requires a source-span
  contract and cannot be improvised by the visual owner.
- Preview is scoped to its search; new width/build clears it. On scenario
  change close invalid details and return focus to the surviving scenario
  control if necessary; do not automatically move focus on a successful merge.
- OS reduced-motion preference is the one authority for Motion, CSS/SVG and
  search alternatives; conservatively static while unknown. Live preference
  change may restart presentation only, preserves final-result parity, and
  never changes recorded acceptance or build identity.

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
capabilities and established identity; document any shared visual quality change.

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

Use `@effect/vitest` Effect tests and scoped layers. Use Effect TestClock for
Effect-scheduled work and restricted host fake timers for Atom debounce/TTL
where appropriate. Use Deferred for request ordering and controllable services
for failure/interruption—not real sleeps or random races. Retain the service's
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

### Executable acceptance cases (required, not optional examples)

Each row must have a named test or an explicit manual procedure and recorded
result. Assign the row to a packet; never treat this as a menu. Unit fixtures
control timing/failures; real successful builds still run through workerd.

| ID / boundary                 | Setup and action                                                                                    | Pass condition                                                                                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 / atom + browser          | Initial build success, request failure, malformed envelope, then retry                              | Honest initial state, typed failure and actionable retry; no phantom evidence. Retry succeeds without duplicate observers.                                                                                                         |
| T02 / atom + browser          | Display A; edit/toggle B; hold B request; release B but hold its render; then allow its frame       | Intent responds even within debounce. Every displayed title/proposal/signature/lineage/source link remains A until B's matching shown frame, then all are B. No source SHA from the running shell substituted for originating SHA. |
| T03 / atom + browser          | Fail B build and separately B render with A retained; retry each                                    | Identified coherent A remains usable. Build retry issues build; render retry issues no build. Pending and error channels are not erased by `Result.value`.                                                                         |
| T04 / atom                    | Deferred A→B→C, rapid reversal and scenario changes; attempt late completion after interruption     | No superseded result or announcement; requested controls are latest; obsolete work receives interruption and eventually releases. No semaphore introduced for harmless finalizer overlap.                                          |
| T05 / atom + browser          | Display A; request another scenario; activate old proposal; switch again                            | Old-scenario proposal action is disabled and explained; no wrong-world mutation. New selection replaces brief and preserves existing acceptance-policy semantics.                                                                  |
| T06 / browser                 | Kept and non-best trials; pointer selection, keyboard arrows/Home/End/Escape, non-drag pointer path | Shown trial/value text/scene agree; return to best works; slider top/height moves no more than 1 CSS px while scrubbing (same viewport and scroll); complete text is accessible without an obscuring overlay.                      |
| T07 / atom + browser          | Resize wide→320 during pending search and active preview, then back; change width preset            | Zero build requests; IDs/SHA unchanged; preview invalidated for new search; no page overflow during retained-frame interval or after settlement. One scene/observer lifecycle, not hidden duplicate mounts.                        |
| T08 / atom + browser          | Initial OS reduced motion; change preference live; manual preview                                   | 36 identical seeded trials and same final arrangement/losses as animated mode; static mode emits final only and preserves trial access. CSS/SVG/Motion movement absent where disabled, not merely shorter.                         |
| T09 / actual Atom + browser   | Trigger reduced search; schedule competing input and cancel before completion                       | Host services work between bounded compute chunks; no late final publication after cancellation; measured task/response budget below passes. Fake timers alone do not close this row.                                              |
| T10 / React + atom            | StrictMode ref replacement, detach/remount, then release configured TTL and dispose registry        | Exactly one observer per live element after settling; listeners/fibers released at their real lifetime; no detached element retained, stale report or build on remount caused by leaked owner.                                     |
| T11 / browser                 | Normal/delayed/blocked font load, compact breakpoint, 200% enlargement, text spacing overrides      | Painted text and measured geometry agree or a truthful fully readable alternative handles the state; no clipped/overlapped/lost text, stale font measurement or false fallback success.                                            |
| T12 / browser + manual access | Keyboard/touch entire journey, open details then change scenario, forced colors                     | Visible focus, names/states, logical reading order, dismissal/focus return, equivalent non-hover/non-drag controls, correct status announcements. No duplicate semantic scene.                                                     |
| T13 / real Worker             | All scenarios, both offers accepted and reversed, lineage/note/source/reference/package exits       | Actual recorded acceptance, cryptographic evidence and source links remain intact; recorded inference explicitly identified. Disclosure does not claim to perform cryptography.                                                    |
| T14 / browser + visual        | Docs index, long API page and navigation in light/dark after shared changes                         | No unapproved identity change or loss of reading/navigation/focus/contrast. Show before/after for each changed shared role.                                                                                                        |

Use `[data-place-render-phase="complete"]` and the actual shown identity to
await search readiness. **Do not wait for slider value 36:** the slider is
zero-based 0–35 and normally selects the best index, not the last trial.
`animationsSettled` ignores infinite animations; also inspect active infinite
motion explicitly. `fitsViewport` cannot prove content hidden by overflow is
readable. Combine bounds checks with content completeness and actual operations.

### Accessibility procedures and thresholds

These are acceptance requirements, not a claim of audited WCAG conformance.
Use the [WCAG 2.2 requirements](https://www.w3.org/TR/WCAG22/) as the source,
not a library's accessibility label.

- Test 200% text enlargement separately from 320 CSS px reflow (including a
  1280-wide browser at 400% zoom where supported). Changing device pixel ratio
  or viewport alone is not browser zoom. The existing `setRootFontSize` helper
  does not enlarge pixel-sized roles; verify computed size actually changes.
- Apply all [text-spacing overrides](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)
  together: line height 1.5× font size, paragraph spacing 2×, letter spacing
  0.12em, word spacing 0.16em. No loss of prose, labels, controls or functions.
  Fixed measured line boxes are a known risk, not exempt because canvas measured
  them. Decide and prove a remeasurement or complete native-reading alternative
  in the feasibility probe; no clipping workaround.
- Ordinary text contrast ≥4.5:1; large text ≥3:1; applicable non-text controls
  and indicators ≥3:1. Check actual foreground/background combinations,
  including focus/selected/pending and both themes, not token names alone.
- Primary decisions, scenario selectors and standalone buttons target 44×44
  CSS px as this project's usability target. WCAG AA's minimum is 24×24 or
  its documented exceptions/spacing rule, not universally 44×44. Record any
  smaller target and its exact exception; never enlarge overlapping hitboxes
  over neighbors. Inline source links need usable focus and spacing.
- AA Focus Not Obscured forbids fully hidden focused controls; the project
  target is the entire focused control and indicator visible. Test sticky
  chrome, overlay collisions, short landscape height and enlarged text.
- One restrained live status region for meaningful build/render outcomes;
  avoid announcing every trial or moving focus to a status. Labels distinguish
  requested, displayed, failed and recorded. Screen-reader flow needs actual
  assistive-reader evidence; DOM/ARIA checks alone do not establish it.
- Test hover content's dismissibility, hoverability and persistence, and a
  touch/keyboard equivalent. Trial exploration needs a non-drag pointer path;
  keyboard support alone does not satisfy the dragging alternative requirement.

Current automated coverage uses Chromium. Before final readiness, record the
approved browser/device support matrix and execute it. Recommended minimum
additional checks: current Firefox and WebKit desktop, plus a real mobile
Safari touch/zoom pass and an assistive-reader pass. A tool's unavailability
is a reported blocker to that coverage, not permission to claim cross-browser
or screen-reader completion. Do not install a competing test framework.

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
Any heavier asset/animation dependency needs measured benefit and cost.
Those measurements never authorize replacing the font families or identity.

Proposed local performance gate to calibrate during discovery and ratify at
Gate 1B before dependent production work: same Chromium build,
390×844 and 1440×900, 4× CPU throttling, five repetitions per scenario for
merge, reversal, resize and reduced search. Report all runs plus median/max;
do not choose a favorable capture. Separate cold-load asset measurements from
warm interactions. Target no homepage-attributed uninterrupted task >50ms and
input-to-visible-control acknowledgement ≤200ms in each measured interaction;
the 400ms network debounce is not an excuse for delayed intent feedback.
Measure total search time separately; “no 28ms sleeps” is not a timing result.
Browser timer clamping and expensive preparation/individual trials still count.
If a single trial exceeds budget, yielding between trials is insufficient:
block R4 and decide whether finer work boundaries or off-main-thread execution
are warranted before changing architecture. Field INP remains a separate goal.
Record asset byte deltas and cold-load CLS; any increase or worse-than-baseline
result needs an explicit explained acceptance decision, not “probably small.”

## 7. Sequence, commits, and parallel ownership

One standalone feature PR with reviewable commits. Regroup starts from local
`homepage-regroup` at the linked planning baseline, not the experiment branch.
The remote `feat/homepage-living-atlas` was pushed at that planning baseline;
the state experiment was local only. Verify remote state before future handoffs,
distinguish local `main` from `origin/main`, and transfer any unpushed work
explicitly. The user has now authorized committing these revised plans and
pushing `homepage-regroup` for the new workers. No merge or deployment is authorized.

| Stage / suggested commit                                   | Dependency                               | Definition of done                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. `docs(root): correct homepage scope and approval gates` | Restoration                              | Both docs remove superseded permissions; experiment remains excluded; user-facing hypotheses and targets are concrete                                                                                                                                                |
| Human gate 1A: discovery authorization                     | 0                                        | User authorizes comparison boards and isolated probes, with scope, owners, investigation budget and decision approvers recorded; no design selection or production integration implied                                                                               |
| 1. Baseline and comparison boards                          | Gate 1A                                  | One visual owner authors comparable boards using actual content and retained identity; proposes typography metric envelope, measures, responsive reading treatment and shared-role changes. Coordinator records baseline and ownership.                              |
| 1a. Bounded feasibility decisions                          | Gate 1A; relevant metric proposal from 1 | Technical owner reports supported/rejected/blocked approach for R4–R7, evidence and production ownership. Independent scheduler work overlaps boards; metric-dependent work consumes their proposal. No production integration.                                      |
| Human gate 1B: production authorization                    | 1 and 1a                                 | User selects named board, accepts visible fallback/shared-role treatment and authorizes prerequisite fixes plus slice. Coordinator records evidence-supported technical approach and user-ratified budgets/support scope; blocked decisions resolved.                |
| 2. Necessary boundary refactor                             | Gate 1B                                  | Behavior-preserving, tested, no new composition; omit if not needed                                                                                                                                                                                                  |
| 3. State/render/measurement correctness                    | Gate 1B or 2                             | Technical owner integrates required state, measurement, font/lifecycle and host-response fixes with tests; explicitly assigned minimal view plumbing allowed; no appearance redesign hidden in refactor                                                              |
| 4. Complete first-scenario signature slice                 | Gate 1B and integrated stage 3 contracts | Arrival, Ship's bell intent/pending/inclusion/reversal, persistent named attribution and readable contribution, and actual displayed evidence path work at compact/wide in both themes including static/failure. Relevant V/T cases and shared-consumer checks pass. |
| Human gate 2                                               | 4                                        | Explicit user acceptance of named rendered revision before expansion; objections recorded, not agent self-approval                                                                                                                                                   |
| 5. Expand proven contributions and technical depth         | Gate 2                                   | Carry the already-proven recognition/evidence pattern through both proposals and complete progressive source/trial/lineage/brief flows; not first implementation of the signature consequence                                                                        |
| 6. Complete scenario family                                | 5                                        | All three scenarios, both themes and responsive states meet approved direction without brand replacement                                                                                                                                                             |
| 7. Hardening and evidence                                  | 6                                        | Full integrated gates, inspected visual/accessibility matrix, measured performance; blockers remain blockers                                                                                                                                                         |
| Human gate 3                                               | 7                                        | User accepts final integrated visual/interactive revision; publication and merge are separate actions                                                                                                                                                                |

Tests belong with the behavior they protect in each commit. RED → GREEN is a
local development process, not permission to publish a sequence of knowingly
broken commits. Record the failing test before the fix; commit green behavior
and tests together. Keep formatting/renames narrowly scoped. If a refactor is
not needed, omit that stage rather than invent work to fill the table.

Stage 1 assesses target quality, not merely inventory. Stage 4 includes justified
theme/design-system improvements in separate reviewable commits where useful,
not a speculative visual-vocabulary replacement before composition validation.
Validate affected consumers before accepting shared changes. The slice must
demonstrate the four visitor outcomes in the brief, not just old behavior in
a new layout. Findings may reopen foundation decisions within approved scope;
material composition/identity departures require renewed user approval.

### Authorized discovery records

The user authorized starting this coordination plan after committing/pushing it.
The coordinator assigns D1 and D2 to two new isolated worker threads and owns
D3 directly. Thread prompts must name the pushed plan commit as their exact base;
this is not the failed experiment branch or an arbitrary `origin/main` checkout.
The coordinator records the thread links in the parent conversation and checks
each restatement before releasing work. Gate 1B remains unapproved.

| Record                                       | Work and inputs                                                                                                               | Finite deliverable / exit                                                                                                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 / comparison / single visual owner        | Restored baseline, brief hypotheses, actual first-scenario content and identity constraints; no selected composition required | Comparable boards described in the brief, proposed role metrics/ranges and reading measures, shared-role delta list, compact/static/pending treatment, recommendation with rejection criteria. Selection is an output for the user, not a prerequisite. |
| D2 / feasibility / technical owner           | R4–R7, locked dependency behavior, D1's metric envelope for geometry/font work; scheduler portion can start independently     | One decision report for all four risks, containing a supported, rejected or blocked outcome per risk; actual experiment evidence, affected files/contracts, smallest production fix and owner, remaining acceptance IDs. No production cherry-pick.     |
| D3 / verification research / bounded support | Fixed baseline plus D1/D2 artifact revisions                                                                                  | Check harness/environment capabilities, propose executable browser/device/assistive-reader coverage and calibrate local performance targets; list missing resources and who must provide them. Report evidence limits, not redesigned UI.               |

**Initial investigation bound under Gate 1A:** one discovery round,
up to one working day of active effort per assigned owner. Each owner reports
earlier if blocked; expiry returns the current decision/evidence, not a claim
of success. The coordinator may not silently extend the round or add workers;
return the concrete remaining question and request authorization for additional
investigation. This is a maximum checkpoint interval, not a minimum time to
spend or permission to weaken quality. Probe completion is not production risk closure.

The coordinator evaluates technical evidence and recommends budget/support
decisions. At Gate 1B the user ratifies the proposed performance targets and
supported-browser/device scope, or explicitly delegates that decision; until
then these are recommendations, not user mandates. Verification identifies
unavailable real-device/assistive-reader resources during discovery so coverage
is not first negotiated at release. No tool limitation silently waives a gate.

Metric values and visual choices are authored by D1, then tested by D2 and
approved as a visible direction by the user. The user need not supply CSS
numbers to let planning begin. If D2 rejects the metric envelope, the visual
owner revises the boards within identity constraints and returns the comparison;
do not choose a new typeface or hide the mismatch. If resolution exceeds the
authorized discovery bound, report a blocked decision rather than loop forever.

### First required proof versus final coverage

- **Discovery:** feasibility subsets of T07–T11, not the entire unbuilt UI.
  Show actual scheduling/measurement/retention evidence; define production
  fixes and remaining proofs. Boards illustrate intended behavior, not tests.
- **Stages 2–3:** owning-boundary T01–T05 and T07–T11 for touched state,
  render, metrics and lifecycle contracts. Browser plumbing needed to observe
  them is explicitly assigned. These prerequisite contracts must pass before
  the new slice consumes them.
- **Stage 4 / Gate 2:** V01–V06 on the first scenario; first-scenario browser
  flows T01–T09 and T11–T14 applicable to the slice, plus T10 lifecycle evidence.
  Both offers and existing technical exits stay operable; the Ship's bell
  recognition/evidence loop is fully composed, not deferred to Stage 5.
- **Stages 5–7 / Gate 3:** all T01–T14 and V01–V06 at their full scenario/theme
  coverage, approved support/performance matrix and final integrated tree.
  Only coverage outside the explicitly bounded first slice is deferred;
  a failure within it blocks Gate 2. Record every deferred case and its owner.

### Parallelism that earns its coordination cost

Keep one visual owner throughout: opening, stage, proposals, evidence
presentation, responsive behavior, scenarios, shared tokens and motion. Do not
split these into competing designs even after the first slice is approved.

- During discovery, comparison and independent feasibility work can overlap;
  metric-dependent probes wait for D1's proposed values, not final approval.
- After Gate 1B, technical correctness fixes may run alongside bounded
  verification with disjoint files. New visual composition code starts only
  after stage 3's tested interface is integrated. Specifically assigned probe
  code and prerequisite view plumbing are not new composition work. Do not
  hand the visual owner an unfinished state checkpoint to consume.
- Nonvisual evidence derivations/tests may run independently against settled
  contracts. The visual owner still integrates their presentation and assembly.
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

### Coordinator dispatch checklist and task packet

No generic “make it best possible” task. Before creating a future worker thread,
the coordinator fills **every** field below in this document's delivery record
and copies the bounded packet into the prompt. No blank/TBD prerequisite may
be dispatched; the whole plan is context, not an unlimited work assignment.
Fields depend on work kind: comparison/probe packets explicitly list design
selection or unsettled contracts as outputs to resolve, not missing inputs.
Production packets require the actual selection/approval and prerequisite
contracts. Record `not applicable: discovery output` rather than fabricate approval.
The handoff field specifies the required return format before dispatch; actual
commits/results are recorded on return, never invented in advance.

```text
Task ID / stage / work kind: comparison, feasibility, or production
Role: technical, visual, or verification (one accountable owner)
Repository / exact base commit / branch / isolated checkout:
Plan revision + relevant Gate 1A/1B/2 authorization reference:
Selected composition for production; proposed composition output for discovery:
Outcome + mandatory acceptance IDs (T01–T14, relevant visual criteria):
Allowed files and owned concern; explicitly excluded files/behaviors:
Input contracts / contracts to resolve / prerequisite commits already integrated:
Allowed shared token/primitive changes and affected consumers:
Commands to run, browser states, measurements and artifacts to return:
Effort/iteration bound + stop conditions + decision approver:
Handoff commit(s), remaining changes, exact results and limitations:
```

The worker first restates its outcome, identity constraints, dependencies and
stop conditions **in a restatement-only response**, then waits. The coordinator
explicitly releases that packet before coding or generating comparison artifacts.
This catches misunderstood assignments; it is not delegated design approval.
Only the coordinator assigns follow-up work or changes ownership. No worker
starts another direction, changes contracts or launches nested delegation.

- **Technical owner (state owner in the risk ledger):** atoms/client-layer seam,
  render scheduling, measurement/cache/font-readiness mechanics, geometry inputs
  and their tests. Relevant owners include `app/web/text/browserTextLayout.ts`,
  `view/text/authority.ts`, `contracts/demo/imagined-place-flow.ts`, and assigned
  `PlaceStage` line/frame plumbing. No font-family choices, palette or new
  composition. Requests extra files/contract changes through coordinator.
- **Visual owner:** all homepage presentation, approved shared primitives and
  typography choices/generation; no request protocol, crypto, state-authority
  rewrite or substitute artifact data. Owns D1 and visual integration across
  every scenario. Specifies desired metrics; technical owner validates mechanics.
- **Verification owner:** bounded tests/probes against a named tree, including
  browser helper additions if explicitly assigned; no redesign or production
  fix bundled into a test handoff. Reports observed failure to its owner.
- **Coordinator:** plan/approvals, ownership, serial integration and final
  verification. Does not independently edit another owner's files or grant
  itself permission to replace user-approved design.

On a failed prerequisite, unsupported contract, changed approved composition,
unexpected shared-file need, missing browser capability or unexpected RED test:
stop the affected task, preserve work, report observation vs inference and
the smallest decision needed. Do not silently switch approaches, weaken tests,
waive a gate or transfer an unfinished checkpoint as ready for consumption.
Independent authorized work may continue only if it does not depend on that risk.
The expected RED reproduction named in a fix packet is normal TDD: its owner
continues to GREEN within the agreed contract. A different failure or a required
scope change invokes the stop rule; the coordinator owns reassignment.

For shared measurement/typography/`PlaceStage` edits, name the writer per
stage in the packet. Technical prerequisite plumbing lands first; ownership
then transfers to the visual owner for the selected composition. No concurrent
writers even when changes appear to occupy different functions. If the slice
exposes a contract gap: pause affected integration → coordinator assigns a
bounded technical delta → integrate/reverify → resume visual work. Reopen user
design approval only for a material visible/scope/identity departure, not every
internal fix within the approved contract. Budget extensions still need approval.

Coordinator integration is serial: inspect diff/ownership → verify base and
prerequisites → apply green commits → regenerate any affected output → run
combined gates → inspect affected rendering → update evidence/approval status.
Commit refactors separately from behavior; behavior and its tests travel together.
Verify the integrated tree, not an earlier worker screenshot or stale Worker
bundle. If integration fails, pause successors and fix in a distinct commit;
never reset away another agent's work or rewrite history to hide the failure.

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

Engineering verified, design ready for review, and design approved are distinct.
Only explicit user acceptance of a named revision closes a design approval
gate. Agent inspection, green suites, silence or another agent's recommendation
do not. A finished work unit does not authorize expanding past that gate.

Evidence records must contain tree/commit, test/procedure ID, browser/version,
viewport/theme/scenario/motion preference, setup/action, expected/observed
result, exact command and decisive output, inspected artifact link, and any
limitation. Missing coverage is `NOT RUN`; a failure is `FAIL`; neither is PASS.
Design acceptance separately names the user-approved revision. Later changes
invalidate affected records even when a worker previously marked them green.

The owner must also show how the affected concern meets target quality and
which gaps were resolved. “Unchanged from baseline,” “already implemented,” or
“existing tests pass” cannot close a known design, interaction or engineering
gap. A blocker is reported as a blocker, not reclassified as acceptable reuse.

### The feature PR is ready when

The complete three-scenario experience—not only one polished arrival—meets
the approved brief; all integration gates pass on the integrated tree; the visual
and interaction matrix has been inspected; Home/Docs retain established identity
and capabilities; actual
state/evidence remains truthful; performance regressions are resolved or a
specific tradeoff is made explicit; and a reviewer can assess the final
experience through a working preview and a small representative evidence set.
The user has explicitly accepted that integrated visual/interactive revision.

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

| Anti-pattern                                                         | Better decision                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Treat “best possible” as permission to rebrand                       | Preserve identity; make ambitious composition and interaction improvements |
| Agent-rendered comparison substitutes for user approval              | Explicit revision-bound human gates before expansion and final acceptance  |
| Treat candidate checkpoint's earlier green suite as production proof | Retest stronger RED evidence, actual host responsiveness and integration   |
| De-card and call it visionary                                        | Review new composition, invitation and emotional consequence               |
| Enforce an arbitrary border/shadow quota                             | Preserve useful boundaries; judge hierarchy visually                       |
| Invent live AI, neighbors, history or execution traces               | Show only supported facts; label recorded/explanatory material             |
| Animate requested intent as recorded success                         | Distinguish intent, commit, rendering and visual acknowledgement           |
| New title/evidence over an old unlabelled frame                      | Pair display identity or explicitly identify previous rendering            |
| `concurrent: true`, uninterruptible work or extra registries         | Reuse latest-work lifecycle and test cancellation/release                  |
| Keep DOM atoms alive to fix lost writes                              | Follow mounted-element identity and callback-ref ownership                 |
| Put every hover/scroll value into durable domain state               | Local/provider mechanics or a justified shared identity                    |
| Replace Base UI semantics with styled role attributes                | Preserve provider behavior and test actual keyboard flow                   |
| Force every code line to be interactive                              | Contextual explanation with manageable focus order                         |
| `domAnimation` plus assumed layout continuity                        | Correct Motion feature boundary and executed interaction check             |
| `MotionConfig` treated as global motion disable                      | Explicit CSS/SVG/search static alternatives                                |
| Hand-edit generated CSS or dynamically concatenate utilities         | Canonical text semantics, generated output, static classes                 |
| Hide overflow to make screenshots pass                               | Fix geometry; preserve accessible complete content                         |
| Mobile sticky miniature plus reordered DOM                           | Recompose around task/consequence and coherent reading order               |
| Parallel visual owners editing shared files                          | One visual spine, bounded handoffs and serial integration                  |
| Screenshot snapshots or passing unit tests as full proof             | Browser behavior, inspected captures, and honest limitations               |
| Rewrite the app to make testing easy                                 | Minimal existing service seam and tests of real behavior                   |

This document is a plan, not a record of completed implementation checks.
