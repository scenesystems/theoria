import { describe, expect, it } from "@effect/vitest"
import * as ContentDigest from "@scenesystems/digest/ContentDigest"
import {
  Array as Arr,
  Context,
  DateTime,
  Effect,
  Number as Num,
  Result,
  Schema,
  SchemaGetter,
  String as Str
} from "effect"

import * as Artifact from "@scenesystems/effect-study/Artifact"

class DecodeKey extends Context.Service<DecodeKey, string>()("effect-study/test/DecodeKey") {}
class EncodeKey extends Context.Service<EncodeKey, string>()("effect-study/test/EncodeKey") {}

const Producer = Schema.TaggedStruct("IndependentProducer", {
  name: Schema.NonEmptyString
})

const Label = Schema.String.pipe(Schema.decode({
  decode: SchemaGetter.transformEffect((encoded) => DecodeKey.pipe(Effect.as(Str.toLowerCase(encoded)))),
  encode: SchemaGetter.transformEffect((label) => EncodeKey.pipe(Effect.as(Str.toUpperCase(label))))
}))

const Payload = Schema.TaggedStruct("Measurement", {
  payload: Schema.Struct({
    label: Label,
    value: Schema.FiniteFromString
  })
})

const Lineage = Artifact.Lineage(Artifact.Source)
const Envelope = Artifact.Envelope(Producer, Lineage, Payload)

describe("Artifact", () => {
  it.effect("retains cross-field payload checks when composing envelope metadata", () =>
    Effect.gen(function*() {
      const Range = Schema.Struct({ lower: Schema.FiniteFromString, upper: Schema.FiniteFromString }).check(
        Schema.makeFilter((range) => Num.isLessThan(range.lower, range.upper))
      )
      const envelope = Artifact.Envelope(Schema.String, Schema.String, Range)
      const encoded = { producer: "sensor", lineage: "run", lower: "2", upper: "5" }
      const decoded = yield* Schema.decodeEffect(envelope)(encoded)
      expect(decoded).toEqual({ producer: "sensor", lineage: "run", lower: 2, upper: 5 })
      expect(yield* Schema.encodeEffect(envelope)(decoded)).toEqual(encoded)
      expect(Result.isFailure(yield* Schema.decodeEffect(envelope)({ ...encoded, upper: "1" }).pipe(Effect.result)))
        .toBe(true)
      expect(Result.isFailure(yield* Schema.encodeEffect(envelope)({ ...decoded, upper: 1 }).pipe(Effect.result)))
        .toBe(true)
    }))

  it.effect("composes an independent producer and transformed payload without losing codec requirements", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decodeEffect(Artifact.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
      const emittedAt = yield* Effect.fromOption(DateTime.make("2026-09-15T00:00:00Z"))
      const value: typeof Envelope.Type = {
        _tag: "Measurement",
        producer: { _tag: "IndependentProducer", name: "laboratory" },
        lineage: {
          sourceRef: { origin: "laboratory-system", domain: "assay", segments: Arr.of("measurement") },
          artifactId: new Artifact.Id({ runId, sequence: 4 }),
          emittedAt
        },
        payload: { label: "signal", value: 2.5 }
      }

      const encoded = yield* Schema.encodeEffect(Envelope)(value).pipe(Effect.provideService(EncodeKey, "encode"))
      const decoded = yield* Schema.decodeEffect(Envelope)(encoded).pipe(Effect.provideService(DecodeKey, "decode"))

      expect(encoded.payload).toEqual({ label: "SIGNAL", value: "2.5" })
      expect(decoded).toEqual(value)
      expect(decoded.lineage.sourceRef.origin).toBe("laboratory-system")
    }))

  it.effect("round-trips structured digest integrity and rejects string or malformed identities", () =>
    Effect.gen(function*() {
      const encoded = {
        sourceRef: { origin: "laboratory-system", domain: "assay", segments: Arr.of("measurement") },
        artifactId: { runId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sequence: 4 },
        emittedAt: "2026-09-15T00:00:00.000Z",
        // Independent BLAKE3 vector for the UTF-8 preimage {"x":1}.
        integrity: { algorithm: "blake3-256", digest: "aQJY8iIqoTY1e28B_KqoLHTkXHk5qTbKfQTnW9n-bHY" }
      }
      const decoded = yield* Schema.decodeUnknownEffect(Lineage)(encoded)
      const integrity = yield* ContentDigest.fromSchema(Schema.Struct({ x: Schema.Finite }), { x: 1 })
      expect(decoded.integrity).toEqual(integrity)
      expect(yield* Schema.encodeEffect(Lineage)(decoded)).toEqual(encoded)
      expect(Result.isFailure(
        yield* Schema.decodeUnknownEffect(Lineage)({
          ...encoded,
          integrity: ContentDigest.toString(integrity)
        }).pipe(Effect.result)
      )).toBe(true)
      expect(Result.isFailure(
        yield* Schema.decodeEffect(Lineage)({
          ...encoded,
          integrity: { algorithm: "blake3-256", digest: "invalid" }
        }).pipe(Effect.result)
      )).toBe(true)
    }))

  it.effect("specializes source origins without duplicating lineage fields", () =>
    Effect.gen(function*() {
      const ClosedSource = Schema.Struct({ ...Artifact.Source.fields, origin: Schema.Literal("first-party") })
      const ClosedLineage = Artifact.Lineage(ClosedSource)
      const valid = yield* Schema.decodeEffect(ClosedSource)({
        origin: "first-party",
        domain: "study",
        segments: Arr.of("result")
      })
      const invalid = yield* Schema.decodeUnknownEffect(ClosedLineage)({
        sourceRef: { origin: "other", domain: "study", segments: Arr.of("result") },
        artifactId: { runId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", sequence: 0 },
        emittedAt: "2026-09-15T00:00:00.000Z"
      }).pipe(Effect.result)

      expect(valid.origin).toBe("first-party")
      expect(invalid._tag).toBe("Failure")
    }))

  it.effect("constructs and exhaustively matches generic relations", () =>
    Effect.gen(function*() {
      const runId = yield* Schema.decodeEffect(Artifact.RunId)("01ARZ3NDEKTSV4RRFFQ69G5FAV")
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

  it.effect("preserves own prototype-named payload keys", () =>
    Effect.gen(function*() {
      const json = "[{\"__proto__\":{\"nested\":[true,null]},\"constructor\":\"own\",\"toString\":7}]"
      const codec = Schema.fromJsonString(Artifact.Payload)
      const decoded = yield* Schema.decodeEffect(codec)(json)

      expect(yield* Schema.encodeEffect(codec)(decoded)).toBe(json)
    }))

  it.effect("retains numerical leaves outside JSON and rejects unsupported leaves", () =>
    Effect.gen(function*() {
      const payload: Artifact.Payload = { values: Arr.make(Number.NaN, Number.POSITIVE_INFINITY, -0) }
      const roundTrip = yield* Schema.encodeEffect(Artifact.Payload)(payload).pipe(
        Effect.flatMap(Schema.decodeEffect(Artifact.Payload))
      )
      const invalid = yield* Schema.decodeUnknownEffect(Artifact.Payload)({ nested: Arr.of({ value: undefined }) })
        .pipe(
          Effect.result
        )

      expect(roundTrip).toEqual(payload)
      expect(Result.isFailure(invalid)).toBe(true)
    }))
})
