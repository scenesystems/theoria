import { Effect, Schema } from "effect"

import { EntryExecutionError } from "../../contracts/entry-error.js"
import { fingerprintOf } from "../../contracts/entry/fingerprint.js"
import { type RunnableEntryId, RunnableEntryId as RunnableEntryIdSchema } from "../../contracts/entry/id.js"
import {
  type StudyManifest,
  StudyManifest as StudyManifestSchema,
  studyManifestFromDraft
} from "../../contracts/study/manifest.js"
import { StudyDraft as StudyDraftSchema } from "../../contracts/study/registry.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

const EntryStreamPlan = Schema.Struct({
  id: RunnableEntryIdSchema,
  manifest: Schema.NullOr(StudyManifestSchema)
})

export const EntryStreamRequest = Schema.Struct({
  runToken: NonEmptyString,
  draft: Schema.NullOr(StudyDraftSchema),
  plan: Schema.NullOr(EntryStreamPlan)
})

export type EntryStreamRequest = typeof EntryStreamRequest.Type

const encodeEntryStreamRequest = Schema.encodeSync(EntryStreamRequest)

export const EntryStreamRequestJson = Schema.parseJson(EntryStreamRequest)
export const encodeEntryStreamRequestJson = Schema.encodeSync(EntryStreamRequestJson)

const invalidEntryRequestError = (id: RunnableEntryId): EntryExecutionError =>
  new EntryExecutionError({
    code: "invalid-entry-id",
    message: `Run workflow request does not match the ${id} entry.`,
    retryable: false
  })

const invalidManifestError = (id: RunnableEntryId): EntryExecutionError =>
  new EntryExecutionError({
    code: "invalid-query",
    message: `Run workflow manifest does not match the ${id} entry.`,
    retryable: false
  })

export const entryIdForRequest = (request: EntryStreamRequest): RunnableEntryId | null =>
  request.plan !== null
    ? request.plan.id
    : request.draft !== null && Schema.is(RunnableEntryIdSchema)(request.draft.entryId)
    ? request.draft.entryId
    : null

export const manifestForRequest = (request: EntryStreamRequest): StudyManifest | null =>
  request.plan !== null
    ? request.plan.manifest
    : request.draft === null
    ? null
    : studyManifestFromDraft(request.draft)

export const validateEntryStreamRequest = ({
  acceptsManifest,
  id,
  request
}: {
  readonly acceptsManifest: (manifest: StudyManifest | null) => boolean
  readonly id: RunnableEntryId
  readonly request: EntryStreamRequest
}) => {
  const requestEntryId = entryIdForRequest(request)
  const manifest = manifestForRequest(request)

  return requestEntryId !== id
    ? Effect.fail(invalidEntryRequestError(id))
    : acceptsManifest(manifest)
    ? Effect.void
    : Effect.fail(invalidManifestError(id))
}

export const resolveEntryStreamRequestFingerprint = (request: EntryStreamRequest) =>
  fingerprintOf(encodeEntryStreamRequest(request))
