/**
 * FFT operation surface.
 *
 * @since 0.3.0
 * @category operations
 */
import { Chunk, Effect, Schema } from "effect"

import { withCustomPolicyGuards } from "../contracts/shared/PolicyGuards.js"
import { FftDecodeError, FftDomainViolationError, type FftOperationError } from "./errors.js"
import {
  circularConvolutionKernel,
  dft,
  isFiniteChunk,
  reconstructFullSpectrum,
  reconstructRealSpectrum,
  zeroChunk
} from "./internal/index.js"
import {
  fromComplexChunk as fromComplexChunkInternal,
  fromRealSignal as fromRealSignalInternal,
  toComplexChunk as toComplexChunkInternal,
  toRealSpectrum,
  toSequence
} from "./internal/sequence.js"
import { FftDomainModel, FftSequence, RealFftSpectrum } from "./model.js"
import {
  CircularConvolutionInput,
  type FftNormalizationMode,
  FftSequenceInput,
  RealSignalInput,
  RealSpectrumInput
} from "./schema.js"

/**
 * Lifts the FFT domain model into Effect pipelines.
 *
 * @since 0.3.0
 * @category operations
 */
export const loadFftDomain = Effect.succeed(FftDomainModel)

/**
 * Converts a complex sequence into its discrete Fourier spectrum.
 *
 * @since 0.3.0
 * @category operations
 */
export const fft = (
  sequence: FftSequence,
  normalization: FftNormalizationMode = sequence.normalization
): FftSequence =>
  toSequence(
    dft({
      real: sequence.real,
      imaginary: sequence.imaginary,
      normalization,
      direction: "forward"
    }),
    normalization
  )

/**
 * Converts a complex spectrum back into the time-domain sequence.
 *
 * @since 0.3.0
 * @category operations
 */
export const ifft = (
  sequence: FftSequence,
  normalization: FftNormalizationMode = sequence.normalization
): FftSequence =>
  toSequence(
    dft({
      real: sequence.real,
      imaginary: sequence.imaginary,
      normalization,
      direction: "inverse"
    }),
    normalization
  )

/**
 * Computes the positive-frequency spectrum for a real-valued signal.
 *
 * @since 0.3.0
 * @category operations
 */
export const rfft = (
  values: Chunk.Chunk<number>,
  normalization: FftNormalizationMode = "backward"
): RealFftSpectrum => {
  const spectrum = fft(fromRealSignal(values, normalization), normalization)
  const pairs = Chunk.toReadonlyArray(spectrum.real).map((real, index) => ({
    real,
    imaginary: Chunk.unsafeGet(spectrum.imaginary, index)
  }))

  return toRealSpectrum(
    Chunk.size(values),
    reconstructRealSpectrum(Chunk.size(values), pairs),
    normalization
  )
}

/**
 * Reconstructs a real-valued time-domain signal from a Hermitian half-spectrum.
 *
 * @since 0.3.0
 * @category operations
 */
export const irfft = (
  spectrum: RealFftSpectrum,
  normalization: FftNormalizationMode = spectrum.normalization
): Chunk.Chunk<number> => {
  const fullSpectrum = reconstructFullSpectrum(spectrum.signalLength, spectrum.real, spectrum.imaginary)
  const signal = ifft(toSequence(fullSpectrum, normalization), normalization)
  return signal.real
}

/**
 * Computes circular convolution of two equal-length real signals.
 *
 * @since 0.3.0
 * @category operations
 */
export const circularConvolution = (
  left: Chunk.Chunk<number>,
  right: Chunk.Chunk<number>,
  _normalization: FftNormalizationMode = "backward"
): Chunk.Chunk<number> => circularConvolutionKernel(left, right)

const decodeWith = <A, I>(schema: Schema.Schema<A, I, never>, input: unknown, operation: string) =>
  Schema.decodeUnknown(schema)(input, { onExcessProperty: "error" }).pipe(
    Effect.catchAll((error) => Effect.fail(new FftDecodeError({ operation, message: error.message })))
  )

/**
 * Boundary-validated `fft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const fftValidated = (input: unknown): Effect.Effect<FftSequence, FftOperationError> =>
  Effect.gen(function*() {
    const decoded = yield* decodeWith(FftSequenceInput, input, "fft")
    const imaginary = decoded.imaginary ?? zeroChunk(Chunk.size(decoded.real))
    return fft(makeFftSequence(decoded.real, imaginary, decoded.normalization), decoded.normalization)
  })

/**
 * Boundary-validated `ifft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const ifftValidated = (input: unknown): Effect.Effect<FftSequence, FftOperationError> =>
  Effect.gen(function*() {
    const decoded = yield* decodeWith(FftSequenceInput, input, "ifft")
    const imaginary = decoded.imaginary ?? zeroChunk(Chunk.size(decoded.real))
    return ifft(makeFftSequence(decoded.real, imaginary, decoded.normalization), decoded.normalization)
  })

/**
 * Boundary-validated `rfft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const rfftValidated = (input: unknown): Effect.Effect<RealFftSpectrum, FftOperationError> =>
  Effect.gen(function*() {
    const decoded = yield* decodeWith(RealSignalInput, input, "rfft")
    return rfft(decoded.values, decoded.normalization)
  })

/**
 * Boundary-validated `irfft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const irfftValidated = (input: unknown): Effect.Effect<Chunk.Chunk<number>, FftOperationError> =>
  Effect.gen(function*() {
    const decoded = yield* decodeWith(RealSpectrumInput, input, "irfft")

    return irfft(
      toRealSpectrum(
        decoded.signalLength,
        Chunk.toReadonlyArray(decoded.real).map((real, index) => ({
          real,
          imaginary: Chunk.unsafeGet(decoded.imaginary, index)
        })),
        decoded.normalization
      ),
      decoded.normalization
    )
  })

/**
 * Boundary-validated circular convolution.
 *
 * @since 0.3.0
 * @category operations
 */
export const circularConvolutionValidated = (
  input: unknown
): Effect.Effect<Chunk.Chunk<number>, FftOperationError> =>
  Effect.gen(function*() {
    const decoded = yield* decodeWith(CircularConvolutionInput, input, "circularConvolution")
    return circularConvolution(decoded.left, decoded.right, decoded.normalization)
  })

const isFiniteSequence = (sequence: FftSequence): boolean =>
  isFiniteChunk(sequence.real) && isFiniteChunk(sequence.imaginary)

/**
 * Policy-aware `fft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const fftWithPolicies = (sequence: FftSequence, normalization: FftNormalizationMode = sequence.normalization) =>
  withCustomPolicyGuards({
    operation: "fft",
    compute: () => fft(sequence, normalization),
    isValid: isFiniteSequence,
    makeError: (message) => new FftDomainViolationError({ operation: "fft", message }),
    annotations: (result) => ({ length: String(result.length), normalization: result.normalization })
  })

/**
 * Policy-aware `ifft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const ifftWithPolicies = (sequence: FftSequence, normalization: FftNormalizationMode = sequence.normalization) =>
  withCustomPolicyGuards({
    operation: "ifft",
    compute: () => ifft(sequence, normalization),
    isValid: isFiniteSequence,
    makeError: (message) => new FftDomainViolationError({ operation: "ifft", message }),
    annotations: (result) => ({ length: String(result.length), normalization: result.normalization })
  })

/**
 * Policy-aware `rfft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const rfftWithPolicies = (values: Chunk.Chunk<number>, normalization: FftNormalizationMode = "backward") =>
  withCustomPolicyGuards({
    operation: "rfft",
    compute: () => rfft(values, normalization),
    isValid: (result) => isFiniteChunk(result.real) && isFiniteChunk(result.imaginary),
    makeError: (message) => new FftDomainViolationError({ operation: "rfft", message }),
    annotations: (result) => ({ signalLength: String(result.signalLength), normalization: result.normalization })
  })

/**
 * Policy-aware `irfft`.
 *
 * @since 0.3.0
 * @category operations
 */
export const irfftWithPolicies = (
  spectrum: RealFftSpectrum,
  normalization: FftNormalizationMode = spectrum.normalization
) =>
  withCustomPolicyGuards({
    operation: "irfft",
    compute: () => irfft(spectrum, normalization),
    isValid: isFiniteChunk,
    makeError: (message) => new FftDomainViolationError({ operation: "irfft", message }),
    annotations: (result) => ({ length: String(Chunk.size(result)), normalization })
  })

/**
 * Policy-aware circular convolution.
 *
 * @since 0.3.0
 * @category operations
 */
export const circularConvolutionWithPolicies = (
  left: Chunk.Chunk<number>,
  right: Chunk.Chunk<number>,
  normalization: FftNormalizationMode = "backward"
) =>
  withCustomPolicyGuards({
    operation: "circularConvolution",
    compute: () => circularConvolution(left, right, normalization),
    isValid: isFiniteChunk,
    makeError: (message) => new FftDomainViolationError({ operation: "circularConvolution", message }),
    annotations: (result) => ({ length: String(Chunk.size(result)), normalization })
  })

/**
 * Lifts a real-valued signal into the FFT complex-sequence carrier.
 *
 * @since 0.3.0
 * @category operations
 */
export const fromRealSignal = fromRealSignalInternal

/**
 * Converts `Chunk<Complex>` values into the FFT complex-sequence carrier.
 *
 * @since 0.3.0
 * @category operations
 */
export const fromComplexChunk = fromComplexChunkInternal

/**
 * Projects an FFT sequence back into `Chunk<Complex>` values.
 *
 * @since 0.3.0
 * @category operations
 */
export const toComplexChunk = toComplexChunkInternal

/**
 * Constructs a canonical complex FFT sequence from real and imaginary chunks.
 *
 * @since 0.3.0
 * @category constructors
 */
export const makeFftSequence = (
  real: Chunk.Chunk<number>,
  imaginary: Chunk.Chunk<number>,
  normalization: FftNormalizationMode = "backward"
): FftSequence =>
  new FftSequence({
    length: Chunk.size(real),
    real,
    imaginary,
    normalization
  })

/**
 * Constructs a canonical Hermitian half-spectrum for `rfft` / `irfft` flows.
 *
 * @since 0.3.0
 * @category constructors
 */
export const makeRealFftSpectrum = (
  signalLength: number,
  real: Chunk.Chunk<number>,
  imaginary: Chunk.Chunk<number>,
  normalization: FftNormalizationMode = "backward"
): RealFftSpectrum =>
  new RealFftSpectrum({
    signalLength,
    real,
    imaginary,
    normalization
  })
