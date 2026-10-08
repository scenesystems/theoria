import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Array, Effect, Schema } from "effect"
import { directoryBeside, findManifestEntry, loadFixtureByEntry, loadManifest } from "./helpers/fixtures/io.js"
import { FixtureManifestSchema, KnownFixtureSchema } from "./helpers/fixtures/schemas.js"

const sha256 = "230413ca6154ca4015e70634702a71ba5b9a2c9e46d0333d5126f786784e0720"
const zeroSha256 = Array.join(Array.replicate("0", 64), "")

const manifestWire = (entry: string) =>
  Array.join(
    Array.make(
      "{\"generator\":{\"script\":\"scripts/generate-scipy-fixtures.py\",\"upstream\":\"scipy\",\"upstreamVersion\":\"1.17.1\",\"numpyVersion\":\"1.26.4\",\"pythonVersion\":\"3.13.5\",\"generatedAt\":\"2026-03-23T00:00:00Z\"},\"provenance\":{\"cpuDispatch\":{\"observation\":\"AVX-512 dispatch reproduced committed bytes.\",\"generatorPinnedEnvironment\":[\"PYTHONHASHSEED\"],\"cpuSensitiveFiles\":[\"numeric/scalar-parity.json\"],\"evidence\":{\"file\":\"numeric/scalar-parity.json\",\"case\":\"expm1-one\",\"operation\":\"numpy.expm1\",\"input\":\"1.0\",\"committed\":\"1.7182818284590453\",\"avx512fDisabled\":\"1.718281828459045\"}}},\"fixtures\":[",
      entry,
      "]}"
    ),
    ""
  )

const manifestCodec = Schema.fromJsonString(FixtureManifestSchema)

const committedEntry = Effect.gen(function*() {
  const root = yield* directoryBeside(import.meta.url, "./fixtures/scipy/")
  const manifest = yield* loadManifest(root, "manifest.json")
  const entry = yield* Effect.fromOption(findManifestEntry(manifest, "numeric.scalar-parity"))
  return { root, entry }
})

it.effect("round-trips manifest provenance and fixture SHA-256 without application format fields", () =>
  Effect.gen(function*() {
    const wire = manifestWire(
      Array.join(
        Array.make(
          "{\"name\":\"numeric.scalar-parity\",\"file\":\"numeric/scalar-parity.json\",\"sha256\":\"",
          sha256,
          "\"}"
        ),
        ""
      )
    )
    const decoded = yield* Schema.decodeEffect(manifestCodec, { onExcessProperty: "error" })(wire)
    expect(yield* Schema.encodeEffect(manifestCodec)(decoded)).toBe(wire)
  }))

it.effect("rejects manifest entries without a lowercase hexadecimal SHA-256", () =>
  Effect.gen(function*() {
    const decode = Schema.decodeEffect(manifestCodec, { onExcessProperty: "error" })
    const missing = yield* Effect.result(
      decode(manifestWire("{\"name\":\"numeric.scalar-parity\",\"file\":\"numeric/scalar-parity.json\"}"))
    )
    const uppercase = yield* Effect.result(
      decode(
        manifestWire(
          Array.join(
            Array.make(
              "{\"name\":\"numeric.scalar-parity\",\"file\":\"numeric/scalar-parity.json\",\"sha256\":\"",
              Array.join(Array.replicate("A", 64), ""),
              "\"}"
            ),
            ""
          )
        )
      )
    )
    expect(missing._tag).toBe("Failure")
    expect(uppercase._tag).toBe("Failure")
  }))

it.effect("loads a committed fixture only when its bytes match the manifest SHA-256", () =>
  Effect.gen(function*() {
    const { entry, root } = yield* committedEntry
    const fixture = yield* loadFixtureByEntry(root, entry)
    const mismatch = yield* Effect.flip(loadFixtureByEntry(root, { ...entry, sha256: zeroSha256 }))

    expect(fixture.fixture).toBe("numeric.scalar-parity")
    expect(mismatch).toMatchObject({
      _tag: "FixtureHashMismatchError",
      fixture: "numeric.scalar-parity",
      expected: zeroSha256,
      actual: entry.sha256
    })
  }).pipe(Effect.provide(BunServices.layer)))

it.effect("round-trips fixture reference values and upstream provenance", () =>
  Effect.gen(function*() {
    const wire =
      "{\"fixture\":\"numeric.scalar-parity\",\"metadata\":{\"generatedAt\":\"2026-03-23T00:00:00Z\",\"generator\":{\"script\":\"scripts/generate-scipy-fixtures.py\"},\"upstream\":{\"name\":\"scipy\",\"version\":\"1.15.2\"}},\"payload\":{\"cases\":[{\"id\":\"zero\",\"operation\":\"log1p\",\"input\":{\"x\":0},\"expected\":0}]}}"
    const codec = Schema.fromJsonString(KnownFixtureSchema)
    const decoded = yield* Schema.decodeEffect(codec, { onExcessProperty: "error" })(wire)
    expect(yield* Schema.encodeEffect(codec)(decoded)).toBe(wire)
  }))
