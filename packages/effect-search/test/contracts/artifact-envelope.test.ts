import { describe, expect, expectTypeOf, it } from "@effect/vitest"
import { Array as Arr, DateTime, Effect, Either, FastCheck, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

const testRunId = "01HZ0000000000000000000000"

const makeTestLineage = Effect.gen(function*() {
  const runId = yield* Schema.decode(Contracts.RunId)(testRunId)
  const emittedAt = yield* DateTime.make("2024-01-01T00:00:00Z")
  const sourceRef = new Contracts.SourceRef({
    origin: "effect-search",
    domain: "study",
    segments: Arr.of("snapshot")
  })
  const artifactId = new Contracts.ArtifactId({
    runId,
    sequence: 0
  })
  return new Contracts.ArtifactLineage({
    sourceRef,
    artifactId,
    emittedAt
  })
})

const makeTestProducer = Effect.gen(function*() {
  const packageVersion = yield* Schema.decode(Contracts.PackageVersion)("0.1.0")
  const runId = yield* Schema.decode(Contracts.RunId)(testRunId)
  const component = yield* Schema.decode(Contracts.ComponentPath)(Arr.make("Study", "snapshot"))
  return Contracts.EffectSearch({
    packageVersion,
    component,
    runId
  })
})

describe("contracts/ArtifactEnvelope", () => {
  it.effect("round-trips a Custom envelope through ArtifactEnvelopeSchema encode/decode", () =>
    Effect.gen(function*() {
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer

      const envelope = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        payload: { nextTrialNumber: 12, completedCount: 8 }
      })

      const encoded = yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)
      const decoded = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(encoded)

      expect(decoded._tag).toBe("Custom")
      expect(decoded.schemaVersion).toBe("artifact-envelope/v1")
      expect(decoded.lineage.sourceRef.origin).toBe("effect-search")
    }))

  it.effect("round-trips a TrialLog envelope through ArtifactEnvelopeSchema encode/decode", () =>
    Effect.gen(function*() {
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer

      const envelope = Contracts.TrialLog({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        trial: {
          trialNumber: 0,
          config: {},
          state: { _tag: "Completed", value: 1.0, duration: 100, retryCount: 0 }
        }
      })

      const encoded = yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(envelope)
      const decoded = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(encoded)

      expect(decoded._tag).toBe("TrialLog")
      expect(decoded.schemaVersion).toBe("artifact-envelope/v1")
    }))

  it.effect("round-trips nested Custom payloads and rejects unsupported leaves", () =>
    Effect.gen(function*() {
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer
      const nested = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        payload: { values: Arr.make(1, true, null, { label: "valid" }) }
      })

      const encoded = yield* Schema.encode(Contracts.ArtifactEnvelopeSchema)(nested)
      const decoded = yield* Schema.decode(Contracts.ArtifactEnvelopeSchema)(encoded)
      const invalidResult = yield* Schema.decodeUnknown(Contracts.ArtifactEnvelopeSchema)({
        ...encoded,
        payload: { values: Arr.of({ inner: Arr.of({ unsupported: undefined }) }) }
      }).pipe(Effect.either)

      expect(decoded).toEqual(nested)
      expect(Either.isLeft(invalidResult)).toBe(true)
    }))

  it.effect.prop("round-trips custom JSON payloads without changing nested values", {
    payload: FastCheck.jsonValue()
  }, ({ payload }) =>
    Effect.gen(function*() {
      const input = {
        _tag: "Custom",
        schemaVersion: "artifact-envelope/v1",
        producer: yield* makeTestProducer,
        lineage: yield* makeTestLineage,
        payload
      }
      const envelope = yield* Schema.validate(Contracts.ArtifactEnvelopeSchema)(input)
      const codec = Schema.parseJson(Contracts.ArtifactEnvelopeSchema)
      const encoded = yield* Schema.encode(codec)(envelope)
      const decoded = yield* Schema.decode(codec)(encoded)

      expect(decoded).toEqual(input)
      expectTypeOf(decoded).not.toBeAny()
      expectTypeOf<Contracts.ArtifactPayload>().not.toBeAny()
      expectTypeOf<bigint>().not.toExtend<Contracts.ArtifactPayload>()
      expectTypeOf<undefined>().not.toExtend<Contracts.ArtifactPayload>()
    }))

  it.effect("preserves readonly arrays and nonfinite numeric leaves through payload codecs", () =>
    Effect.gen(function*() {
      const numbers = yield* Schema.decode(Schema.Array(Schema.NumberFromString))(
        Arr.make("NaN", "Infinity", "-Infinity", "-0")
      )
      const payload: Contracts.ArtifactPayload = { values: numbers }
      const encoded = yield* Schema.encode(Contracts.ArtifactPayload)(payload)
      const decoded = yield* Schema.decode(Contracts.ArtifactPayload)(encoded)
      const encodedArray = yield* Schema.encode(Contracts.ArtifactPayload)(numbers)

      expect(encoded).toEqual(payload)
      expect(decoded).toEqual(payload)
      expect(encodedArray).toEqual(numbers)
    }))

  it.effect("preserves own prototype-named keys in nested JSON records", () =>
    Effect.gen(function*() {
      const json = "[{\"__proto__\":{\"nested\":[true,null]},\"constructor\":\"own\",\"toString\":7}]"
      const codec = Schema.parseJson(Contracts.ArtifactPayload)
      const decoded = yield* Schema.decode(codec)(json)
      const encoded = yield* Schema.encode(codec)(decoded)

      expect(encoded).toBe(json)
    }))

  it.effect("round-trips many alternating array and record levels", () =>
    Effect.gen(function*() {
      const payload = Arr.reduce(
        Arr.range(1, 64),
        17,
        (nested: Contracts.ArtifactPayload, depth): Contracts.ArtifactPayload => ({ depth, children: Arr.of(nested) })
      )
      const encoded = yield* Schema.encode(Contracts.ArtifactPayload)(payload)
      const decoded = yield* Schema.decode(Contracts.ArtifactPayload)(encoded)

      expect(decoded).toEqual(payload)
    }))

  it.effect("matchEnvelope exhaustive pattern matching", () =>
    Effect.gen(function*() {
      const lineage = yield* makeTestLineage
      const producer = yield* makeTestProducer

      const envelope = Contracts.Custom({
        schemaVersion: "artifact-envelope/v1",
        producer,
        lineage,
        payload: "hello"
      })

      const result = Contracts.matchEnvelope({
        TrialLog: () => "trial-log",
        StudySnapshot: () => "study-snapshot",
        StudyEvent: () => "study-event",
        Custom: (c) => c.payload
      })(envelope)

      expect(result).toBe("hello")
    }))
})
