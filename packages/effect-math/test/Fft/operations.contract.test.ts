import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number as N } from "effect"
import * as Arr from "effect/Array"

import { circularConvolution, fft, fromRealSignal, ifft, irfft, rfft } from "../../src/Fft/index.js"

const TOLERANCE = 1e-9

const expectClose = (actual: number, expected: number, tolerance: number = TOLERANCE) =>
  expect(Math.abs(N.subtract(actual, expected))).toBeLessThanOrEqual(tolerance)

const expectChunkClose = (
  actual: Chunk.Chunk<number>,
  expected: ReadonlyArray<number>,
  tolerance: number = TOLERANCE
) => {
  const values = Chunk.toReadonlyArray(actual)
  expect(values.length).toStrictEqual(expected.length)
  values.forEach((value, index) => expectClose(value, expected[index]!, tolerance))
}

describe("Fft / operations", () => {
  it.effect("fft + ifft round-trips a power-of-two real signal under backward normalization", () =>
    Effect.gen(function*() {
      const signal = Chunk.fromIterable([0, 1, 0, -1, 0, 1, 0, -1])
      const transformed = fft(fromRealSignal(signal, "backward"), "backward")
      const recovered = ifft(transformed, "backward")

      expectChunkClose(recovered.real, Chunk.toReadonlyArray(signal))
      expectChunkClose(recovered.imaginary, Arr.map(Arr.range(0, Chunk.size(signal) - 1), () => 0))
    }))

  it.effect("fft + ifft round-trips a prime-length real signal under ortho normalization", () =>
    Effect.gen(function*() {
      const signal = Chunk.fromIterable([1, 2, 3, 4, 5])
      const transformed = fft(fromRealSignal(signal, "ortho"), "ortho")
      const recovered = ifft(transformed, "ortho")

      expectChunkClose(recovered.real, Chunk.toReadonlyArray(signal))
      expectChunkClose(recovered.imaginary, Arr.map(Arr.range(0, Chunk.size(signal) - 1), () => 0))
    }))

  it.effect("rfft + irfft round-trips even and odd real signals", () =>
    Effect.gen(function*() {
      const evenSignal = Chunk.fromIterable([1, 2, 3, 4, 5, 6, 7, 8])
      const oddSignal = Chunk.fromIterable([2, -1, 0, 3, 1])

      const evenSpectrum = rfft(evenSignal, "backward")
      const oddSpectrum = rfft(oddSignal, "forward")

      expectChunkClose(irfft(evenSpectrum, "backward"), Chunk.toReadonlyArray(evenSignal))
      expectChunkClose(irfft(oddSpectrum, "forward"), Chunk.toReadonlyArray(oddSignal))
    }))

  it.effect("preserves NumPy-compatible normalization scaling on the impulse spectrum", () =>
    Effect.gen(function*() {
      const impulse = Chunk.fromIterable([1, 0, 0, 0])
      const backward = fft(fromRealSignal(impulse, "backward"), "backward")
      const forward = fft(fromRealSignal(impulse, "forward"), "forward")
      const ortho = fft(fromRealSignal(impulse, "ortho"), "ortho")

      expectChunkClose(backward.real, [1, 1, 1, 1])
      expectChunkClose(forward.real, [0.25, 0.25, 0.25, 0.25])
      expectChunkClose(ortho.real, [0.5, 0.5, 0.5, 0.5])
      expectChunkClose(backward.imaginary, [0, 0, 0, 0])
      expectChunkClose(forward.imaginary, [0, 0, 0, 0])
      expectChunkClose(ortho.imaginary, [0, 0, 0, 0])
    }))

  it.effect("matches direct circular convolution on a prime-length signal", () =>
    Effect.gen(function*() {
      const left = Chunk.fromIterable([1, 2, 3, 4, 5])
      const right = Chunk.fromIterable([1, 0, 1, 0, 0])
      const result = circularConvolution(left, right)

      expectChunkClose(result, [5, 7, 4, 6, 8])
    }))
})
