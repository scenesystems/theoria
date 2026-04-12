import { Effect, Schema } from "effect"

import { DurableFingerprint, fingerprintOf } from "../entry/fingerprint.js"
import { type EntryId, EntryId as EntryIdSchema } from "../entry/id.js"
import { EntryDraft, EntryRunRequest } from "../entry/registry.js"

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

const encodeEntryDraft = Schema.encodeSync(EntryDraft)
const encodeEntryRunRequest = Schema.encodeSync(EntryRunRequest)

export const fingerprintEntryDraftInput = (
  draft: typeof EntryDraft.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(draft.input)

export const fingerprintEntryDraftControls = (
  draft: typeof EntryDraft.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(draft.controls)

export const fingerprintEntryDraft = (
  draft: typeof EntryDraft.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeEntryDraft(draft))

export const fingerprintEntryRunRequest = (
  request: typeof EntryRunRequest.Type
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeEntryRunRequest(request))

export const resolveRunRequestIdentityFromDraft = ({
  draft,
  runToken
}: {
  readonly draft: typeof EntryDraft.Type
  readonly runToken: string
}): Effect.Effect<RunRequestIdentity, never, never> =>
  Effect.all({
    inputFingerprint: fingerprintEntryDraftInput(draft),
    controlsFingerprint: fingerprintEntryDraftControls(draft),
    requestFingerprint: fingerprintOf({ runToken, draft: encodeEntryDraft(draft) })
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
  request: typeof EntryRunRequest.Type
): Effect.Effect<RunRequestIdentity, never, never> =>
  resolveRunRequestIdentityFromDraft({
    draft: request.draft,
    runToken: request.runToken
  })

export const entryIdForDraft = (draft: typeof EntryDraft.Type): EntryId => draft.entryId
