import { logStrict, pi, sqrt } from "@scenesystems/effect-math/Numeric"
import { Number as Num } from "effect"

export const sqrtTwo = sqrt(2)
export const sqrtTwoPi = sqrt(Num.multiply(2, pi))
export const logSqrtTwoPi = logStrict(sqrtTwoPi)
export const inverseSqrtTwo = Num.unsafeDivide(1, sqrtTwo)

export const logNdtrRightTailThreshold = 6
export const logNdtrAsymptoticThreshold = Num.negate(20)

export const ndtriExpSwitch = Num.negate(5)
export const ndtriExpFlipThreshold = Num.negate(1e-2)
export const ndtriExpApproximationFactor = Num.unsafeDivide(sqrt(3), pi)
export const newtonMaximumIterations = 100
export const newtonRelativeTolerance = 1e-8
