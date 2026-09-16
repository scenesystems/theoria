import { Number as Num } from "effect"

import * as Float64 from "../../float64.js"

export const sqrtTwo = Float64.sqrt2
export const sqrtTwoPi = Float64.sqrt(Num.multiply(2, Float64.pi))
export const logSqrtTwoPi = Float64.log(sqrtTwoPi)
export const inverseSqrtTwo = Num.unsafeDivide(1, sqrtTwo)

export const logNdtrRightTailThreshold = 6
export const logNdtrAsymptoticThreshold = -20

export const ndtriExpSwitch = -5
export const ndtriExpFlipThreshold = -1e-2
export const ndtriExpApproximationFactor = Num.unsafeDivide(Float64.sqrt(3), Float64.pi)
export const newtonMaximumIterations = 100
export const newtonRelativeTolerance = 1e-8
