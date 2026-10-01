import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Ref, String as Str } from "effect"

import * as OptimizationEvent from "../../src/OptimizationEvent.js"
import * as Progress from "../../src/Progress.js"
import * as SearchError from "../../src/SearchError.js"

const makeCaptureSink = (supportsAnsi: boolean) =>
  Effect.gen(function*() {
    const stdout = yield* Ref.make(Arr.empty<string>())
    const stderr = yield* Ref.make(Arr.empty<string>())

    return {
      sink: Progress.makeSink({
        supportsAnsi: Effect.succeed(supportsAnsi),
        writeStdout: (line) => Ref.update(stdout, (lines) => Arr.append(lines, line)),
        writeStderr: (line) => Ref.update(stderr, (lines) => Arr.append(lines, line))
      }),
      stdout,
      stderr
    }
  })

describe("terminal reporter tty behavior", () => {
  it.effect("applies ANSI styling only when sink reports TTY support", () =>
    Effect.gen(function*() {
      const completed = OptimizationEvent.TrialCompleted({ trialNumber: 3, value: 0.5 })
      const ttyCapture = yield* makeCaptureSink(true)
      const plainCapture = yield* makeCaptureSink(false)

      yield* Progress.report(completed, ttyCapture.sink)
      yield* Progress.report(completed, plainCapture.sink)

      const ttyStdout = yield* Ref.get(ttyCapture.stdout)
      const plainStdout = yield* Ref.get(plainCapture.stdout)

      expect(Arr.length(ttyStdout)).toBe(1)
      expect(Arr.length(plainStdout)).toBe(1)
      expect(Arr.head(ttyStdout).pipe(Option.map(Str.includes("\u001b[")), Option.getOrElse(() => false))).toBe(true)
      expect(Arr.head(plainStdout).pipe(Option.map(Str.includes("\u001b[")), Option.getOrElse(() => false))).toBe(false)
    }))

  it.effect("routes failures to stderr while still respecting tty style selection", () =>
    Effect.gen(function*() {
      const failed = OptimizationEvent.TrialFailed({
        trialNumber: 11,
        error: new SearchError.TrialError({
          trialNumber: 11,
          message: "boom",
          cause: "synthetic"
        })
      })
      const ttyCapture = yield* makeCaptureSink(true)

      yield* Progress.report(failed, ttyCapture.sink)

      const stdout = yield* Ref.get(ttyCapture.stdout)
      const stderr = yield* Ref.get(ttyCapture.stderr)

      expect(stdout).toEqual(Arr.empty())
      expect(Arr.length(stderr)).toBe(1)
      expect(Arr.head(stderr).pipe(Option.map(Str.includes("\u001b[")), Option.getOrElse(() => false))).toBe(true)
    }))
})
