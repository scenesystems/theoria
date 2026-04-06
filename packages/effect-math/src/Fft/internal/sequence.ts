import { Chunk } from "effect"
import * as Arr from "effect/Array"

import { Complex } from "../../Complex/model.js"
import {
  FftSequence,
  type FftSequence as FftSequenceType,
  RealFftSpectrum,
  type RealFftSpectrum as RealFftSpectrumType
} from "../model.js"
import type { FftNormalizationMode } from "../schema.js"

/**
 * Lifts a real-valued signal into the complex FFT sequence carrier.
 *
 * @since 0.3.0
 * @category operations
 */
export const fromRealSignal = (
  values: Chunk.Chunk<number>,
  normalization: FftNormalizationMode = "backward"
): FftSequenceType =>
  new FftSequence({
    length: Chunk.size(values),
    real: values,
    imaginary: Chunk.fromIterable(Arr.map(Arr.range(0, Chunk.size(values) - 1), () => 0)),
    normalization
  })

/**
 * Converts a `Chunk<Complex>` into the FFT sequence carrier.
 *
 * @since 0.3.0
 * @category operations
 */
export const fromComplexChunk = (
  values: Chunk.Chunk<Complex>,
  normalization: FftNormalizationMode = "backward"
): FftSequenceType =>
  new FftSequence({
    length: Chunk.size(values),
    real: Chunk.map(values, (value) => value.re),
    imaginary: Chunk.map(values, (value) => value.im),
    normalization
  })

/**
 * Projects an FFT sequence back into `Chunk<Complex>` values.
 *
 * @since 0.3.0
 * @category operations
 */
export const toComplexChunk = (sequence: FftSequenceType): Chunk.Chunk<Complex> =>
  Chunk.fromIterable(
    Chunk.toReadonlyArray(sequence.real).map(
      (real, index) => new Complex({ re: real, im: Chunk.unsafeGet(sequence.imaginary, index) })
    )
  )

export const toRealSpectrum = (
  signalLength: number,
  values: ReadonlyArray<Readonly<{ real: number; imaginary: number }>>,
  normalization: FftNormalizationMode
): RealFftSpectrumType =>
  new RealFftSpectrum({
    signalLength,
    real: Chunk.fromIterable(values.map((value) => value.real)),
    imaginary: Chunk.fromIterable(values.map((value) => value.imaginary)),
    normalization
  })

export const toSequence = (
  values: ReadonlyArray<Readonly<{ real: number; imaginary: number }>>,
  normalization: FftNormalizationMode
): FftSequenceType =>
  new FftSequence({
    length: values.length,
    real: Chunk.fromIterable(values.map((value) => value.real)),
    imaginary: Chunk.fromIterable(values.map((value) => value.imaginary)),
    normalization
  })
