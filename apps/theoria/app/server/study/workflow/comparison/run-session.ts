import { Activity } from "@effect/workflow"
import { Effect, Ref } from "effect"

import type { EntryDraft } from "../../../../contracts/entry/registry.js"
import { emptyEvidenceStoreState, type EvidenceStoreState } from "../../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import { resolveEntryRunIdentityFromDraft } from "../../../../contracts/study/run-plan.js"

import { RunStreamSessionRegistry } from "../../../runtime/stream-session-registry.js"
import { applyEventsToStore } from "./evidence.js"

type WorkflowEntryDraft = Extract<EntryDraft, { readonly entryId: "workflow" }>

export type WorkflowComparisonRunSession = {
  readonly batchIndexRef: Ref.Ref<number>
  readonly sessionKey: string
  readonly storeRef: Ref.Ref<EvidenceStoreState>
}

export const makeWorkflowComparisonRunSession = ({
  draft,
  runToken
}: {
  readonly draft: WorkflowEntryDraft
  readonly runToken: string
}) =>
  Effect.gen(function*() {
    const identity = yield* resolveEntryRunIdentityFromDraft({ draft, runToken })
    const batchIndexRef = yield* Ref.make(0)
    const storeRef = yield* Ref.make(emptyEvidenceStoreState)

    return {
      batchIndexRef,
      sessionKey: identity.requestFingerprint,
      storeRef
    }
  })

export const appendWorkflowComparisonEvents = ({
  events,
  phaseName,
  session
}: {
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly session: WorkflowComparisonRunSession
}) =>
  events.length === 0
    ? Effect.void
    : Ref.get(session.batchIndexRef).pipe(
      Effect.flatMap((batchIndex) =>
        Activity.make({
          name: `${phaseName}-batch-${batchIndex}`,
          execute: RunStreamSessionRegistry.pipe(
            Effect.flatMap((registry) =>
              registry.appendBatch({
                batchIndex,
                events,
                sessionKey: session.sessionKey
              })
            )
          )
        }).pipe(
          Effect.zipRight(Ref.update(session.storeRef, (store) => applyEventsToStore(store, events))),
          Effect.zipRight(Ref.set(session.batchIndexRef, batchIndex + 1))
        )
      )
    )

export const workflowComparisonStoreForSession = (
  session: WorkflowComparisonRunSession
): Effect.Effect<EvidenceStoreState, never, never> => Ref.get(session.storeRef)
