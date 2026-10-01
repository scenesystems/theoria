import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Number, Option, Schema } from "effect"

import * as RuntimeEvidence from "@scenesystems/effect-inference/RuntimeEvidence"
import * as Testing from "@scenesystems/effect-inference/Testing"

const consumeMetadataValue = (value: RuntimeEvidence.MetadataValue): RuntimeEvidence.MetadataValue => value

describe("RuntimeEvidence", () => {
  it.effect("round-trips request, provenance, usage, and recursively typed JSON metadata", () =>
    Effect.gen(function*() {
      const request = Testing.request({ modelRef: "requested/model" })
      const evidence = RuntimeEvidence.make(
        Testing.resolution({ request }),
        Testing.response({
          responseModel: "reported/model",
          usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
          providerMetadata: {
            provider: {
              requestId: "request-1",
              nested: {
                values: ["text", 42, true, null, { cached: false }]
              }
            }
          }
        })
      )
      const encoded = yield* Schema.encode(RuntimeEvidence.RuntimeEvidence)(evidence)
      const decoded = yield* RuntimeEvidence.decodeUnknown(encoded)
      const metadata = yield* Option.fromNullable(decoded.response.providerMetadata)
      const provider = yield* Option.fromNullable(metadata.provider)
      const nested = consumeMetadataValue(yield* Option.fromNullable(provider.nested))

      expect(decoded.request.model.modelRef).toBe("requested/model")
      expect(decoded.response.responseModel).toBe("reported/model")
      expect(Option.fromNullable(decoded.response.usage).pipe(Option.map((usage) => usage.totalTokens))).toEqual(
        Option.some(16)
      )
      expect(
        Option.fromNullable(provider.requestId)
      ).toEqual(Option.some("request-1"))
      expect(nested).toEqual({ values: ["text", 42, true, null, { cached: false }] })
      expect(encoded.response.providerMetadata).toEqual(evidence.response.providerMetadata)
    }))

  it.effect("rejects functions, undefined values, and non-finite numbers from persisted metadata", () =>
    Effect.forEach(
      Arr.make(Effect.void, undefined, Number.unsafeDivide(1, 0), Number.unsafeDivide(0, 0)),
      (invalid) =>
        RuntimeEvidence.decodeUnknown({
          request: { model: { modelRef: "model" } },
          route: Testing.resolvedRoute(),
          response: { responseModel: "model", providerMetadata: { provider: { nested: { invalid } } } },
          capabilities: Testing.resolution({ request: Testing.request() }).capabilities
        }).pipe(
          Effect.flip,
          Effect.tap((error) => Effect.sync(() => expect(error._tag).toBe("effect-inference/InvalidRuntimeConfig")))
        )
    ))
})
