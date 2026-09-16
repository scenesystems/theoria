import { describe, expect, it } from "@effect/vitest"
import { Cipher } from "@scenesystems/seal"
import { Boolean as Bool, Effect, Encoding, Match, Number as Num, Option, Predicate, Struct, Tuple } from "effect"
import * as Arr from "effect/Array"

import { ed25519Verify, utf8ToBytes } from "@scenesystems/sign"

import { description, descriptionInput } from "../../app/contracts/demo/imagined-place-arrangement.js"
import { renderTrials } from "../../app/contracts/demo/imagined-place-search.js"
import {
  PlaceAcceptances,
  PlaceBuildRequest,
  placeFeatures,
  placeScenarioRecordings,
  placeScenarios,
  recordedOutline,
  recordedProposals,
  versionShapes
} from "../../app/contracts/imagined-place.js"
import { Participants, ParticipantsLive } from "../../app/server/imagined-place/authority.js"
import { sendSealedNote } from "../../app/server/imagined-place/note.js"
import { render } from "../../app/server/imagined-place/render.js"
import { buildPlace } from "../../app/server/imagined-place/run.js"
import { scenarioById } from "../../app/server/imagined-place/scenarios.js"

const request = PlaceBuildRequest.make({
  scenario: "unfinished-light",
  brief: scenarioById("unfinished-light").brief,
  acceptNeighbor: true,
  acceptProgram: false
})

/** Every way the two proposals can be taken or left. */
const acceptances = Arr.make(
  PlaceAcceptances.make({ acceptNeighbor: false, acceptProgram: false }),
  PlaceAcceptances.make({ acceptNeighbor: true, acceptProgram: false }),
  PlaceAcceptances.make({ acceptNeighbor: false, acceptProgram: true }),
  PlaceAcceptances.make({ acceptNeighbor: true, acceptProgram: true })
)

const build = (variant: PlaceBuildRequest = request) =>
  buildPlace(variant).pipe(Effect.provide([ParticipantsLive, Cipher.layer]))

describe("server/imagined-place", () => {
  it.effect("composes and proposes for every scenario through the typed programs", () =>
    Effect.forEach(placeScenarios, (scenario) =>
      Effect.gen(function*() {
        const result = yield* build({ ...request, scenario })
        expect(result.artifact.composition.features.length).toBeGreaterThanOrEqual(3)
        expect(Arr.map(result.evidence.inference, (e) => e.program)).toEqual(Tuple.make(
          "theoria-place-composer",
          "theoria-place-proposer"
        ))
        expect(Arr.every(
          result.evidence.inference,
          (e) =>
            Match.value(e).pipe(
              Match.when({ mode: "recorded", serveMode: "local-runtime" }, () => true),
              Match.orElse(() => false)
            )
        ))
          .toBe(true)
        expect(result.proposals.length).toBe(2)
      })))

  it.effect("the recording outlines every build, so the page can be cut to it before the build arrives", () =>
    Effect.forEach(placeScenarios, (scenario) =>
      Effect.forEach(acceptances, (accept) =>
        Effect.gen(function*() {
          const result = yield* build({ ...request, ...accept, scenario })
          const recording = Struct.get(scenario)(placeScenarioRecordings)
          const outline = recordedOutline(recording, accept)
          expect(result.artifact.composition).toEqual(outline.composition)
          expect(result.artifact.accepted).toEqual(outline.accepted)
          expect(placeFeatures(result.artifact)).toEqual(placeFeatures(outline))
          expect(descriptionInput(result.artifact)).toEqual(descriptionInput(outline))
          // The proposals are recorded in the order they were offered, with the author's decision on each.
          expect(Arr.map(result.proposals, ({ accepted, proposal }) => ({ proposal, accepted }))).toEqual(
            recordedProposals(recording, accept)
          )
          // The lineage has the outline's versions: each recorded version is a shape with its digest.
          expect(Arr.map(result.evidence.lineage, ({ featureCount, version }) => ({ version, featureCount }))).toEqual(
            versionShapes(outline)
          )
        }))))

  it.effect("keeps lineage: version 2 names version 1 as its parent and only accepted proposals change it", () =>
    Effect.gen(function*() {
      const merged = yield* build()
      const untouched = yield* build({ ...request, acceptNeighbor: false })
      const both = yield* build({ ...request, acceptProgram: true })

      expect(untouched.evidence.lineage.length).toBe(1)
      expect(untouched.artifact.parent).toBeUndefined()

      const untouchedOrigin = yield* Arr.get(untouched.evidence.lineage, 0)
      const mergedOrigin = yield* Arr.get(merged.evidence.lineage, 0)
      const mergedRevision = yield* Arr.get(merged.evidence.lineage, 1)
      const bothOrigin = yield* Arr.get(both.evidence.lineage, 0)
      const bothRevision = yield* Arr.get(both.evidence.lineage, 1)
      expect(merged.evidence.lineage.length).toBe(2)
      expect(merged.artifact.parent).toBe(untouchedOrigin.contentId)
      expect(mergedRevision.parent).toBe(mergedOrigin.contentId)
      expect(placeFeatures(merged.artifact).length).toBe(Num.increment(placeFeatures(untouched.artifact).length))

      expect(bothRevision.contentId).not.toBe(mergedRevision.contentId)
      expect(bothOrigin.contentId).toBe(mergedOrigin.contentId)
    }))

  it.effect("keeps rejected proposals visible with their own identity and signature", () =>
    Effect.gen(function*() {
      const result = yield* build()
      const rejected = Arr.filter(result.proposals, Predicate.not((record) => record.accepted))
      const rejectedRecord = yield* Arr.get(rejected, 0)
      expect(rejected.length).toBe(1)
      expect(rejectedRecord.proposal.proposer).toBe("program")
      expect(rejectedRecord.signature.valid).toBe(true)
      expect(rejectedRecord.signature.subject).toBe(rejectedRecord.contentId)
    }))

  it.effect("signs each thing with its own participant's key", () =>
    Effect.gen(function*() {
      const participants = yield* Participants
      const result = yield* buildPlace(request)

      yield* Effect.forEach(result.evidence.signatures, (record) =>
        Effect.gen(function*() {
          const publicKey = Struct.get(record.signer)(participants).signing.publicKey
          const signature = yield* Encoding.decodeHex(record.signatureHex)
          expect(record.valid).toBe(true)
          expect(yield* ed25519Verify(signature, utf8ToBytes(record.subject), publicKey)).toBe(true)
          expect(yield* ed25519Verify(signature, utf8ToBytes(`${record.subject}x`), publicKey)).toBe(false)
        }))

      const signers = Arr.map(result.evidence.signatures, (record) => record.signer)
      expect(signers).toEqual(Arr.make("author", "author", "neighbor", "program"))
      const wrongKey = Struct.get("author")(participants).signing.publicKey
      const neighborRecord = yield* Arr.get(result.evidence.signatures, 2)
      const neighborSignature = yield* Encoding.decodeHex(neighborRecord.signatureHex)
      expect(yield* ed25519Verify(neighborSignature, utf8ToBytes(neighborRecord.subject), wrongKey)).toBe(false)
    }).pipe(Effect.provide([ParticipantsLive, Cipher.layer])))

  it.effect("seals the neighbor's note to the author and the author can open it", () =>
    Effect.gen(function*() {
      const result = yield* build()
      expect(result.evidence.sealedNote.openedText).toBe(scenarioById("unfinished-light").neighbor.note)
      expect(result.evidence.sealedNote.envelopeBytes).toBeGreaterThan(
        utf8ToBytes(result.evidence.sealedNote.openedText).length
      )
      expect(result.evidence.sealedNote.from).toBe("neighbor")
      expect(result.evidence.sealedNote.to).toBe("author")
    }))

  it.effect("preserves empty notes and multibyte UTF-8 across the real sealing pipeline", () =>
    Effect.forEach(
      [Tuple.make("", 40), Tuple.make("é🌊\u0000", 47)],
      ([text, expectedBytes]) =>
        Effect.gen(function*() {
          const note = yield* sendSealedNote("neighbor", "author", text)
          expect(note.openedText).toBe(text)
          expect(note.envelopeBytes).toBe(expectedBytes)
        })
    ).pipe(Effect.provide([ParticipantsLive, Cipher.layer])))

  it.effect("renders a legible arrangement: text flows around markers, nothing overlaps or leaves the stage", () =>
    Effect.gen(function*() {
      const result = yield* build({ ...request, acceptProgram: true })
      const { evidence, projection } = yield* render(result.artifact, 660)
      const column = Num.subtract(projection.stageWidth, Num.multiply(2, projection.padding))

      expect(evidence.trials).toBe(renderTrials)
      expect(projection.markers.length).toBe(placeFeatures(result.artifact).length)
      expect(Arr.filter(projection.markers, (m) => Option.isSome(Option.fromNullable(m.contributedBy))).length).toBe(2)
      expect(
        Arr.every(
          projection.markers,
          (m) =>
            Bool.and(
              Bool.and(
                Num.greaterThanOrEqualTo(Num.subtract(m.x, m.radius), Num.decrement(projection.padding)),
                Num.lessThanOrEqualTo(
                  Num.sum(m.x, m.radius),
                  Num.increment(Num.subtract(projection.stageWidth, projection.padding))
                )
              ),
              Bool.and(
                Num.greaterThanOrEqualTo(Num.subtract(m.y, m.radius), Num.decrement(projection.padding)),
                Num.lessThanOrEqualTo(
                  Num.sum(m.y, m.radius),
                  Num.increment(Num.subtract(projection.stageHeight, projection.padding))
                )
              )
            )
        )
      )
        .toBe(true)
      expect(Arr.every(projection.lines, (line) => Num.lessThanOrEqualTo(line.width, Num.sum(line.maxWidth, 0.5))))
        .toBe(true)
      expect(Arr.some(projection.lines, (line) => Num.lessThan(line.maxWidth, column))).toBe(true)
      expect(evidence.narrowestLine).toBeGreaterThanOrEqual(0.4)
      expect(
        Arr.last(projection.lines).pipe(
          Option.map((line) => Num.sum(line.y, projection.lineHeight)),
          Option.getOrElse(() => 0)
        )
      )
        .toBeLessThanOrEqual(Num.subtract(projection.stageHeight, projection.padding))
      expect(Arr.join(Arr.map(projection.lines, (line) => line.text), " ")).toBe(description(result.artifact))
    }))

  it.effect("is deterministic, and the stage width changes the rendering but never the content ID", () =>
    Effect.gen(function*() {
      const first = yield* build()
      const second = yield* build()
      const wide = yield* render(first.artifact, 660)
      const again = yield* render(first.artifact, 660)
      const narrow = yield* render(first.artifact, 320)

      expect(second.evidence.lineage).toEqual(first.evidence.lineage)
      expect(again.projection).toEqual(wide.projection)
      expect(Num.lessThan(narrow.projection.stageWidth, wide.projection.stageWidth)).toBe(true)
      expect(Num.greaterThan(narrow.projection.lines.length, wide.projection.lines.length)).toBe(true)
    }))
})
