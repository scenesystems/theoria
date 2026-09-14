import { expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { WebVitalBudgets, webVitalBudgets } from "../../app/contracts/performance.js"

it.effect("the web vital budgets decode through their contract and use Google's good thresholds", () =>
  Effect.gen(function*() {
    expect(yield* Schema.decodeUnknown(WebVitalBudgets)(webVitalBudgets)).toEqual(webVitalBudgets)
    expect([webVitalBudgets.lcpMs, webVitalBudgets.cls, webVitalBudgets.inpMs]).toEqual([2500, 0.1, 200])
  }))
