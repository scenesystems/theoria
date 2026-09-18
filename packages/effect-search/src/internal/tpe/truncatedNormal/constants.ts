import { logStrict, pi, sqrt } from "@scenesystems/effect-math/Numeric"
import { Number as Num } from "effect"

export const sqrtTwo = sqrt(2)
export const sqrtTwoPi = sqrt(Num.multiply(2, pi))
export const logSqrtTwoPi = logStrict(sqrtTwoPi)
export const inverseSqrtTwo = Num.unsafeDivide(1, sqrtTwo)

export const logNdtrRightTailThreshold = 6
export const logNdtrAsymptoticThreshold = Num.negate(20)
