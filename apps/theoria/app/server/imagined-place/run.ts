import { Clock, Effect } from "effect"
import * as Arr from "effect/Array"

import type { PlaceBuild, ProposalRecord, Version } from "../../contracts/imagined-place-result.js"
import type { PlaceArtifact, PlaceBuildRequest, Proposal } from "../../contracts/imagined-place.js"
import { type PlaceBuildError, placeFeatures } from "../../contracts/imagined-place.js"

import { type Participants, proposalId, signAs, versionId } from "./authority.js"
import { scenarioById } from "./catalog.js"
import { compose, propose } from "./compose.js"
import { sendSealedNote } from "./note.js"

/**
 * The whole demo behind the home page.
 *
 * Imagine   compose (effect-dsp, effect-inference): brief → typed composition,
 *           credited to the model that produced it. The author signs version 1.
 * Propose   two proposals arrive: the neighbor's (with a note sealed to the
 *           author) and the proposer program's. Each is digested and signed by
 *           its proposer (digest, sign; seal via X25519 + HKDF).
 * Merge     the author accepts some proposals. Version 2 digests version 1's
 *           ID as its parent, so lineage is a chain; the author signs it.
 *           Proposals not accepted stay listed with their signatures.
 *
 * Rendering is not here. The place is drawn wherever it is shown, with that
 * surface's own font metrics (`render.ts` on the server, an atom in the
 * browser), and a rendering never changes a content ID.
 */
export const buildPlace = (
  request: PlaceBuildRequest
): Effect.Effect<PlaceBuild, PlaceBuildError, Participants> =>
  Effect.gen(function*() {
    const startedAt = yield* Clock.currentTimeMillis
    const scenario = scenarioById(request.scenario)

    // Imagine
    const composed = yield* compose(scenario, request.brief)
    const origin: PlaceArtifact = {
      schemaVersion: 1,
      scenario: scenario.id,
      brief: request.brief,
      composition: composed.composition,
      accepted: []
    }
    const originId = yield* versionId(origin)

    // Propose
    const [proposed, note] = yield* Effect.all(
      [
        propose(scenario, request.brief, composed.composition),
        sendSealedNote("neighbor", "author", scenario.neighbor.note)
      ],
      { concurrency: "unbounded" }
    )
    const offered: ReadonlyArray<readonly [Proposal, boolean]> = [
      [{ proposer: "neighbor", feature: scenario.neighbor.proposal }, request.acceptNeighbor],
      [{ proposer: "program", feature: proposed.feature }, request.acceptProgram]
    ]
    const proposals = yield* Effect.forEach(
      offered,
      ([proposal, accepted]) =>
        Effect.gen(function*() {
          const contentId = yield* proposalId(proposal)
          const signature = yield* signAs(proposal.proposer, contentId)
          const record: ProposalRecord = { proposal, contentId, accepted, signature }
          return record
        }),
      { concurrency: "unbounded" }
    )

    // Merge
    const accepted = Arr.map(Arr.filter(proposals, (record) => record.accepted), (record) => record.proposal)
    const artifact: PlaceArtifact = Arr.isEmptyReadonlyArray(accepted)
      ? origin
      : { ...origin, parent: originId, accepted }
    const currentId = yield* versionId(artifact)

    const versions: ReadonlyArray<Version> = Arr.isEmptyReadonlyArray(accepted)
      ? [{ version: 1, contentId: originId, featureCount: placeFeatures(origin).length }]
      : [
        { version: 1, contentId: originId, featureCount: placeFeatures(origin).length },
        { version: 2, contentId: currentId, parent: originId, featureCount: placeFeatures(artifact).length }
      ]

    // The author signs every version
    const versionSignatures = yield* Effect.forEach(
      versions,
      (version) => signAs("author", version.contentId),
      { concurrency: "unbounded" }
    )

    const finishedAt = yield* Clock.currentTimeMillis
    return {
      artifact,
      proposals,
      evidence: {
        inference: [composed.inference, proposed.inference],
        lineage: versions,
        signatures: Arr.appendAll(versionSignatures, Arr.map(proposals, (record) => record.signature)),
        sealedNote: note
      },
      durationMs: finishedAt - startedAt
    }
  })
