# Theoria homepage: an imagined place you can change

Status: researched experience direction and implementation brief, revised
2026-09-06. This supersedes the earlier surface-migration checklist. It is
the brief for the standalone homepage redesign PR following the foundation
work in PR #85, not a claim that the redesign is implemented.

## The ambition

The homepage should let someone feel the possibility of imagination becoming
something shared, without asking them to understand a software stack first.
They arrive somewhere specific, discover that they can affect it, and see
that their decision has an intelligible consequence. Then they can look
closer and understand why they can trust what happened.

**An imagined place you can change. Every contribution leaves a trace.**

That is the experience thesis, not approved final marketing copy. Theoria
remains the open-source computational library collection; this demonstration
expresses a part of Scene's larger vision, not the full Scene product.
Theoria is the repository/product name used here; “Etheria” in the request
is not treated as authorization to rename it.

Removing nested cards is necessary but insufficient. An unboxed dashboard is
still a dashboard. Success requires a new arrival, art direction, narrative
hierarchy, participatory moment, and route into technical depth. The existing
Compose / Propose / Record / Arrange pipeline becomes the explanation beneath
the experience, not the experience's mandatory navigation structure.

The emotional progression is **curiosity → invitation → agency → recognition
→ trust → possibility**. Each feeling must have a concrete cause:

| Feeling | What produces it |
| --- | --- |
| Curiosity | An evocative, specific place already present on arrival |
| Invitation | One understandable thing to try, without setup or a tutorial |
| Agency | Accept or decline a contribution and see the place respond |
| Recognition | The contributor and their addition remain identifiable |
| Trust | Inspect the actual evidence and distinguish recorded from live work |
| Possibility | Understand how these libraries could support something of your own |

## Research and its authority

The sources below inform this direction. Prior agent recommendations are not
new user mandates, and decisions for Scene's consumer site do not automatically
become requirements for Theoria.

### Earlier conversations recovered

- [Frontend design skill research](https://ampcode.com/threads/T-01a02ac1-c543-736b-ba6a-61cff7ee20b3):
  a specific aesthetic thesis, one signature interaction, delight through
  competence and control, and responsive recomposition. Cards are justified
  by independent objects, not by every heading or metadata group. The research
  explicitly rejects mandatory preloaders, magnetic controls, custom cursors,
  and scroll hijacking as a recipe for “premium.”
- [Scene vision shift](https://ampcode.com/threads/T-01a03edf-7ddf-70bd-9d8e-c0c32416d736):
  the user's direct standard is sophisticated, polished, refined, and real;
  plural worlds emerge through collective imagination. Prior visual iterations
  exposed generic graphs, scribbles, regular grids, and obvious resets as poor
  substitutes for that feeling. Transfer the ambition and coherence, not the
  consumer homepage's specific particle renderer. Use “Scene” in new public
  product prose, not “Scene Systems.”
- [Design system branch plan](https://ampcode.com/threads/T-019ff097-5885-769c-8afb-1e6edc73a48b):
  shared measures, imagery-led editorial composition, meaningful responsive
  alternatives, provider-owned interaction mechanics, and explicit separation
  of product truth from its visual projection. Do not import its proposed
  package architecture into this app merely to implement a page.
- [Previous homepage review](https://ampcode.com/threads/T-01a06822-5e48-74fd-afcb-bcd5f3d83b9f):
  useful surface audit and foundation separation. Its proposal is superseded
  where it fixes the experience around four scrolling acts, prescribes a
  shrinking mobile stage, or treats border counts as the success criterion.
- [Imagined places demo](https://ampcode.com/threads/T-01a061d5-2378-7197-9988-70cc24e4233d):
  the functional predecessor. The current code and
  `imagined-place-landing-demo.md` remain the authority for what the demo does.

### External principles and how we use them

- [Bret Victor, Explorable Explanations](https://worrydream.com/ExplorableExplanations/)
  (read directly for this revision): integrate exploration into an authored
  explanation. Do not dump people into an empty sandbox. A visitor who does
  not interact should still understand the example; interaction answers their
  next question. The 2024 postscript emphasizes inspectable computational
  claims, not merely interactive pictures.
- [Material adaptive layout](https://m3.material.io/foundations/layout/applying-layout)
  and [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout)
  (recovered from prior research): preserve task, context, and consequence
  across sizes, not desktop geometry. Apply to the relationship between the
  invitation and the place, not to a prescribed number of columns.
- [Figma multiplayer](https://www.figma.com/blog/multiplayer-editing-in-figma)
  (prior research): attribution makes shared work understandable. Borrow the
  legibility of contribution, not fake presence or simulated collaborators.
- [Spotify Wrapped animation engineering](https://engineering.atspotify.com/2024/01/exploring-the-animation-landscape-of-2023-wrapped)
  (prior research): a coherent narrative can be personal and expressive.
  Borrow authored pacing and recognition, not a compulsory slideshow.
- [WCAG animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
  (read directly): nonessential motion must have an alternative; a real process
  is not automatically an essential animation. This criterion is AAA; adopt
  its reduced-motion behavior deliberately alongside the AA baseline.
- [Motion accessibility](https://motion.dev/docs/react-accessibility)
  (read directly): `MotionConfig reducedMotion="user"` disables Motion
  transform/layout animations, not all CSS, SVG, or per-frame updates. The
  arrangement renderer requires its own presentation policy.
- [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html):
  validate reading and interaction at narrow effective widths, not only a
  few device screenshots.

These references support principles, not a collage of other products' styles.
The creative direction below is a recommendation for this demo.

## Current experience: observation versus inference

This revision inspected the running local application in Chromium, including
1440×900 light arrival, the scrolled desktop demo, and 390×844 dark arrival.
The scenario radios, merge switches, tabs, marker buttons, and trial slider
are present in the accessibility snapshot. A merge switch was exercised; this
was an exploratory review, not a full end-to-end regression pass.

At the verified mobile scroll position zero, the main heading begins at
136px, “An imagined place” at 449px, the place title at 665px, and “How it's
built” at 3602px. No document-level horizontal overflow was observed in that
state. These are observations from this run, not universal layout constants.

The desktop arrival devotes its strongest hierarchy to the library category;
the place is partially visible lower down. In the demo, package pills, step
labels, version badges, a framed story, and framed proposals compete for
attention. Mobile exposes the title and only the beginning of the place before
the fold. The first meaningful contribution is much farther down.

The inference is not “the UI is broken.” The functional demonstration is
substantial. Its presentation prioritizes explaining implementation over
making someone want to participate. Its best asset—the literary specificity
of a lighthouse kept alight by unfinished letters—has less visual authority
than the controls explaining it.

The previous document's counts (59 bordered elements, 124 rounded elements,
74 pills, 19 shadows, maximum bordered nesting 5 at 1440×900) are historical
measurements, not re-measured numbers in this revision. They diagnose repeated
containment; they are not acceptance budgets. Removing useful focus outlines
to hit a border target would make the page worse.

## Recommended creative direction: a living atlas

Considered alternatives:

| Direction | Strength | Why it is not the whole answer |
| --- | --- | --- |
| Unframed editorial laboratory | Clear and technically credible | Still primarily an explanation of tools |
| Cinematic world portal | Immediate emotional scale | Risks unrelated scenery, heavy rendering, and a passive visitor |
| Living atlas with a participatory scene | Place, human contribution, and inspectable computation share one composition | Requires authored scenario treatment and careful causal interaction |

Choose the third. “Atlas” describes a spatial/literary reading experience,
not a generic map dashboard. The page is a broad field containing a place,
its words, and the people/programs contributing to it. It has a recognizable
silhouette even with labels and controls removed. It should not look like
the old page with its rectangles erased.

### Art direction, not just color themes

The three scenarios need different compositional character as well as palette:

| Place | Spatial and material direction | Emotional quality |
| --- | --- | --- |
| Unfinished Light | A long interval of open space, a restrained light-bearing focal point, a causeway-like reading direction, warm letter-like prose against cool surroundings | Solitude made sustaining through other people's participation |
| Lost Market | Unequal gatherings and meeting points, warmer mineral/paper tones, denser but deliberate typographic rhythm | Curiosity, exchange, unexpected recognition |
| Drowned Library | Spacious depth, quiet layered edges and cool ink, measured interruptions in the reading field | Discovery, care, the persistence of knowledge |

Keep the actual artifact's words and feature identities authoritative. Authored
atmosphere is illustration, not evidence of a simulation or invented spatial
facts. Start with lightweight CSS/SVG treatment, existing feature geometry,
and typography; do not add a 3D engine, video, or generated scenic image to
make the concept feel expensive. Any later asset must have a specific role,
rights/provenance, responsive treatment, and loading budget.

Use three visual registers: expressive place title, humane readable prose,
and quiet technical annotation. Explore the existing display face's scale,
weight and spacing before adding a font. Typography changes belong in the
semantic-text source and generated tokens, not manual edits to generated CSS.
Body prose remains on a readable measure; an expansive canvas does not mean
150-character lines. Large-screen whitespace should establish distance and
relationship, not simply stretch a narrow component.

Light and dark are separately art-directed environments, not just inverse
backgrounds. Scenario color must never replace participant identity, selected
state, error meaning, or readable text contrast. Hover and focus should feel
precise and local: a mark, rule, or label answers attention without lifting a
whole region into another card.

## The visitor's experience

### 1. Arrive somewhere, without waiting for an introduction

Put the place's title, a short evocative passage, and a meaningful portion of
the arrangement in the opening composition. Keep Theoria's identity and one
concise explanation visible. Recommended headline direction: “An imagined
place. Changed together.” Final copy must also make clear that this is a
recorded-example demonstration built with Theoria, not a live community.

One primary invitation: “Make room for one more idea,” leading directly to a
real proposal and decision. “See how it works” is the secondary path; Docs and
GitHub remain easy exits. Do not require a scroll journey or cinematic intro
to reach the demo. Do not use viewport-height locking that clips long titles
or translated/enlarged text.

### 2. Offer a contribution where its consequence is visible

Bring a proposal into the opening experience, beside the place on wide
screens and immediately adjacent on compact screens. Use the actual feature
name and contributor, a short explanation of what it adds, and the existing
merge switch. Keep both accept and decline legible and reversible. The
default already accepts the neighbor's feature: never pretend the visitor
just contributed it. The unaccepted program proposal provides a genuine
first action without changing the initial domain state.

The characteristic interaction is **a contribution becoming part of the
place**. A proposal's identity is visually connected to its resulting mark
and sentence. Recognition occurs once, at the committed change, not as
confetti or a perpetual glow. Declining is equally first-class: the proposed
contribution remains inspectable but does not appear as part of the result.

Use a shared-layout transition only if it preserves object identity and does
not yank text or focus across the page. A short local emphasis at the source
and destination is a valid alternative when either is offscreen. Do not turn
the existing scene into an animated cloud of unrelated discs.

### 3. Let curiosity choose the depth

After the first invitation, expose three understandable questions:

- What else could this place become? Scenario choice, brief, other proposal.
- What changed, and who offered it? Contribution comparison and lineage.
- How is this computed? Arrangement trials, source examples, package docs.

These are ordinary page landmarks and explicit controls, not compulsory steps
or a new router. The underlying Compose / Propose / Record / Arrange names
remain useful inside the technical explanation. Avoid automatic tab changes
while someone is reading code: explicit selection owns their attention.

Scenario choice is a small index of places with meaningful names and one-line
descriptions, not a row of package-like chips. A scenario change changes
composition and atmosphere together. Explain that it replaces the brief;
do not add persistence or invent a saved-world workflow.

### 4. Reveal evidence without turning everything into an inspector

Selecting or focusing a feature can show its contributor, description, and
available provenance in one contextual explanation. Hover is a preview, never
the only access. On touch use an explicit details action; on compact screens
place the explanation inline or in an accessible overlay with proper focus
return. Do not make every prose line a tab stop.

Show origin and current version as a readable relationship, with fingerprints
and signature details at the next level. Keep cryptographic terminology in
the evidence layer; explain its consequence in everyday language first.
The source tab can highlight a relevant operation, but a source-code mapping
is explanatory, not an execution trace. Do not claim line-level runtime
provenance that the result contract does not supply.

### 5. End with a possibility, not a catalog dump

Connect the experience back to the libraries through a small authored account:
structured composition, accountable contribution, reproducible arrangement.
Give the interested builder source and documentation links at the point of
interest, followed by a clear next action to explore the packages. Do not
append a generic grid of capability cards, invented metrics, or social proof.

## Truth and state are part of the design

The source already separates requested merge state from the last recorded
build. Preserve this distinction in every visual treatment.

| State | Visible behavior |
| --- | --- |
| Initial build | Stable scene-sized space, readable context and loading status; no fabricated successful artifact |
| Build ready, arranging | Actual artifact present; announce progress sparingly; distinguish arrangement from composition |
| Visitor changes a decision | Switch acknowledges immediately; “Updating this version” accompanies the still-committed scene |
| New build succeeds | New evidence and artifact become current together; then acknowledge the contribution visually |
| Build fails | Keep the last good place identified as previous; preserve requested choice, explain failure and offer retry |
| Rendering fails | Preserve the readable artifact and evidence; show rendering-specific retry, not a blank experience |
| Rapid reversals/scenario changes | Latest request owns the result; stale response/animation cannot reintroduce an old feature or announce success |
| Trial preview | Label the preview as a candidate, not a new signed version; provide an obvious return to the kept arrangement |

Non-negotiable boundaries from current code:

- Composer/proposer inference replies are recorded examples. Editing a brief
  is not free-form live generation. Say so next to the editor, not only in code.
- Digests, signatures, sealing and the browser arrangement search are real.
  Do not imply externally verified identity or a real neighbor online now.
- Lineage is origin/current for the build, not a durable accumulating session
  history. The previous plan's “grow a knot on every merge” would misrepresent
  it. Draw only versions that exist in `build.evidence.lineage`.
- Stage width and trial selection are presentation-only and must not rebuild
  or change content IDs. Removing borders must also correct drawable-width
  budgeting; it is not only a class-name edit.
- A note disclosure reveals a note already opened by the build. Do not stage a
  fake key acquisition or claim the disclosure click performed cryptography.

## Responsive composition and access

**Wide:** an asymmetric shared field. The place and immediate invitation are
visible together. Supporting reading uses a narrower measure; provenance can
occupy a quiet side region. Pin the scene only when the viewport has enough
height to make it useful, without an empty column lasting several screens.

**Medium:** retain a purposeful place/decision pairing when it fits; otherwise
recompose to a scene followed by its invitation. Do not wait for a familiar
device breakpoint after the content has already become cramped.

**Compact:** scene title and a useful excerpt/arrangement lead; a contribution
follows closely. No permanently shrinking sticky scene taking 40% of the
screen. Provide an explicit “Back to the place” anchor from deeper material
if needed. Prefer document scrolling over nested prose scrolling; an expanded
text view may complement, but never conceal, the readable artifact. Code can
have its own labelled horizontal scroller.

At high zoom, short landscape heights, or with a virtual keyboard, disable
optional pinning. Preserve focus, draft and selected proposal across
recomposition; do not mount two independent copies of the demo. Keep visual
and keyboard reading order consistent rather than relying on CSS `order` to
put the scene first while controls precede it in the DOM.

Use real landmarks/headings, visible focus, Base UI radio/switch/tab mechanics,
and comfortably sized targets (aim for 44px; validate WCAG 2.2 AA target-size
requirements and exceptions). State has text/shape as well as color. Overlays
must support Escape, dismissal, collision handling and return of focus. Avoid
announcing all 36 search trials; announce meaningful completion or failure.

Reduced motion receives the same information with a stable scene, static
before/after distinction, and explicit trial stepping. Computation can finish
without animating every intermediate arrangement. User-requested exploration
must remain available. If automatic motion runs for more than five seconds
alongside other content, provide appropriate pause/stop/hide behavior under
WCAG 2.2.2; an animation is not exempt merely because its data is real.

## Theme, components, and engineering ownership

Three surface roles remain useful: canvas for the scene and reading;
instrument for editable/code/trace regions; overlay for transient detail.
They are a hierarchy aid, not a rule banning every border. Use whitespace,
alignment, typography and selective rules first. Proposal authorship does not
require a card; status does not require a pill; a section does not require a
surface. Keep visible field boundaries and adequate control affordances.

| Owner | Responsibility in this redesign |
| --- | --- |
| `view/home/HomePage.tsx`, `HomeHero.tsx`, `ImaginedPlaceDemo.tsx` | New arrival and progressive narrative composition; one demo instance |
| `PlaceArrangement.tsx`, `PlaceStage.tsx`, `PlaceMarker.tsx`, `PlaceWalk.tsx` | Larger scene, readable artifact, feature identity and responsive arrangement |
| `PlaceControls.tsx`, `PlaceProposals.tsx`, `PlaceProposalCard.tsx` | Immediate invitation, scenario index, attributed proposals, requested/recorded feedback |
| `PlaceLineage.tsx`, `PlaceHowItsBuilt.tsx`, `placeViewModel.ts` | Honest origin/current relationship and contextual technical explanation |
| `view/primitives/`, semantic-text contracts/generator, `styles.css` | Shared typography, surfaces, controls, color, spacing and motion vocabulary |
| `atoms/imagined-place.ts`, `imagined-place-render.ts` | Existing build and render authorities; no duplicate presentation build |
| `atoms/element-observation.ts`, browser platform services | Mount-scoped observation and cleanup, not durable pseudo-identities |

Base UI owns keyboard/focus/overlay mechanics through existing primitives.
React owns composition and rendering. Tailwind composes token-backed layout;
CSS owns semantic theme and scenario atmosphere. Effect owns work, typed
failures, interruption and cleanup; Effect Atom connects authoritative and
derived state to the view. Motion owns short visual transitions, never the
success state or the lifetime of a network request.

Do not prescribe three new atoms before proving a need. Reuse the existing
step state where appropriate; a shared focused feature needs only a stable
identity derived against the current result. Hover/focus precedence must not
erase keyboard selection. World atmosphere can be derived from the displayed
artifact on the homepage root, avoiding a global `:root` mutation that leaks
into Docs or changes before the new artifact arrives.

Check the installed Motion feature bundle before choosing `LazyMotion` for
shared layout; the former checklist's `domAnimation` assumption is not a
verified layout-animation contract. Scope transition identity by scenario and
stable feature identity, not just feature name. Avoid animating measured prose
line layout every search frame. Profile the actual expensive boundary rather
than adding a blanket GPU/3D solution.

Shared header/footer/theme changes belong in this PR only where they establish
the coherent new language. Inspect Docs consumers for regressions. Do not
rewrite the docs information architecture, remove APIs with live callers,
or adopt external theme/UI packages as an incidental dependency migration.

## Standalone PR delivery plan

This is one substantial homepage redesign, developed in reviewable stages—not
a small de-carding PR represented as completion of the vision. Keep toolchain,
deployment and unrelated library work out. No redesign code or PR has been
published as part of this research revision.

1. **Compose the signature experience first.** Build the new arrival plus one
   real proposal-to-place interaction using existing result data. Establish
   display/prose/technical hierarchy and the first scenario's art direction.
   Review it rendered at 390 and 1440, including reduced motion. Reject it if
   it still reads as the old dashboard without borders.
2. **Author the complete place family.** Carry the composition through all
   three scenarios and both themes. Make the scenario index and transitions
   coherent. Retain a useful static/readable state and loading/error states.
3. **Make participation and evidence continuous.** Recompose both proposals,
   contribution consequence, origin/current relationship and contextual
   details. Exercise pending, failed and rapidly reversed changes before
   polishing motion. Keep the first action adjacent to its consequence.
4. **Open the technical layer.** Integrate trial exploration, brief editing
   disclosure, source tabs, references and package exits with progressive
   depth. Preserve the resize/content-ID invariant and existing core flow.
5. **Harden the whole composition.** Verify input modes, reflow, typography,
   performance and shared-theme consumers. Remove obsolete home-only framing
   and motion after callers are migrated; no speculative primitive framework.

The first stage is a design validation checkpoint, not permission to stop with
one polished scenario. The completed PR includes all three, the technical
depth, failure states and responsive behavior.

## Acceptance: prove the experience, not the component count

### Human review

- Without operating it, can a new visitor identify a specific place, what
  Theoria is, and one thing they can try?
- After one contribution, can they explain what changed and who offered it?
- Can they distinguish a recorded example from live generation, and a trial
  preview from a signed artifact?
- Does each world have authored character beyond a palette swap? Is the page
  recognizably different in composition from the old framed demonstration?
- Is the experience compelling with motion disabled, and readable without
  opening a detail overlay? Do Docs/source remain easy to reach?

These are review questions, not claims that usability testing has occurred.
Use short first-use sessions with non-author reviewers when available; record
confusion and revise the interaction, rather than treating enthusiasm as proof.

### Executed checks for the implementation

- Arrival and interaction at 320, 390, 768, 1024, 1440 and 1920px; representative
  short landscape height; all three scenarios in light/dark. At common 390×844
  and 1440×900 sizes, show meaningful place content and a clear invitation in
  the opening composition. At enlarged text prioritize readable flow over an
  artificial fold target.
- 200% text/zoom and 320px effective reflow: no page overflow, obscured focus,
  clipped controls, or unreadable scene; code overflow is local and labelled.
- Keyboard-only scenario selection, merge reversal, note/details dismissal,
  source tabs and trial stepping; touch equivalents for every hover affordance.
  Inspect accessibility names, reading order, focus return and live feedback.
- Pending/failed initial build, failed rebuild with last good artifact, render
  retry, scenario switch during build, repeated merge reversals, trial preview
  followed by a new result, and viewport change during search.
- Reduced motion and forced colors across the contribution and search flow;
  actual contrast checks for text and controls in each world/theme. Do not
  treat `MotionConfig` or a screenshot as proof of these behaviors.
- Confirm width-only changes issue no build request and preserve IDs; confirm
  successful merge changes reflect actual evidence rather than optimistic
  animation state. Cover these in the existing behavioral tests.
- Profile initial load and active search under mobile CPU throttling; compare
  request count, transferred assets, layout shifts and interaction stalls
  against baseline. Avoid duplicate searches from duplicate scene mounts;
  defer syntax highlighting/technical work where practical. Capture measured
  regressions before adding dependencies or committing to heavier artwork.
- Inspect representative Docs pages after shared token/chrome edits.

Use `test/worker/home.test.ts` and `home-demo.test.ts` for browser behavior and
the existing atom/contract tests for state invariants. Do not add tests that
count wrappers, assert Tailwind strings, or inspect Motion `layoutId` props.
Keep before/after representative screenshots and a short contribution clip
only where timing needs review; inspect them, not merely capture them.

Implementation gates:

```bash
bun run check:all && bun run lint && bun run test && bun run build
bun run check:apps && bun run test:apps
bun run --filter @theoria/theoria-app test:worker
```

The research revision itself changes this document only. It does not claim
those implementation gates, accessibility conformance, performance targets,
or the redesigned experience have passed.
