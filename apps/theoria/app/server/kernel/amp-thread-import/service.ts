import { Command, Path } from "@effect/platform"
import { Effect, Schema, Stream } from "effect"
import * as Experimental from "effect-dsp/experimental"

import {
  type AmpThreadImportRequest,
  OpenAgentTraceDecodeError,
  OpenAgentTraceExecutionError
} from "../../../contracts/study/workflow/open-agent-trace.js"

const repositoryRootUrl = new URL("../../../../../../", import.meta.url)

const executionError = (message: string, code: "execution-failed" | "provider-unavailable") =>
  new OpenAgentTraceExecutionError({
    code,
    message,
    retryable: false
  })

const repositoryRootPath = Effect.gen(function*() {
  const path = yield* Path.Path
  return yield* path.fromFileUrl(repositoryRootUrl).pipe(Effect.orDie)
})

const runAmpThreadsExport = (request: AmpThreadImportRequest) =>
  Effect.gen(function*() {
    const root = yield* repositoryRootPath
    const command = Command.make("amp", "threads", "export", request.threadId).pipe(
      Command.workingDirectory(root),
      Command.stdout("pipe"),
      Command.stderr("pipe")
    )
    const process = yield* Command.start(command).pipe(
      Effect.mapError((cause) =>
        executionError(`Local Amp CLI is unavailable for thread import: ${String(cause)}`, "provider-unavailable")
      )
    )
    const [exitCode, stdout, stderr] = yield* Effect.all(
      [
        process.exitCode,
        Stream.decodeText(process.stdout).pipe(Stream.runFold("", (current, chunk) => `${current}${chunk}`)),
        Stream.decodeText(process.stderr).pipe(Stream.runFold("", (current, chunk) => `${current}${chunk}`))
      ],
      { concurrency: "unbounded" }
    )

    return Number(exitCode) === 0
      ? stdout
      : yield* Effect.fail(
        executionError(
          stderr.trim().length > 0 ? stderr.trim() : `Local Amp CLI exited with code ${String(Number(exitCode))}.`,
          "execution-failed"
        )
      )
  }).pipe(Effect.scoped)

const decodeExportSnapshot = (raw: string) =>
  Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))(raw).pipe(
    Effect.mapError(OpenAgentTraceDecodeError.fromParseError),
    Effect.flatMap((json) =>
      Experimental.OpenAgentTrace.AmpThread.decodeExportSnapshot(json).pipe(
        Effect.mapError(OpenAgentTraceDecodeError.fromParseError)
      )
    )
  )

export class AmpThreadImportKernel extends Effect.Service<AmpThreadImportKernel>()(
  "theoria/server/kernel/AmpThreadImportKernel",
  {
    succeed: {
      exportSnapshot: (request: AmpThreadImportRequest) =>
        runAmpThreadsExport(request).pipe(Effect.flatMap(decodeExportSnapshot))
    }
  }
) {}
