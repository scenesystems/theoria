import { Effect, Schema } from "effect"

import { DurableFingerprint, fingerprintOf } from "../entry/fingerprint.js"
import { type EntryId, EntryId as EntryIdSchema } from "../entry/id.js"
import { StudyDraft, StudyRunRequest } from "./registry.js"

const RunToken = Schema.String.pipe(Schema.minLength(1))
const SeedId = Schema.String.pipe(Schema.minLength(1))

export const RunRequestIdentity = Schema.Struct({
  entryId: EntryIdSchema,
  seedId: SeedId,
  runToken: RunToken,
  inputFingerprint: DurableFingerprint,
  controlsFingerprint: DurableFingerprint,
  requestFingerprint: DurableFingerprint
})

export type RunRequestIdentity = typeof RunRequestIdentity.Type

const encodeStudyDraft = Schema.encodeSync(StudyDraft)
const encodeStudyRunRequest = Schema.encodeSync(StudyRunRequest)

export const fingerprintStudyDraftInput = (
  draft: typeof StudyDraft.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(draft.input)

export const fingerprintStudyDraftControls = (
  draft: typeof StudyDraft.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(draft.controls)

export const fingerprintStudyDraft = (
  draft: typeof StudyDraft.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeStudyDraft(draft))

export const fingerprintStudyRunRequest = (
  request: typeof StudyRunRequest.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeStudyRunRequest(request))

export const resolveRunRequestIdentityFromDraft = ({
  draft,
  runToken
}: {
  readonly draft: typeof StudyDraft.Type
  readonly runToken: string
}): Effect.Effect<RunRequestIdentity, never, never> =>
  Effect.all({
    inputFingerprint: fingerprintStudyDraftInput(draft),
    controlsFingerprint: fingerprintStudyDraftControls(draft),
    requestFingerprint: fingerprintOf({ runToken, draft: encodeStudyDraft(draft) })
  }).pipe(
    Effect.map(({ inputFingerprint, controlsFingerprint, requestFingerprint }) => ({
      entryId: draft.entryId,
      seedId: draft.seedId,
      runToken,
      inputFingerprint,
      controlsFingerprint,
      requestFingerprint
    }))
  )

export const resolveRunRequestIdentity = (
  request: typeof StudyRunRequest.Type
): Effect.Effect<RunRequestIdentity, never, never> =>
  resolveRunRequestIdentityFromDraft({
    draft: request.draft,
    runToken: request.runToken
  })

export const entryIdForDraft = (draft: typeof StudyDraft.Type): EntryId => draft.entryId
