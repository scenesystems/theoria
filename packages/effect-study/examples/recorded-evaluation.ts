/** Task-shaped evidence: observe, checkpoint, reopen, and inspect without resubmitting work. */
import { BunRuntime, BunServices } from "@effect/platform-bun"
import { Evaluation, PersistenceError, StudyStorage } from "@scenesystems/effect-study"
import { Array as Arr, Effect, Exit, FileSystem, Ref, Schema } from "effect"

const Output = Schema.Struct({ stdout: Schema.String, exitCode: Schema.Int })
class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", { detail: Schema.String }) {}
const options = new StudyStorage.OpenOptions({
  runId: "task-evidence",
  definitionDigest: "task-output-v1",
  eventSchema: Evaluation.RecordedEvent(Schema.String, Output, Unavailable, Schema.Defect()),
  checkpointSchema: Evaluation.View(Schema.String, Output, Unavailable, Schema.Defect())
})
const numberText = Schema.encodeSync(Schema.FiniteFromString)

// These are fixtures, not remote submissions. A real caller supplies its executor.
const execute = (input: string) =>
  input === "unavailable"
    ? Effect.fail(new Unavailable({ detail: "executor unavailable" }))
    : Effect.succeed(Output.make({ stdout: input, exitCode: 7 }))

const program = Effect.scoped(Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "effect-study-recording-" })
  const location = StudyStorage.fileSystemOptions(directory)
  const recording = yield* (yield* StudyStorage.makeFileSystem(location)).open(options)
  const cursor = yield* Ref.make(0)
  const exit = yield* Evaluation.runWithEvents(
    Arr.make("finished", "unavailable", "unacknowledged", "waiting"),
    execute,
    {},
    (event) =>
      Effect.gen(function*() {
        // Simulate a sink failing before it can acknowledge this outcome. The last
        // input is never admitted; reopening must not pretend either one completed.
        if (event._tag === "TrialSettled" && event.trial.config === "unacknowledged") {
          return yield* new PersistenceError.Failure({
            reason: "Backend",
            operation: "write",
            detail: "sink unavailable"
          })
        }
        const expectedCursor = yield* Ref.get(cursor)
        const receipt = yield* recording.append(
          new StudyStorage.Append({
            recordId: numberText(expectedCursor),
            expectedCursor,
            event
          })
        )
        yield* Ref.set(cursor, receipt.cursor)
        if (event._tag === "TrialSettled" && event.trial.config === "finished") {
          const checkpoint = yield* StudyStorage.replay(recording, Evaluation.empty(), Evaluation.reduce)
          yield* recording.writeCheckpoint(checkpoint)
        }
      })
  ).pipe(Effect.exit)

  const reopened = yield* (yield* StudyStorage.makeFileSystem(location)).open(options)
  const retained = yield* StudyStorage.replay(reopened, Evaluation.empty(), Evaluation.reduce)
  yield* Effect.log({
    observationFailed: Exit.isFailure(exit),
    coverage: Evaluation.coverage(retained.state),
    trials: retained.state.trials
  })
  // Expected coverage: completed 1, failed 1, unresolved 1, notStarted 1.
  // The completed exitCode is data, not a grade. Unresolved does not prove remote
  // cancellation or authorize retry; reconciliation belongs to the caller.
}))

BunRuntime.runMain(program.pipe(Effect.provide(BunServices.layer)))
