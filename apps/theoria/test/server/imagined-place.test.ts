import { describe, expect, it } from "@effect/vitest"
import { Effect, Encoding, Option } from "effect"
import * as Arr from "effect/Array"

import { ed25519Verify, utf8ToBytes } from "@scenesystems/sign"

import { description, renderTrials } from "../../app/contracts/demo/imagined-place-arrangement.js"
import { type PlaceBuildRequest, placeFeatures, placeScenarios } from "../../app/contracts/imagined-place.js"
import { Participants, ParticipantsLive } from "../../app/server/imagined-place/authority.js"
import { render } from "../../app/server/imagined-place/render.js"
import { buildPlace } from "../../app/server/imagined-place/run.js"
import { scenarioById } from "../../app/server/imagined-place/scenarios.js"

const request: PlaceBuildRequest = {
  scenario: "unfinished-light",
  brief: scenarioById("unfinished-light").brief,
  acceptNeighbor: true,
  acceptProgram: false
}

const build = (variant: PlaceBuildRequest = request) => buildPlace(variant).pipe(Effect.provide(ParticipantsLive))

describe("server/imagined-place", () => {
  it.effect("composes and proposes for every scenario through the typed programs", () =>
    Effect.forEach(placeScenarios, (scenario) =>
      Effect.gen(function*() {
        const result = yield* build({ ...request, scenario })
        expect(result.artifact.composition.features.length).toBeGreaterThanOrEqual(3)
        expect(Arr.map(result.evidence.inference, (e) => e.program)).toEqual([
          "theoria-place-composer",
          "theoria-place-proposer"
        ])
        expect(Arr.every(result.evidence.inference, (e) => e.mode === "recorded" && e.serveMode === "local-runtime"))
          .toBe(true)
        expect(result.proposals.length).toBe(2)
      })))

  it.effect("keeps lineage: version 2 names version 1 as its parent and only accepted proposals change it", () =>
    Effect.gen(function*() {
      const merged = yield* build()
      const untouched = yield* build({ ...request, acceptNeighbor: false })
      const both = yield* build({ ...request, acceptProgram: true })

      expect(untouched.evidence.lineage.length).toBe(1)
      expect(untouched.artifact.parent).toBeUndefined()

      expect(merged.evidence.lineage.length).toBe(2)
      expect(merged.artifact.parent).toBe(untouched.evidence.lineage[0]?.contentId)
      expect(merged.evidence.lineage[1]?.parent).toBe(merged.evidence.lineage[0]?.contentId)
      expect(placeFeatures(merged.artifact).length).toBe(placeFeatures(untouched.artifact).length + 1)

      expect(both.evidence.lineage[1]?.contentId).not.toBe(merged.evidence.lineage[1]?.contentId)
      expect(both.evidence.lineage[0]?.contentId).toBe(merged.evidence.lineage[0]?.contentId)
    }))

  it.effect("keeps rejected proposals visible with their own identity and signature", () =>
    Effect.gen(function*() {
      const result = yield* build()
      const rejected = Arr.filter(result.proposals, (record) => !record.accepted)
      expect(rejected.length).toBe(1)
      expect(rejected[0]?.proposal.proposer).toBe("program")
      expect(rejected[0]?.signature.valid).toBe(true)
      expect(rejected[0]?.signature.subject).toBe(rejected[0]?.contentId)
    }))

  it.effect("signs each thing with its own participant's key", () =>
    Effect.gen(function*() {
      const participants = yield* Participants
      const result = yield* buildPlace(request)

      yield* Effect.forEach(result.evidence.signatures, (record) =>
        Effect.gen(function*() {
          const publicKey = participants[record.signer].signing.publicKey
          const signature = yield* Encoding.decodeHex(record.signatureHex)
          expect(record.valid).toBe(true)
          expect(yield* ed25519Verify(signature, utf8ToBytes(record.subject), publicKey)).toBe(true)
          expect(yield* ed25519Verify(signature, utf8ToBytes(`${record.subject}x`), publicKey)).toBe(false)
        }))

      const signers = Arr.map(result.evidence.signatures, (record) => record.signer)
      expect(signers).toEqual(["author", "author", "neighbor", "program"])
      const wrongKey = participants.author.signing.publicKey
      const neighborRecord = yield* Arr.get(result.evidence.signatures, 2)
      const neighborSignature = yield* Encoding.decodeHex(neighborRecord.signatureHex)
      expect(yield* ed25519Verify(neighborSignature, utf8ToBytes(neighborRecord.subject), wrongKey)).toBe(false)
    }).pipe(Effect.provide(ParticipantsLive)))

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

  it.effect("renders a legible arrangement: text flows around markers, nothing overlaps or leaves the stage", () =>
    Effect.gen(function*() {
      const result = yield* build({ ...request, acceptProgram: true })
      const { evidence, projection } = yield* render(result.artifact, 660)
      const column = projection.stageWidth - 2 * projection.padding

      expect(evidence.trials).toBe(renderTrials)
      expect(projection.markers.length).toBe(placeFeatures(result.artifact).length)
      expect(Arr.filter(projection.markers, (m) => Option.isSome(Option.fromNullable(m.contributedBy))).length).toBe(2)
      expect(
        Arr.every(
          projection.markers,
          (m) =>
            m.x - m.radius >= projection.padding - 1 && m.x + m.radius <= projection.stageWidth - projection.padding + 1
            && m.y - m.radius >= projection.padding - 1 &&
            m.y + m.radius <= projection.stageHeight - projection.padding + 1
        )
      )
        .toBe(true)
      expect(Arr.every(projection.lines, (line) => line.width <= line.maxWidth + 0.5)).toBe(true)
      expect(Arr.some(projection.lines, (line) => line.maxWidth < column)).toBe(true)
      expect(evidence.narrowestLine).toBeGreaterThanOrEqual(0.4)
      expect(Arr.last(projection.lines).pipe((o) => o._tag === "Some" ? o.value.y + projection.lineHeight : 0))
        .toBeLessThanOrEqual(projection.stageHeight - projection.padding)
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
      expect(narrow.projection.stageWidth).toBeLessThan(wide.projection.stageWidth)
      expect(narrow.projection.lines.length).toBeGreaterThan(wide.projection.lines.length)
    }))
})
