import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect } from "effect"

import {
  circularConvolutionValidated,
  fftValidated,
  ifftValidated,
  irfftValidated,
  rfftValidated
} from "../../src/Fft/index.js"

describe("Fft / runtime boundary contracts", () => {
  it.effect("accepts canonical valid FFT and real-spectrum boundary payloads", () =>
    Effect.gen(function*() {
      const fftResult = yield* fftValidated({
        real: [1, 0, 0, 0],
        imaginary: [0, 0, 0, 0],
        normalization: "backward"
      })
      const ifftResult = yield* ifftValidated({
        real: Chunk.toReadonlyArray(fftResult.real),
        imaginary: Chunk.toReadonlyArray(fftResult.imaginary),
        normalization: "backward"
      })
      const realSpectrum = yield* rfftValidated({
        values: [1, 2, 3, 4, 5],
        normalization: "ortho"
      })
      const reconstructed = yield* irfftValidated({
        signalLength: realSpectrum.signalLength,
        real: Chunk.toReadonlyArray(realSpectrum.real),
        imaginary: Chunk.toReadonlyArray(realSpectrum.imaginary),
        normalization: "ortho"
      })

      expect(Chunk.toReadonlyArray(fftResult.real)).toStrictEqual([1, 1, 1, 1])
      Chunk.toReadonlyArray(ifftResult.real).forEach((value, index) => {
        expect(value).toBeCloseTo([1, 0, 0, 0][index]!, 12)
      })
      expect(Chunk.toReadonlyArray(reconstructed)).toHaveLength(5)
    }))

  it.effect("rejects invalid lengths, invalid normalization, and malformed real-spectrum shapes", () =>
    Effect.gen(function*() {
      const invalidLength = yield* Effect.either(fftValidated({
        real: [],
        normalization: "backward"
      }))
      const invalidNormalization = yield* Effect.either(rfftValidated({
        values: [1, 2, 3],
        normalization: "diagonal"
      }))
      const invalidSpectrumShape = yield* Effect.either(irfftValidated({
        signalLength: 6,
        real: [1, 2, 3],
        imaginary: [0, 0, 1],
        normalization: "backward"
      }))
      const invalidConvolution = yield* Effect.either(circularConvolutionValidated({
        left: [1, 2, 3],
        right: [1, 2],
        normalization: "backward"
      }))

      expect(invalidLength._tag).toStrictEqual("Left")
      expect(invalidNormalization._tag).toStrictEqual("Left")
      expect(invalidSpectrumShape._tag).toStrictEqual("Left")
      expect(invalidConvolution._tag).toStrictEqual("Left")
    }))

  it.effect("rejects excess properties at runtime boundaries", () =>
    Effect.gen(function*() {
      const fftResult = yield* Effect.either(fftValidated({
        real: [1, 0, 0, 0],
        imaginary: [0, 0, 0, 0],
        normalization: "backward",
        extra: true
      }))
      const irfftResult = yield* Effect.either(irfftValidated({
        signalLength: 4,
        real: [1, 0, 1],
        imaginary: [0, 0, 0],
        normalization: "backward",
        extra: true
      }))

      expect(fftResult._tag).toStrictEqual("Left")
      expect(irfftResult._tag).toStrictEqual("Left")
    }))
})
