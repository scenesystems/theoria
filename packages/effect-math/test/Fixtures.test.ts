import { expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"
import { FixtureManifestSchema, KnownFixtureSchema } from "./helpers/fixtures/schemas.js"

it.effect("round-trips manifest provenance without application format fields", () =>
  Effect.gen(function*() {
    const wire =
      "{\"generator\":{\"script\":\"scripts/generate-scipy-fixtures.py\",\"upstream\":\"scipy\",\"upstreamVersion\":\"1.17.1\",\"numpyVersion\":\"1.26.4\",\"pythonVersion\":\"3.13.5\",\"generatedAt\":\"2026-03-23T00:00:00Z\"},\"fixtures\":[{\"name\":\"numeric.scalar-parity\",\"file\":\"numeric/scalar-parity.json\"}]}"
    const codec = Schema.fromJsonString(FixtureManifestSchema)
    const decoded = yield* Schema.decodeEffect(codec, { onExcessProperty: "error" })(wire)
    expect(yield* Schema.encodeEffect(codec)(decoded)).toBe(wire)
  }))

it.effect("round-trips fixture reference values and upstream provenance", () =>
  Effect.gen(function*() {
    const wire =
      "{\"fixture\":\"numeric.scalar-parity\",\"metadata\":{\"generatedAt\":\"2026-03-23T00:00:00Z\",\"generator\":{\"script\":\"scripts/generate-scipy-fixtures.py\"},\"upstream\":{\"name\":\"scipy\",\"version\":\"1.15.2\"}},\"payload\":{\"cases\":[{\"id\":\"zero\",\"operation\":\"log1p\",\"input\":{\"x\":0},\"expected\":0}]}}"
    const codec = Schema.fromJsonString(KnownFixtureSchema)
    const decoded = yield* Schema.decodeEffect(codec, { onExcessProperty: "error" })(wire)
    expect(yield* Schema.encodeEffect(codec)(decoded)).toBe(wire)
  }))
