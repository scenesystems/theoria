import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Ref } from "effect"

import * as Progress from "../../../src/Progress.js"
import * as StudyEvent from "../../../src/StudyEvent.js"

describe("formatter boundary", () => {
  it.effect("keeps pure formatter output independent from sink effects", () =>
    Effect.gen(function*() {
      const event = StudyEvent.trialPruned({
        trialNumber: 8,
        step: 3,
        reason: "plateau",
        policy: "threshold-pruner"
      })

      const first = Progress.format(event, "plain")
      const second = Progress.format(event, "plain")
      expect(first).toEqual(second)

      const stdout = yield* Ref.make<ReadonlyArray<string>>([])
      const stderr = yield* Ref.make<ReadonlyArray<string>>([])
      const sink = Progress.makeSink({
        supportsAnsi: Effect.succeed(false),
        writeStdout: (line) => Ref.update(stdout, (lines) => Arr.append(lines, line)),
        writeStderr: (line) => Ref.update(stderr, (lines) => Arr.append(lines, line))
      })

      yield* Progress.write(sink, first)

      const stdoutWrites = yield* Ref.get(stdout)
      const stderrWrites = yield* Ref.get(stderr)
      const expectedStdout = first.filter((line) => line.channel === "stdout").map((line) => line.text)
      const expectedStderr = first.filter((line) => line.channel === "stderr").map((line) => line.text)

      expect(stdoutWrites).toEqual(expectedStdout)
      expect(stderrWrites).toEqual(expectedStderr)
    }))
})
