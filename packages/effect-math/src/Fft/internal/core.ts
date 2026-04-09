import { Chunk, Number as N } from "effect"
import * as Arr from "effect/Array"

import { cos, PI, sin, sqrt } from "../../Numeric/operations.js"
import type { FftNormalizationMode } from "../schema.js"

export type ComplexPair = Readonly<{
  real: number
  imaginary: number
}>

const toPair = (real: number, imaginary: number): ComplexPair => ({ real, imaginary })

const basePhaseAngle = (
  outputIndex: number,
  size: number,
  direction: "forward" | "inverse"
): number => {
  const sign = direction === "forward" ? -1 : 1

  return N.unsafeDivide(N.multiply(N.multiply(N.multiply(sign, 2), PI), outputIndex), size)
}

const normalizationScale = (
  direction: "forward" | "inverse",
  normalization: FftNormalizationMode,
  length: number
): number =>
  normalization === "ortho"
    ? N.unsafeDivide(1, sqrt(length))
    : normalization === "forward"
    ? direction === "forward" ? N.unsafeDivide(1, length) : 1
    : direction === "inverse"
    ? N.unsafeDivide(1, length)
    : 1

type DftAccumulator = Readonly<{
  sumReal: number
  sumImaginary: number
  twiddleReal: number
  twiddleImaginary: number
}>

const nextTwiddle = (
  twiddleReal: number,
  twiddleImaginary: number,
  stepReal: number,
  stepImaginary: number
): ComplexPair =>
  toPair(
    N.subtract(N.multiply(twiddleReal, stepReal), N.multiply(twiddleImaginary, stepImaginary)),
    N.sum(N.multiply(twiddleReal, stepImaginary), N.multiply(twiddleImaginary, stepReal))
  )

const dftAtIndex = (
  real: ReadonlyArray<number>,
  imaginary: ReadonlyArray<number>,
  outputIndex: number,
  direction: "forward" | "inverse"
): ComplexPair => {
  const angle = basePhaseAngle(outputIndex, real.length, direction)
  const stepReal = cos(angle)
  const stepImaginary = sin(angle)

  const state = real.reduce<DftAccumulator>((accumulator, value, inputIndex) => {
    const sampleImaginary = imaginary[inputIndex]!
    const contributionReal = N.subtract(
      N.multiply(value, accumulator.twiddleReal),
      N.multiply(sampleImaginary, accumulator.twiddleImaginary)
    )
    const contributionImaginary = N.sum(
      N.multiply(value, accumulator.twiddleImaginary),
      N.multiply(sampleImaginary, accumulator.twiddleReal)
    )
    const next = nextTwiddle(
      accumulator.twiddleReal,
      accumulator.twiddleImaginary,
      stepReal,
      stepImaginary
    )

    return {
      sumReal: N.sum(accumulator.sumReal, contributionReal),
      sumImaginary: N.sum(accumulator.sumImaginary, contributionImaginary),
      twiddleReal: next.real,
      twiddleImaginary: next.imaginary
    }
  }, {
    sumReal: 0,
    sumImaginary: 0,
    twiddleReal: 1,
    twiddleImaginary: 0
  })

  return toPair(state.sumReal, state.sumImaginary)
}

export const dft = (options: {
  readonly real: Chunk.Chunk<number>
  readonly imaginary: Chunk.Chunk<number>
  readonly normalization: FftNormalizationMode
  readonly direction: "forward" | "inverse"
}): Array<ComplexPair> => {
  const real = Chunk.toReadonlyArray(options.real)
  const imaginary = Chunk.toReadonlyArray(options.imaginary)
  const scale = normalizationScale(options.direction, options.normalization, real.length)

  return Arr.map(Arr.range(0, real.length - 1), (outputIndex) => {
    const value = dftAtIndex(real, imaginary, outputIndex, options.direction)
    return toPair(N.multiply(value.real, scale), N.multiply(value.imaginary, scale))
  })
}

export const expectedHalfSpectrumSize = (signalLength: number): number => Math.floor(signalLength / 2) + 1

export const zeroChunk = (length: number): Chunk.Chunk<number> =>
  Chunk.fromIterable(Arr.map(Arr.range(0, length - 1), () => 0))

export const isFiniteChunk = (values: Chunk.Chunk<number>): boolean =>
  Chunk.toReadonlyArray(values).every(Number.isFinite)

export const reconstructRealSpectrum = (signalLength: number, spectrum: Array<ComplexPair>): Array<ComplexPair> =>
  spectrum.slice(0, expectedHalfSpectrumSize(signalLength))

export const reconstructFullSpectrum = (
  signalLength: number,
  real: Chunk.Chunk<number>,
  imaginary: Chunk.Chunk<number>
): Array<ComplexPair> => {
  const halfReal = Chunk.toReadonlyArray(real)
  const halfImaginary = Chunk.toReadonlyArray(imaginary)

  return Arr.map(Arr.range(0, signalLength - 1), (index) =>
    index < halfReal.length
      ? toPair(halfReal[index]!, halfImaginary[index]!)
      : toPair(halfReal[signalLength - index]!, -halfImaginary[signalLength - index]!))
}
