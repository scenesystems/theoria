import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal, Ref } from "effect"

import * as OptimizationEvent from "../../src/OptimizationEvent.js"
import * as Progress from "../../src/Progress.js"

describe("formatter boundary", () => {
  it.effect("keeps pure formatter output independent from sink effects", () =>
    Effect.gen(function*() {
      const event = OptimizationEvent.TrialPruned({
        trialNumber: 8,
        step: 3,
        reason: "plateau",
        policy: "threshold-pruner"
      })

      const first = Progress.format(event, "plain")
      const second = Progress.format(event, "plain")
      expect(first).toEqual(second)

      const stdout = yield* Ref.make(Arr.empty<string>())
      const stderr = yield* Ref.make(Arr.empty<string>())
      const sink = Progress.makeSink({
        supportsAnsi: Effect.succeed(false),
        writeStdout: (line) => Ref.update(stdout, (lines) => Arr.append(lines, line)),
        writeStderr: (line) => Ref.update(stderr, (lines) => Arr.append(lines, line))
      })

      yield* Progress.write(sink, first)

      const stdoutWrites = yield* Ref.get(stdout)
      const stderrWrites = yield* Ref.get(stderr)
      const expectedStdout = Arr.map(Arr.filter(first, (line) => Equal.equals(line.channel, "stdout")), (line) =>
        line.text)
      const expectedStderr = Arr.map(
        Arr.filter(first, (line) =>
          Equal.equals(line.channel, "stderr")),
        (line) => line.text
      )

      expect(stdoutWrites).toEqual(expectedStdout)
      expect(stderrWrites).toEqual(expectedStderr)
    }))
})
