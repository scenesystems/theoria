import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Record } from "effect"

import * as Sampler from "../../../src/Sampler/index.js"
import {
  BuiltInAcquisitionNameSchema,
  builtinAcquisitionRegistry,
  defaultAcquisitionName,
  resolveAcquisition,
  scoreAcquisition
} from "../../../src/samplers/Tpe/acquisition/index.js"

describe("tpe acquisition registry", () => {
  it.effect("exposes a stable built-in registry for Ei, Pi, and Thompson", () =>
    Effect.sync(() => {
      const keys = Record.toEntries(builtinAcquisitionRegistry)
        .map(([key]) => key)
        .sort((left, right) => left.localeCompare(right))

      expect(keys).toEqual(["ei", "pi", "thompson"])
    }))

  it.effect("shares acquisition-name schema with sampler kind options", () =>
    Effect.sync(() => {
      expect(Sampler.BuiltInAcquisitionNameSchema).toBe(BuiltInAcquisitionNameSchema)
    }))

  it.effect("resolves the default acquisition when no override is provided", () =>
    Effect.sync(() => {
      const resolved = resolveAcquisition()

      expect(resolved.name).toBe(defaultAcquisitionName)
      expect(
        scoreAcquisition({
          logL: -0.3,
          logG: -0.8,
          estimatedCost: Option.none(),
          roll: Option.none()
        })
      ).toBeCloseTo(
        scoreAcquisition({
          logL: -0.3,
          logG: -0.8,
          estimatedCost: Option.none(),
          roll: Option.none()
        }, defaultAcquisitionName),
        12
      )
    }))

  it.effect("accepts additive custom acquisition implementations without mutating built-ins", () =>
    Effect.sync(() => {
      const custom = resolveAcquisition({
        name: "custom-gap",
        score: ({ logL, logG }) => (logL - logG) * 10
      })

      expect(custom.name).toBe("custom-gap")
      expect(
        custom.score({
          logL: -0.1,
          logG: -0.6,
          estimatedCost: Option.none(),
          roll: Option.none()
        })
      ).toBeCloseTo(5, 12)
      expect(resolveAcquisition("ei").name).toBe("ei")
    }))
})
