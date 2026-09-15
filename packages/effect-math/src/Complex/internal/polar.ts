/**
 * Rectangular ↔ polar conversion kernels for complex numbers.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number, Tuple } from "effect"

import * as Numeric from "../../Numeric/index.js"
import type { ComplexPair } from "../schema.js"

/**
 * Rectangular → polar: returns `[r, θ]` where r = |z| and
 * θ = arg(z) ∈ (−π, π].
 *
 * @since 0.1.0
 * @category internal
 */
export const toPolar = (re: number, im: number): ComplexPair =>
  Tuple.make(Numeric.hypot(Chunk.make(re, im)), Numeric.atan2(im, re))

/**
 * Polar → rectangular: returns `[r·cos(θ), r·sin(θ)]`.
 *
 * @since 0.1.0
 * @category internal
 */
export const fromPolar = (r: number, theta: number): ComplexPair =>
  Tuple.make(Number.multiply(r, Numeric.cos(theta)), Number.multiply(r, Numeric.sin(theta)))
