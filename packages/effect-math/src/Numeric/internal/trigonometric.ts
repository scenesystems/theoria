/**
 * Numeric circular and inverse trigonometric kernels.
 *
 * @since 0.3.0
 * @category internal
 */

/**
 * Sine on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const sin: (value: number) => number = Math.sin

/**
 * Cosine on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const cos: (value: number) => number = Math.cos

/**
 * Tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const tan: (value: number) => number = Math.tan

/**
 * Inverse sine on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const asin: (value: number) => number = Math.asin

/**
 * Inverse cosine on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const acos: (value: number) => number = Math.acos

/**
 * Inverse tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const atan: (value: number) => number = Math.atan

/**
 * Quadrant-sensitive inverse tangent on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const atan2: (y: number, x: number) => number = Math.atan2
