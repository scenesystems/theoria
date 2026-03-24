import { Number as Num } from "effect"

import * as Float64 from "../../float64.js"

export const SQRT_TWO = Float64.SQRT_2
export const SQRT_TWO_PI = Float64.sqrt(2 * Float64.PI)
export const LOG_SQRT_TWO_PI = Float64.log(SQRT_TWO_PI)
export const INV_SQRT_TWO = Num.unsafeDivide(1, SQRT_TWO)

export const LOG_NDTR_RIGHT_TAIL_THRESHOLD = 6
export const LOG_NDTR_ASYMPTOTIC_THRESHOLD = -20

export const NDTRI_EXP_SWITCH = -5
export const NDTRI_EXP_FLIP_THRESHOLD = -1e-2
export const NDTRI_EXP_APPROX_C = Num.unsafeDivide(Float64.sqrt(3), Float64.PI)
export const NEWTON_MAX_ITERATIONS = 100
export const NEWTON_RELATIVE_TOLERANCE = 1e-8
