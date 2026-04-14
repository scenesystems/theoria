import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Match, Number as N, Schema } from "effect"

import { fft, ifft, irfft, makeFftSequence, makeRealFftSpectrum, rfft } from "../../src/Fft/index.js"
import { FftTransformParityFixtureSchema, FixtureRegistryLive, loadFixture } from "../helpers/fixtures/index.js"

const DEFAULT_TOLERANCE = 1e-9

const expectParity = (actual: number, expected: number, absoluteTol: number = DEFAULT_TOLERANCE) => {
  const absExpected = Math.abs(expected)
  const tolerance = absExpected > 1 ? N.multiply(absExpected, 1e-9) : absoluteTol
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)
}

const expectChunkParity = (
  actual: Chunk.Chunk<number>,
  expected: ReadonlyArray<number>,
  tolerance: number = DEFAULT_TOLERANCE
) => {
  const values = Chunk.toReadonlyArray(actual)
  expect(values.length).toStrictEqual(expected.length)
  values.forEach((value, index) => expectParity(value, expected[index]!, tolerance))
}

describe("Fft parity fixtures", () => {
  it.effect("matches committed NumPy/SciPy FFT fixture cases", () =>
    Effect.gen(function*() {
      const raw = yield* loadFixture("fft.transform-parity")
      const fixture = yield* Schema.decodeUnknown(FftTransformParityFixtureSchema)(raw, {
        onExcessProperty: "error"
      })

      yield* Effect.forEach(Arr.fromIterable(fixture.payload.cases), (entry) =>
        Effect.sync(() =>
          Match.value(entry).pipe(
            Match.when({ operation: "fft" }, (value) => {
              const result = fft(
                makeFftSequence(
                  Chunk.fromIterable(value.input.real),
                  Chunk.fromIterable(value.input.imaginary),
                  value.input.normalization
                ),
                value.input.normalization
              )
              expectChunkParity(result.real, value.expected.real)
              expectChunkParity(result.imaginary, value.expected.imaginary)
            }),
            Match.when({ operation: "ifft" }, (value) => {
              const result = ifft(
                makeFftSequence(
                  Chunk.fromIterable(value.input.real),
                  Chunk.fromIterable(value.input.imaginary),
                  value.input.normalization
                ),
                value.input.normalization
              )
              expectChunkParity(result.real, value.expected.real)
              expectChunkParity(result.imaginary, value.expected.imaginary)
            }),
            Match.when({ operation: "rfft" }, (value) => {
              const result = rfft(Chunk.fromIterable(value.input.values), value.input.normalization)
              expectChunkParity(result.real, value.expected.real)
              expectChunkParity(result.imaginary, value.expected.imaginary)
            }),
            Match.when({ operation: "irfft" }, (value) => {
              const result = irfft(
                makeRealFftSpectrum(
                  value.input.signalLength,
                  Chunk.fromIterable(value.input.real),
                  Chunk.fromIterable(value.input.imaginary),
                  value.input.normalization
                ),
                value.input.normalization
              )
              expectChunkParity(result, value.expected)
            }),
            Match.exhaustive
          )
        ))
    }).pipe(Effect.provide(FixtureRegistryLive)))
})
