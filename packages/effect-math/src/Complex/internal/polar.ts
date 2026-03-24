/**
 * Rectangular ↔ polar conversion kernels for complex numbers.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

/**
 * Rectangular → polar: returns `[r, θ]` where r = |z| and
 * θ = arg(z) ∈ (−π, π].
 *
 * @since 0.1.0
 * @category internal
 */
export const toPolar = (re: number, im: number): readonly [number, number] => [
  Math.hypot(re, im),
  Math.atan2(im, re)
]

/**
 * Polar → rectangular: returns `[r·cos(θ), r·sin(θ)]`.
 *
 * @since 0.1.0
 * @category internal
 */
export const fromPolar = (r: number, theta: number): readonly [number, number] => [
  N.multiply(r, Math.cos(theta)),
  N.multiply(r, Math.sin(theta))
]
