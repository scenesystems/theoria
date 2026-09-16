import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Ref } from "effect"

import * as Progress from "../../../src/Progress.js"
import * as Errors from "../../../src/SearchError.js"
import * as StudyEvent from "../../../src/StudyEvent.js"

const makeCaptureSink = (supportsAnsi: boolean) =>
  Effect.gen(function*() {
    const stdout = yield* Ref.make<ReadonlyArray<string>>([])
    const stderr = yield* Ref.make<ReadonlyArray<string>>([])

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
      const completed = StudyEvent.trialCompleted({ trialNumber: 3, value: 0.5 })
      const ttyCapture = yield* makeCaptureSink(true)
      const plainCapture = yield* makeCaptureSink(false)

      yield* Progress.report(completed, ttyCapture.sink)
      yield* Progress.report(completed, plainCapture.sink)

      const ttyStdout = yield* Ref.get(ttyCapture.stdout)
      const plainStdout = yield* Ref.get(plainCapture.stdout)

      expect(ttyStdout.length).toBe(1)
      expect(plainStdout.length).toBe(1)
      expect(ttyStdout[0]?.includes("\u001b[")).toBe(true)
      expect(plainStdout[0]?.includes("\u001b[")).toBe(false)
    }))

  it.effect("routes failures to stderr while still respecting tty style selection", () =>
    Effect.gen(function*() {
      const failed = StudyEvent.trialFailed({
        trialNumber: 11,
        error: new Errors.TrialError({
          trialNumber: 11,
          message: "boom",
          cause: "synthetic"
        })
      })
      const ttyCapture = yield* makeCaptureSink(true)

      yield* Progress.report(failed, ttyCapture.sink)

      const stdout = yield* Ref.get(ttyCapture.stdout)
      const stderr = yield* Ref.get(ttyCapture.stderr)

      expect(stdout).toEqual([])
      expect(stderr.length).toBe(1)
      expect(stderr[0]?.includes("\u001b[")).toBe(true)
    }))
})
