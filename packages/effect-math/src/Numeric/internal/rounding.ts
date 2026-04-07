/**
 * Numeric angle-conversion, magnitude, and rounding kernels.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N } from "effect"

const DEGREES_PER_HALF_TURN = 180
const RADIANS_PER_DEGREE = Math.PI / DEGREES_PER_HALF_TURN
const DEGREES_PER_RADIAN = DEGREES_PER_HALF_TURN / Math.PI

/**
 * Converts degrees to radians on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const degreesToRadians = (value: number): number => N.multiply(value, RADIANS_PER_DEGREE)

/**
 * Converts radians to degrees on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const radiansToDegrees = (value: number): number => N.multiply(value, DEGREES_PER_RADIAN)

/**
 * Euclidean magnitude from two real scalar coordinates.
 *
 * @since 0.3.0
 * @category internal
 */
export const hypot: (left: number, right: number) => number = Math.hypot

/**
 * IEEE-754 floor on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const floor: (value: number) => number = Math.floor

/**
 * IEEE-754 ceiling on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const ceil: (value: number) => number = Math.ceil

/**
 * IEEE-754 round-to-nearest on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const round: (value: number) => number = Math.round

/**
 * IEEE-754 truncate-toward-zero on real scalar inputs.
 *
 * @since 0.3.0
 * @category internal
 */
export const trunc: (value: number) => number = Math.trunc
