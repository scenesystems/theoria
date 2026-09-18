import { expect, it } from "@effect/vitest"
import { Effect, Either, Schema } from "effect"

import * as StudyEvent from "@scenesystems/effect-study/StudyEvent"

const Event = Schema.Union(
  StudyEvent.TrialStarted(Schema.Struct({ label: Schema.String })),
  StudyEvent.TrialCompleted(Schema.Boolean),
  StudyEvent.TrialFailed(Schema.String),
  StudyEvent.Completed(Schema.Literal("finished"))
)

it.effect("composes typed lifecycle event schemas without an objective domain", () =>
  Effect.gen(function*() {
    const started = yield* Schema.decodeUnknown(Event)({
      _tag: "TrialStarted",
      trialNumber: 2,
      config: { label: "asymmetric" }
    })
    const rejected = yield* Schema.decodeUnknown(Event)({
      _tag: "TrialCompleted",
      trialNumber: 2,
      value: 1
    }).pipe(Effect.either)

    expect(started).toEqual({ _tag: "TrialStarted", trialNumber: 2, config: { label: "asymmetric" } })
    expect(Either.isLeft(rejected)).toBe(true)
  }))
