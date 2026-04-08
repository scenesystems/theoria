import { Effect } from "effect"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import type { RunnableEntryId } from "../../contracts/entry/id.js"
import type { StreamManifest } from "../../contracts/evidence/manifest.js"

import { entryIdForRequest, type EntryStreamRequest, manifestForRequest } from "./stream-request.js"

export const runWorkflowName = (id: RunnableEntryId): string => `theoria-demo-${id}-run`

const invalidDemoRequestError = (id: RunnableEntryId): DemoExecutionError =>
  new DemoExecutionError({
    code: "invalid-demo-id",
    message: `Run workflow request does not match the ${id} demo.`,
    retryable: false
  })

const invalidManifestError = (id: RunnableEntryId): DemoExecutionError =>
  new DemoExecutionError({
    code: "invalid-query",
    message: `Run workflow manifest does not match the ${id} demo.`,
    retryable: false
  })

export const validateWorkflowRequest = ({
  acceptsManifest,
  id,
  request
}: {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly id: RunnableEntryId
  readonly request: EntryStreamRequest
}) => {
  const requestEntryId = entryIdForRequest(request)
  const manifest = manifestForRequest(request)

  return requestEntryId !== id
    ? Effect.fail(invalidDemoRequestError(id))
    : acceptsManifest(manifest)
    ? Effect.void
    : Effect.fail(invalidManifestError(id))
}
