import { BunServices } from "@effect/platform-bun"
import { expect, it } from "@effect/vitest"
import { Array as Arr, Cause, Deferred, Effect, Fiber, FileSystem, Number as Num, Option, Ref, Schema } from "effect"

import * as Evaluation from "@scenesystems/effect-study/Evaluation"
import * as StudyStorage from "@scenesystems/effect-study/StudyStorage"

const eventSchema = Evaluation.RecordedEvent(Schema.String, Schema.Int, Schema.String, Schema.Defect())
const checkpointSchema = Evaluation.View(Schema.String, Schema.Int, Schema.String, Schema.Defect())
const options = new StudyStorage.OpenOptions({
  runId: "evaluation",
  definitionDigest: "v1",
  eventSchema,
  checkpointSchema
})
const numberText = Schema.encodeSync(Schema.FiniteFromString)

it.effect("retains bad answers and nonzero task exits as completed values for caller grading", () =>
  Effect.gen(function*() {
    const Output = Schema.Struct({ answer: Schema.String, exitCode: Schema.Int })
    const run = yield* (yield* StudyStorage.makeMemory).open(
      new StudyStorage.OpenOptions({
        runId: "caller-grading",
        definitionDigest: "answer-exit-v1",
        eventSchema: Evaluation.RecordedEvent(Schema.String, Output, Schema.String, Schema.Defect()),
        checkpointSchema: Evaluation.View(Schema.String, Output, Schema.String, Schema.Defect())
      })
    )
    const cursor = yield* Ref.make(0)
    yield* Evaluation.runWithEvents(
      ["wrong-answer", "nonzero-exit", "correct"],
      (input) =>
        Effect.succeed({ answer: input === "wrong-answer" ? "41" : "42", exitCode: input === "nonzero-exit" ? 7 : 0 }),
      {},
      (event) =>
        Effect.gen(function*() {
          const expectedCursor = yield* Ref.get(cursor)
          const receipt = yield* run.append(
            new StudyStorage.Append({ recordId: numberText(expectedCursor), expectedCursor, event })
          )
          yield* Ref.set(cursor, receipt.cursor)
        })
    )
    const retained = yield* StudyStorage.replay(run, Evaluation.empty(), Evaluation.reduce)
    expect(Evaluation.coverage(retained.state).completed).toBe(3)
    expect(Evaluation.coverage(retained.state).failed).toBe(0)
    const grades = Arr.map(
      retained.state.trials,
      (trial) =>
        trial.state._tag === "Completed" && trial.state.value.answer === "42" &&
        Num.Equivalence(trial.state.value.exitCode, 0)
    )
    expect(grades).toEqual([false, false, true])
  }))

it.effect("reopens a missing-terminal evaluation without guessing whether unfinished effects ran", () =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const config = StudyStorage.fileSystemOptions(yield* fs.makeTempDirectoryScoped(), "evaluation.jsonl")
    const run = yield* (yield* StudyStorage.makeFileSystem(config)).open(options)
    const cursor = yield* Ref.make(0)
    const active = yield* Deferred.make<void>()
    const fiber = yield* Evaluation.runWithEvents(
      ["good", "failure", "unfinished", "unstarted"],
      (input) =>
        input === "good"
          ? Effect.succeed(17)
          : input === "failure"
          ? Effect.fail("domain-failure")
          : Deferred.succeed(active, undefined).pipe(Effect.andThen(Effect.never)),
      {},
      (event) =>
        Effect.gen(function*() {
          if (event._tag === "Terminated") return yield* Effect.fail("sink-unavailable")
          const expectedCursor = yield* Ref.get(cursor)
          const receipt = yield* run.append(
            new StudyStorage.Append({ recordId: numberText(expectedCursor), expectedCursor, event })
          )
          yield* Ref.set(cursor, receipt.cursor)
        })
    ).pipe(Effect.forkChild)
    yield* Deferred.await(active)
    yield* Fiber.interrupt(fiber)
    const reopened = yield* (yield* StudyStorage.makeFileSystem(config)).open(options)
    const retained = yield* StudyStorage.replay(
      reopened,
      Evaluation.empty<string, number, string>(),
      Evaluation.reduce
    )
    expect(Evaluation.coverage(retained.state)).toEqual({
      planKnown: true,
      planned: 4,
      completed: 1,
      failed: 1,
      locallyInterrupted: 0,
      unresolved: 1,
      notStarted: 1
    })
    expect(retained.state.status).toBe("Planned")
    expect(Arr.map(retained.state.trials, (trial) => trial.state)).toEqual([
      { _tag: "Completed", value: 17, duration: 0 },
      { _tag: "Failed", error: "domain-failure", duration: 0 },
      { _tag: "Unresolved" },
      { _tag: "NotStarted" }
    ])
    yield* reopened.writeCheckpoint(retained)
    yield* reopened.append(
      new StudyStorage.Append({
        recordId: "local-finalized",
        expectedCursor: retained.through,
        event: { _tag: "TrialInterrupted", trialNumber: 2 }
      })
    )
    const after = yield* StudyStorage.replay(
      reopened,
      Evaluation.empty<string, number, string>(),
      Evaluation.reduce
    )
    expect(Evaluation.coverage(after.state)).toEqual({
      planKnown: true,
      planned: 4,
      completed: 1,
      failed: 1,
      locallyInterrupted: 1,
      unresolved: 0,
      notStarted: 1
    })
  }).pipe(Effect.provide(BunServices.layer)))

it.effect("retains explicitly recorded termination causes without inventing per-trial cancellation", () =>
  Effect.gen(function*() {
    const store = yield* StudyStorage.makeMemory
    const run = yield* store.open(options)
    const active = yield* Deferred.make<void>()
    const cursor = yield* Ref.make(0)
    const fiber = yield* Evaluation.runWithEvents(
      ["active", "waiting"],
      () => Deferred.succeed(active, undefined).pipe(Effect.andThen(Effect.never)),
      {},
      (event) =>
        Effect.gen(function*() {
          const expectedCursor = yield* Ref.get(cursor)
          yield* run.append(new StudyStorage.Append({ recordId: numberText(expectedCursor), expectedCursor, event }))
          yield* Ref.update(cursor, Num.increment)
        })
    ).pipe(Effect.forkChild)
    yield* Deferred.await(active)
    yield* Fiber.interrupt(fiber)
    const expectedCursor = yield* Ref.get(cursor)
    yield* run.append(
      new StudyStorage.Append({
        recordId: "observed-local-exit",
        expectedCursor,
        event: { _tag: "Terminated", cause: Cause.interrupt() }
      })
    )
    const retained = yield* StudyStorage.replay(
      run,
      Evaluation.empty<string, number, string>(),
      Evaluation.reduce
    )
    expect(retained.state.status).toBe("Terminated")
    expect(Option.map(retained.state.cause, Cause.hasInterruptsOnly)).toEqual(Option.some(true))
    expect(Evaluation.coverage(retained.state)).toEqual({
      planKnown: true,
      planned: 2,
      completed: 0,
      failed: 0,
      locallyInterrupted: 0,
      unresolved: 1,
      notStarted: 1
    })
    yield* run.writeCheckpoint(retained)
    expect(
      (yield* StudyStorage.replay(run, Evaluation.empty<string, number, string>(), Evaluation.reduce)).state
    ).toEqual(retained.state)
  }))

it.effect("distinguishes an unknown plan from an acknowledged empty completed plan", () =>
  Effect.gen(function*() {
    const initial = Evaluation.empty<string, number, string>()
    expect(Evaluation.coverage(initial).planKnown).toBe(false)
    const state = yield* Ref.make(initial)
    yield* Evaluation.runWithEvents(
      Arr.empty<string>(),
      () => Effect.succeed(1),
      {},
      (event) => Ref.update(state, (view) => Evaluation.reduce(view, event))
    )
    const completed = yield* Ref.get(state)
    expect(completed.status).toBe("Completed")
    expect(Evaluation.coverage(completed)).toEqual({
      planKnown: true,
      planned: 0,
      completed: 0,
      failed: 0,
      locallyInterrupted: 0,
      unresolved: 0,
      notStarted: 0
    })
  }))

it.effect("round-trips compound typed failures and defects through event and checkpoint codecs", () =>
  Effect.gen(function*() {
    const run = yield* (yield* StudyStorage.makeMemory).open(options)
    const cause = Cause.combine(Cause.fail("typed-evidence"), Cause.die("defect-evidence"))
    yield* run.append(
      new StudyStorage.Append({
        recordId: "plan",
        expectedCursor: 0,
        event: { _tag: "Planned", inputs: ["first", "second"] }
      })
    )
    yield* run.append(
      new StudyStorage.Append({
        recordId: "start",
        expectedCursor: 1,
        event: { _tag: "TrialStarted", trialNumber: 0, config: "first" }
      })
    )
    yield* run.append(
      new StudyStorage.Append({ recordId: "fatal", expectedCursor: 2, event: { _tag: "Terminated", cause } })
    )
    const retained = yield* StudyStorage.replay(run, Evaluation.empty<string, number, string>(), Evaluation.reduce)
    expect(Option.map(retained.state.cause, (entry) => entry.reasons)).toEqual(Option.some(cause.reasons))
    yield* run.writeCheckpoint(retained)
    const loaded = yield* StudyStorage.replay(run, Evaluation.empty<string, number, string>(), Evaluation.reduce)
    expect(loaded).toEqual(retained)
    expect(Evaluation.coverage(loaded.state)).toEqual({
      planKnown: true,
      planned: 2,
      completed: 0,
      failed: 0,
      locallyInterrupted: 0,
      unresolved: 1,
      notStarted: 1
    })
  }))
