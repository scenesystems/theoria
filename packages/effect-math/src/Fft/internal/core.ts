import { Chunk, Number as N } from "effect"
import * as Arr from "effect/Array"

import type { Complex } from "../../Complex/model.js"
import { add as addComplex, fromPolar, multiply as multiplyComplex, of } from "../../Complex/operations.js"
import { PI, sqrt } from "../../Numeric/operations.js"
import type { FftNormalizationMode } from "../schema.js"

export type ComplexPair = Readonly<{
  real: number
  imaginary: number
}>

const toPair = (real: number, imaginary: number): ComplexPair => ({ real, imaginary })

const pairFromComplex = (value: Complex): ComplexPair => toPair(value.re, value.im)

const phaseAngle = (
  outputIndex: number,
  inputIndex: number,
  size: number,
  direction: "forward" | "inverse"
): number => {
  const sign = direction === "forward" ? -1 : 1

  return N.unsafeDivide(N.multiply(N.multiply(N.multiply(N.multiply(sign, 2), PI), outputIndex), inputIndex), size)
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

const dftAtIndex = (
  real: ReadonlyArray<number>,
  imaginary: ReadonlyArray<number>,
  outputIndex: number,
  direction: "forward" | "inverse"
): ComplexPair => {
  const size = real.length

  return pairFromComplex(
    real.reduce<Complex>((accumulator, value, inputIndex) => {
      const sample = of(value, imaginary[inputIndex]!)
      const phase = fromPolar(1, phaseAngle(outputIndex, inputIndex, size, direction))

      return addComplex(accumulator, multiplyComplex(sample, phase))
    }, of(0, 0))
  )
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
