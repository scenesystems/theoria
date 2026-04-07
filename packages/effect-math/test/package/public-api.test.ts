import { describe, expect, it } from "@effect/vitest"

import * as EffectMath from "effect-math"
import * as Calculus from "effect-math/Calculus"
import * as Complex from "effect-math/Complex"
import * as Distribution from "effect-math/Distribution"
import * as Fft from "effect-math/Fft"
import * as Numeric from "effect-math/Numeric"
import * as Optimization from "effect-math/Optimization"
import * as Statistics from "effect-math/Statistics"

describe("package/public-api", () => {
  it("resolves the released v0.3 root and subpath surfaces", () => {
    expect(typeof EffectMath.Statistics.weightedMean).toBe("function")
    expect(typeof EffectMath.Calculus.solveRk4).toBe("function")
    expect(typeof EffectMath.Optimization.brent).toBe("function")
    expect(typeof EffectMath.Distribution.noncentralTCdf).toBe("function")
    expect(typeof EffectMath.Fft.rfft).toBe("function")
    expect(typeof EffectMath.Numeric.sin).toBe("function")
    expect(typeof EffectMath.Numeric.imul).toBe("function")

    expect(typeof Statistics.confidenceIntervalMean).toBe("function")
    expect(typeof Statistics.oneSampleTTest).toBe("function")
    expect(typeof Statistics.twoSampleTTest).toBe("function")
    expect(typeof Statistics.powerForMeanDifference).toBe("function")
    expect(typeof Statistics.sampleSizeForTargetPower).toBe("function")
    expect(Statistics.PowerAnalysisReport).toBeDefined()
    expect(Statistics.SampleSizeForTargetPowerReport).toBeDefined()

    expect(typeof Optimization.brent).toBe("function")
    expect(typeof Optimization.secant).toBe("function")
    expect(typeof Optimization.newtonRaphson).toBe("function")
    expect(Optimization.RootFindingResult).toBeDefined()

    expect(typeof Calculus.solveEuler).toBe("function")
    expect(typeof Calculus.solveRk4).toBe("function")
    expect(typeof Calculus.solveAdaptiveRk45).toBe("function")

    expect(typeof Distribution.normalCdf).toBe("function")
    expect(typeof Distribution.noncentralTCdf).toBe("function")
    expect(typeof Distribution.noncentralTQuantile).toBe("function")

    expect(typeof Complex.of).toBe("function")
    expect(typeof Complex.complexDerivative).toBe("function")

    expect(typeof Fft.rfft).toBe("function")
    expect(typeof Fft.circularConvolution).toBe("function")

    expect(typeof Numeric.sin).toBe("function")
    expect(typeof Numeric.atan2).toBe("function")
    expect(typeof Numeric.acoshValidated).toBe("function")
    expect(typeof Numeric.imulWithPolicies).toBe("function")
    expect(Numeric.TAU).toBeCloseTo(Math.PI * 2)
  })
})
