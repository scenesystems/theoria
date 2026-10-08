# Imagined Place

The home-page demo composes an imagined place, accepts proposals, signs its
lineage, and arranges its description around a drawing. This guide explains the
boundaries contributors need to preserve when changing it. For local setup,
see the [app README](../README.md).

## Building content and drawing it are separate operations

[`buildPlace`](../app/server/imagined-place/run.ts) handles
`POST /api/imagined-place/build`. The request selects a scenario, a brief, and
which of two proposals to accept. The response contains the artifact,
proposals, and evidence, not its screen layout.

- **Compose:** effect-dsp decodes a recorded reply against the composition
  schema. effect-inference supplies recorded runtime evidence.
- **Propose:** each proposal is digested and signed by its proposer. The
  neighbor's note is sealed for the author and opened with the author's key.
- **Record:** accepted proposals become part of the artifact. A new version
  includes its parent's content ID and the author's signature. Declined
  proposals retain their own IDs and signatures.

The browser runs a seeded effect-search optimization using effect-text's
measurements and effect-math's scoring. Its viewport and fonts determine the
drawing; they do not change the artifact or its content ID. The
[render state](../app/web/atoms/imagined-place-render.ts) owns the shown trial
and transitions between drawings. Keep answers about a disc or line tied to
the drawing currently shown, including when a newer build is pending.

## What the demo proves

Inference is **recorded**, not a live provider call. Editing the brief changes
the signed artifact but does not generate a new model response. The real DSP
decoding path runs against the scenario's recorded output; see
[`compose.ts`](../app/server/imagined-place/compose.ts).

The participants use real signing and agreement keys allocated by the
[server service](../app/server/imagined-place/authority.ts). Signatures prove
that a demo key signed a content ID, not a person's identity. These keys and
the example sealed note are demonstration data, not a user identity or
private-messaging service.

The arrangement search runs in the visitor's browser. The trace lets a visitor
inspect rejected trials as well as the kept result. A content merge changes
both the prose and the drawing; a width change changes only the drawing.

## Where to make changes

- [Scenario definitions](../app/server/imagined-place/scenarios.ts) and
  [request schemas](../app/contracts/imagined-place.ts) own demo inputs.
- [Geometry and text flow](../app/contracts/demo/imagined-place-flow.ts) own
  placement and clearance; views render their results.
- [Home views](../app/web/view/home/) own controls and presentation.
  Provenance opens on press, tap, or keyboard activation, not hover.
- [Server tests](../test/server/imagined-place.test.ts) exercise content,
  lineage, signatures, and sealed notes. [Browser tests](../test/worker/)
  exercise drawing, interaction, accessibility, and loading states.

Use the app's [verification commands](../README.md#verify-changes) after changes.
