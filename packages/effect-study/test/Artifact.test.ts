import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Context, DateTime, Effect, Schema, String as Str } from "effect"

import * as Artifact from "@scenesystems/effect-study/Artifact"

class CodecKey extends Context.Tag("effect-study/test/CodecKey")<CodecKey, string>() {}

const Producer = Schema.TaggedStruct("IndependentProducer", {
  name: Schema.NonEmptyString
})

const Label = Schema.transformOrFail(Schema.String, Schema.String, {
  strict: true,
  decode: (encoded) => CodecKey.pipe(Effect.as(Str.toLowerCase(encoded))),
  encode: (label) => CodecKey.pipe(Effect.as(Str.toUpperCase(label)))
})

const Payload = Schema.TaggedStruct("Measurement", {
  payload: Schema.Struct({
    label: Label,
    value: Schema.NumberFromString
  })
})

const Lineage = Artifact.Lineage(Artifact.Source)
const Envelope = Artifact.Envelope(Producer, Lineage, Payload)

describe("Artifact", () => {
  it.effect("composes an independent producer and transformed payload without losing codec requirements", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(Artifact.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const emittedAt = yield* DateTime.make("2026-09-15T00:00:00Z")
      const value: typeof Envelope.Type = {
        _tag: "Measurement",
        schemaVersion: "artifact-envelope/v1",
        producer: { _tag: "IndependentProducer", name: "laboratory" },
        lineage: {
          sourceRef: { origin: "laboratory-system", domain: "assay", segments: Arr.of("measurement") },
          artifactId: new Artifact.Id({ runId, sequence: 4 }),
          emittedAt
        },
        payload: { label: "signal", value: 2.5 }
      }

      const encoded = yield* Schema.encode(Envelope)(value).pipe(Effect.provideService(CodecKey, "key"))
      const decoded = yield* Schema.decode(Envelope)(encoded).pipe(Effect.provideService(CodecKey, "key"))

      expect(encoded.payload).toEqual({ label: "SIGNAL", value: "2.5" })
      expect(decoded).toEqual(value)
      expect(decoded.lineage.sourceRef.origin).toBe("laboratory-system")
    }))

  it.effect("specializes source origins without duplicating lineage fields", () =>
    Effect.gen(function*() {
      const ClosedSource = Schema.Struct({ ...Artifact.Source.fields, origin: Schema.Literal("first-party") })
      const ClosedLineage = Artifact.Lineage(ClosedSource)
      const valid = yield* Schema.decodeUnknown(ClosedSource)({
        origin: "first-party",
        domain: "study",
        segments: Arr.of("result")
      })
      const invalid = yield* Schema.decodeUnknown(ClosedLineage)({
        sourceRef: { origin: "other", domain: "study", segments: Arr.of("result") },
        artifactId: { runId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sequence: 0 },
        emittedAt: "2026-09-15T00:00:00.000Z"
      }).pipe(Effect.either)

      expect(valid.origin).toBe("first-party")
      expect(invalid._tag).toBe("Left")
    }))

  it.effect("constructs and exhaustively matches generic relations", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decode(Artifact.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const relation = Artifact.Run({ ref: runId })
      const label = Artifact.matchRelation({
        Run: ({ ref }) => ref,
        External: ({ namespace, ref }) => Str.concat(namespace, Str.concat(":", ref))
      })
      const external = Artifact.External({ namespace: "assay", ref: "sample-7" })

      expect(Artifact.isRelation("Run")(relation)).toBe(true)
      expect(Artifact.isRelation("Run")(external)).toBe(false)
      expect(label(relation)).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      expect(label(external)).toBe("assay:sample-7")
    }))
})
