/**
 * FFT carriers and domain model.
 *
 * @since 0.3.0
 * @category models
 */
import { Schema } from "effect"

import { FftDomainContract } from "./contract.js"
import type { FftDomain } from "./schema.js"

const PositiveFiniteInteger = Schema.Number.pipe(Schema.finite(), Schema.int(), Schema.greaterThan(0))
const FiniteChunk = Schema.ChunkFromSelf(Schema.Number.pipe(Schema.finite()))

/**
 * Full complex sequence used by `fft` and `ifft`.
 *
 * @since 0.3.0
 * @category models
 */
export class FftSequence extends Schema.TaggedClass<FftSequence>()("FftSequence", {
  length: PositiveFiniteInteger,
  real: FiniteChunk,
  imaginary: FiniteChunk,
  normalization: Schema.Literal("backward", "forward", "ortho")
}) {}

/**
 * Hermitian half-spectrum used by `rfft` and `irfft`.
 *
 * @since 0.3.0
 * @category models
 */
export class RealFftSpectrum extends Schema.TaggedClass<RealFftSpectrum>()("RealFftSpectrum", {
  signalLength: PositiveFiniteInteger,
  real: FiniteChunk,
  imaginary: FiniteChunk,
  normalization: Schema.Literal("backward", "forward", "ortho")
}) {}

/**
 * Runtime domain model for FFT discovery.
 *
 * @since 0.3.0
 * @category models
 */
export const FftDomainModel: FftDomain = {
  domain: FftDomainContract,
  stability: "provisional"
}
