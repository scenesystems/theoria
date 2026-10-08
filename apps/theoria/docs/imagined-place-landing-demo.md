# Imagined Place

Imagined Place is the home-page demo. A reader chooses a scenario and accepts
or declines signed proposals for changes, then the browser arranges the place's
description around a drawing. For local setup, see the [app README](../README.md).

## Content and layout

[`buildPlace`](../app/server/imagined-place/run.ts) handles
`POST /api/imagined-place/build`. The request selects a scenario, a brief, and
which proposals to accept. The response contains the artifact,
proposals, and evidence.

The server uses effect-dsp to decode a recorded reply against the composition
schema and effect-inference to supply recorded runtime evidence. It digests
each proposal and signs it with the proposer's key. The neighbor's note is
sealed for the author and opened with the author's key.

Accepted proposals become part of the artifact. A new version includes its
parent's content ID and the author's signature. Declined proposals retain
their own IDs and signatures.

The browser runs a seeded effect-search optimization using effect-text's
measurements and effect-math's scoring. Its viewport and fonts determine the
drawing; they do not change the artifact or its content ID. The
[render state](../app/web/atoms/imagined-place-render.ts) tracks the visible trial
and transitions between drawings. While a newer build is pending, information
about a disc or line must still describe the drawing on screen.

## Recorded inference and demo keys

Editing the brief changes the signed artifact but does not generate a new
model response. DSP decodes the scenario's recorded output; see
[`compose.ts`](../app/server/imagined-place/compose.ts).

The [server service](../app/server/imagined-place/authority.ts) allocates demo
signing and agreement keys. Signatures bind content IDs to these keys without
authenticating a person. The keys and sealed note are demonstration data.

## Source and tests

- [Scenario definitions](../app/server/imagined-place/scenarios.ts) and
  [request schemas](../app/contracts/imagined-place.ts) define the available inputs.
- [Geometry and text flow](../app/contracts/demo/imagined-place-flow.ts) calculate
  placement and clearance for the views to render.
- [Home views](../app/web/view/home/) implement controls and presentation.
  Provenance opens on press, tap, or keyboard activation, not hover.
- [Server tests](../test/server/imagined-place.test.ts) exercise content,
  lineage, signatures, and sealed notes. [Browser tests](../test/worker/)
  exercise drawing, interaction, accessibility, and loading states.

Use the app's [verification commands](../README.md#verify-changes) after changes.
