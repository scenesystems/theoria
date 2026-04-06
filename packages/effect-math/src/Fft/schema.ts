/**
 * FFT domain schemas and boundary helpers.
 *
 * @since 0.3.0
 * @category schemas
 */
import { Chunk, Effect, Option, Schema } from "effect"

import { BoundaryDecodeError, BoundaryEncodeError } from "../contracts/shared/BoundaryErrors.js"
import { DomainStability } from "../contracts/shared/DomainStability.js"

const PositiveFiniteInteger = Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.greaterThan(0))
const FiniteNumber = Schema.Number.pipe(Schema.finite())
const ZERO_TOLERANCE = 1e-12
const NonEmptyFiniteChunk = Schema.Chunk(FiniteNumber).pipe(
  Schema.filter((values) => Chunk.size(values) > 0 || "Expected a non-empty sequence")
)

/**
 * NumPy-compatible FFT normalization modes.
 *
 * @since 0.3.0
 * @category schemas
 */
export const FftNormalizationMode = Schema.Literal("backward", "forward", "ortho")

/**
 * FFT normalization mode type.
 *
 * @since 0.3.0
 * @category models
 */
export type FftNormalizationMode = typeof FftNormalizationMode.Type

/**
 * Canonical FFT domain schema.
 *
 * @since 0.3.0
 * @category schemas
 */
export const FftDomainSchema = Schema.Struct({
  domain: Schema.Literal("Fft"),
  stability: DomainStability
})

/**
 * FFT domain model type.
 *
 * @since 0.3.0
 * @category models
 */
export type FftDomain = typeof FftDomainSchema.Type

/**
 * Decodes unknown input into the canonical FFT domain model.
 *
 * @since 0.3.0
 * @category schemas
 */
export const decodeFftDomain = (input: unknown) =>
  Schema.decodeUnknown(FftDomainSchema)(input, { onExcessProperty: "error" }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryDecodeError({
          domain: "Fft",
          contract: "FftDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Encodes the canonical FFT domain model.
 *
 * @since 0.3.0
 * @category schemas
 */
export const encodeFftDomain = (domain: FftDomain) =>
  Schema.encode(FftDomainSchema)(domain).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new BoundaryEncodeError({
          domain: "Fft",
          contract: "FftDomainSchema",
          message: error.message
        })
      )
    )
  )

/**
 * Complex-sequence input for `fft` and `ifft`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const FftSequenceInput = Schema.Struct({
  real: NonEmptyFiniteChunk,
  imaginary: Schema.optional(NonEmptyFiniteChunk),
  normalization: Schema.optionalWith(FftNormalizationMode, { default: () => "backward" })
}).pipe(
  Schema.filter((input) =>
    (Option.match(Option.fromNullable(input.imaginary), {
      onNone: () => true,
      onSome: (imaginary) => Chunk.size(input.real) === Chunk.size(imaginary)
    })) ||
    "Expected real and imaginary parts to have identical lengths"
  )
).annotations({ identifier: "FftSequenceInput" })

/**
 * Real-signal input for `rfft`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const RealSignalInput = Schema.Struct({
  values: NonEmptyFiniteChunk,
  normalization: Schema.optionalWith(FftNormalizationMode, { default: () => "backward" })
}).annotations({ identifier: "RealSignalInput" })

const expectedHalfSpectrumSize = (signalLength: number) => Math.floor(signalLength / 2) + 1

/**
 * Real-spectrum input for `irfft`.
 *
 * @since 0.3.0
 * @category schemas
 */
export const RealSpectrumInput = Schema.Struct({
  signalLength: PositiveFiniteInteger,
  real: NonEmptyFiniteChunk,
  imaginary: NonEmptyFiniteChunk,
  normalization: Schema.optionalWith(FftNormalizationMode, { default: () => "backward" })
}).pipe(
  Schema.filter((input) => {
    const halfSpectrumSize = expectedHalfSpectrumSize(input.signalLength)
    const matchingLengths = Chunk.size(input.real) === halfSpectrumSize &&
      Chunk.size(input.imaginary) === halfSpectrumSize
    const zeroFrequencyImaginary = matchingLengths
      ? Math.abs(Chunk.unsafeGet(input.imaginary, 0)) <= ZERO_TOLERANCE
      : true
    const nyquistImaginary = matchingLengths && input.signalLength % 2 === 0
      ? Math.abs(Chunk.unsafeGet(input.imaginary, halfSpectrumSize - 1)) <= ZERO_TOLERANCE
      : true

    return (
      (matchingLengths && zeroFrequencyImaginary && nyquistImaginary) ||
      "Expected Hermitian half-spectrum with matching length, zero DC imaginary part, and zero Nyquist imaginary part for even signal lengths"
    )
  })
).annotations({ identifier: "RealSpectrumInput" })

/**
 * Circular-convolution input.
 *
 * @since 0.3.0
 * @category schemas
 */
export const CircularConvolutionInput = Schema.Struct({
  left: NonEmptyFiniteChunk,
  right: NonEmptyFiniteChunk,
  normalization: Schema.optionalWith(FftNormalizationMode, { default: () => "backward" })
}).pipe(
  Schema.filter((input) =>
    Chunk.size(input.left) === Chunk.size(input.right) || "Expected equal-length circular-convolution signals"
  )
).annotations({ identifier: "CircularConvolutionInput" })
