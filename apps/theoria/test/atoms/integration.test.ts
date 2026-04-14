import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import { EntryExecutionError } from "../../app/contracts/entry-error.js"
import { workflowStudyDescriptor } from "../../app/contracts/study/workflow/descriptor.js"
import { taskBriefingWorkflowSessionId } from "../../app/contracts/study/workflow/fixture-manifest.js"
import { EntryClient } from "../../app/web/services/EntryClient.js"
import { EntryClientTest, makeEntryClientTestLayer } from "../helpers/entry-client.test-layer.js"
import { programPreviewFixture, runDataFixture } from "../helpers/entry-fixtures.js"

const workflowRunRequest = Schema.decodeUnknownSync(workflowStudyDescriptor.runRequestSchema)({
  runToken: "workflow:test-run",
  draft: {
    entryId: "workflow",
    seedId: taskBriefingWorkflowSessionId,
    input: workflowStudyDescriptor.defaultInput(),
    controls: workflowStudyDescriptor.defaultControls()
  }
})

describe("EntryClient Test Layer", () => {
  it.effect("default test layer serves run data", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.run(workflowRunRequest)
      expect(result.summary).toBe("test run")
    }).pipe(Effect.provide(EntryClientTest)))

  it.effect("default test layer serves preload data", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.preload("workflow")
      expect(result.id).toBe("workflow")
    }).pipe(Effect.provide(EntryClientTest)))

  it.effect("custom test layer allows per-test fixture injection", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.run(workflowRunRequest)
      expect(result.summary).toBe("custom-workflow")
    }).pipe(Effect.provide(makeEntryClientTestLayer({
      run: (id) => Effect.succeed(runDataFixture(`custom-${id}`)),
      preload: () => Effect.succeed(programPreviewFixture)
    }))))

  it.effect("custom test layer can return errors", () =>
    Effect.gen(function*() {
      const client = yield* EntryClient
      const result = yield* client.run(workflowRunRequest).pipe(Effect.either)
      expect(result._tag).toBe("Left")
    }).pipe(Effect.provide(makeEntryClientTestLayer({
      run: () =>
        Effect.fail(
          new EntryExecutionError({ code: "execution-timeout", message: "timeout", retryable: true })
        ),
      preload: () => Effect.succeed(programPreviewFixture)
    }))))
})
