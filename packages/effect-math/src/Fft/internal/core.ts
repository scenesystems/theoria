import { Chunk, Number as N } from "effect"
import * as Arr from "effect/Array"

import { cos, PI, sin, sqrt } from "../../Numeric/operations.js"
import type { FftNormalizationMode } from "../schema.js"

export type ComplexPair = Readonly<{
  real: number
  imaginary: number
}>

const toPair = (real: number, imaginary: number): ComplexPair => ({ real, imaginary })

const scalePair = (value: ComplexPair, scale: number): ComplexPair =>
  toPair(N.multiply(value.real, scale), N.multiply(value.imaginary, scale))

const multiplyPairs = (left: ComplexPair, right: ComplexPair): ComplexPair =>
  toPair(
    N.subtract(N.multiply(left.real, right.real), N.multiply(left.imaginary, right.imaginary)),
    N.sum(N.multiply(left.real, right.imaginary), N.multiply(left.imaginary, right.real))
  )

const directionSign = (direction: "forward" | "inverse"): number => direction === "forward" ? -1 : 1

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

const isPowerOfTwo = (length: number): boolean => length > 0 && (length & (length - 1)) === 0

const nextPowerOfTwo = (length: number, power: number = 1): number =>
  power >= length ? power : nextPowerOfTwo(length, power << 1)

const zeroPairs = (length: number): Array<ComplexPair> => Arr.map(Arr.range(0, length - 1), () => toPair(0, 0))

const chirp = (sign: number, index: number, length: number): ComplexPair => {
  const phase = N.unsafeDivide(N.multiply(N.multiply(sign, PI), N.multiply(index, index)), length)

  return toPair(cos(phase), sin(phase))
}

const nextBitReversedIndex = (length: number, reversedIndex: number): number => {
  const step = (bit: number, currentIndex: number): number =>
    (currentIndex & bit) !== 0
      ? step(bit >> 1, currentIndex ^ bit)
      : currentIndex ^ bit

  return step(length >> 1, reversedIndex)
}

const swapIndices = (real: Array<number>, imaginary: Array<number>, index: number, reversedIndex: number): void => {
  const realValue = real[index]!
  const imaginaryValue = imaginary[index]!

  real[index] = real[reversedIndex]!
  imaginary[index] = imaginary[reversedIndex]!
  real[reversedIndex] = realValue
  imaginary[reversedIndex] = imaginaryValue
}

const twiddle = (phase: number, offset: number): ComplexPair =>
  toPair(cos(N.multiply(phase, offset)), sin(N.multiply(phase, offset)))

const applyButterfly = (options: {
  readonly evenIndex: number
  readonly oddIndex: number
  readonly real: Array<number>
  readonly imaginary: Array<number>
  readonly twiddle: ComplexPair
}): void => {
  const oddReal = options.real[options.oddIndex]!
  const oddImaginary = options.imaginary[options.oddIndex]!
  const tempReal = N.subtract(
    N.multiply(options.twiddle.real, oddReal),
    N.multiply(options.twiddle.imaginary, oddImaginary)
  )
  const tempImaginary = N.sum(
    N.multiply(options.twiddle.real, oddImaginary),
    N.multiply(options.twiddle.imaginary, oddReal)
  )
  const evenReal = options.real[options.evenIndex]!
  const evenImaginary = options.imaginary[options.evenIndex]!

  options.real[options.oddIndex] = N.subtract(evenReal, tempReal)
  options.imaginary[options.oddIndex] = N.subtract(evenImaginary, tempImaginary)
  options.real[options.evenIndex] = N.sum(evenReal, tempReal)
  options.imaginary[options.evenIndex] = N.sum(evenImaginary, tempImaginary)
}

const transformPowerOfTwo = (
  input: ReadonlyArray<ComplexPair>,
  direction: "forward" | "inverse"
): Array<ComplexPair> => {
  const length = input.length

  if (length === 1) {
    return Arr.fromIterable(input)
  }

  const real = input.map((value) => value.real)
  const imaginary = input.map((value) => value.imaginary)
  const reorderState = { reversedIndex: 0 }

  real.forEach((_, index) => {
    if (index === 0) {
      return
    }

    const nextReversedIndex = nextBitReversedIndex(length, reorderState.reversedIndex)

    if (index < nextReversedIndex) {
      swapIndices(real, imaginary, index, nextReversedIndex)
    }

    reorderState.reversedIndex = nextReversedIndex
  })

  const runStages = (size: number): void => {
    if (size > length) {
      return
    }

    const halfSize = size >> 1
    const phase = N.unsafeDivide(N.multiply(directionSign(direction), N.multiply(2, PI)), size)

    real.forEach((_, evenIndex) => {
      const offset = evenIndex % size

      if (offset < halfSize) {
        applyButterfly({
          evenIndex,
          oddIndex: N.sum(evenIndex, halfSize),
          real,
          imaginary,
          twiddle: twiddle(phase, offset)
        })
      }
    })

    return runStages(size << 1)
  }

  runStages(2)

  return real.map((value, valueIndex) => toPair(value, imaginary[valueIndex]!))
}

const transformBluestein = (
  input: ReadonlyArray<ComplexPair>,
  direction: "forward" | "inverse"
): Array<ComplexPair> => {
  const length = input.length
  const sign = directionSign(direction)
  const convolutionLength = nextPowerOfTwo(N.subtract(N.multiply(2, length), 1))
  const left = zeroPairs(convolutionLength)
  const right = zeroPairs(convolutionLength)

  right[0] = toPair(1, 0)

  input.forEach((value, index) => {
    left[index] = multiplyPairs(value, chirp(sign, index, length))
  })

  if (length > 1) {
    input.forEach((_, index) => {
      if (index === 0) {
        return
      }

      const kernel = chirp(N.negate(sign), index, length)

      right[index] = kernel
      right[convolutionLength - index] = kernel

      return undefined
    })
  }

  const leftSpectrum = transformPowerOfTwo(left, "forward")
  const rightSpectrum = transformPowerOfTwo(right, "forward")
  const productSpectrum = leftSpectrum.map((value, index) => multiplyPairs(value, rightSpectrum[index]!))
  const convolved = transformPowerOfTwo(productSpectrum, "inverse")
  const inverseScale = N.unsafeDivide(1, convolutionLength)

  return input.map((_, index) => multiplyPairs(scalePair(convolved[index]!, inverseScale), chirp(sign, index, length)))
}

const transform = (
  input: ReadonlyArray<ComplexPair>,
  direction: "forward" | "inverse"
): Array<ComplexPair> =>
  isPowerOfTwo(input.length)
    ? transformPowerOfTwo(input, direction)
    : transformBluestein(input, direction)

export const dft = (options: {
  readonly real: Chunk.Chunk<number>
  readonly imaginary: Chunk.Chunk<number>
  readonly normalization: FftNormalizationMode
  readonly direction: "forward" | "inverse"
}): Array<ComplexPair> => {
  const real = Chunk.toReadonlyArray(options.real)
  const imaginary = Chunk.toReadonlyArray(options.imaginary)
  const scale = normalizationScale(options.direction, options.normalization, real.length)

  return transform(
    real.map((value, index) => toPair(value, imaginary[index]!)),
    options.direction
  ).map((value) => scalePair(value, scale))
}

export const expectedHalfSpectrumSize = (signalLength: number): number => Math.floor(signalLength / 2) + 1

export const zeroChunk = (length: number): Chunk.Chunk<number> =>
  Chunk.fromIterable(length > 0 ? Arr.map(Arr.range(0, length - 1), () => 0) : [])

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
      : toPair(halfReal[signalLength - index]!, N.negate(halfImaginary[signalLength - index]!)))
}
