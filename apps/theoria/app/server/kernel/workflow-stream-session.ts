import { Activity } from "@effect/workflow"
import { Effect, Ref } from "effect"

import type { RunnableEntryId } from "../../contracts/entry/id.js"
import {
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  evidenceSectionsFromStore
} from "../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../contracts/evidence/stream.js"
import type { Program } from "../../contracts/presentation/program.js"
import type { RunData } from "../../contracts/study/run.js"

import { EntryStreamSessionRegistry } from "./kinds/stream-session-registry.js"

type WorkflowStreamStore = typeof emptyEvidenceStoreState

export type WorkflowStreamSession = {
  readonly batchIndexRef: Ref.Ref<number>
  readonly sessionKey: string
  readonly storeRef: Ref.Ref<WorkflowStreamStore>
}

const appendBatchActivity = ({
  batchIndex,
  events,
  phaseName,
  sessionKey
}: {
  readonly batchIndex: number
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly sessionKey: string
}) =>
  Activity.make({
    name: `${phaseName}-batch-${batchIndex}`,
    execute: EntryStreamSessionRegistry.pipe(
      Effect.flatMap((registry) => registry.appendBatch({ batchIndex, events, sessionKey }))
    )
  })

const appendWorkflowBatch = ({
  events,
  phaseName,
  session
}: {
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly session: WorkflowStreamSession
}) =>
  events.length === 0
    ? Effect.void
    : Ref.get(session.batchIndexRef).pipe(
      Effect.flatMap((batchIndex) =>
        appendBatchActivity({
          batchIndex,
          events,
          phaseName,
          sessionKey: session.sessionKey
        }).pipe(Effect.zipRight(Ref.set(session.batchIndexRef, batchIndex + 1)))
      )
    )

export const makeWorkflowStreamSession = (sessionKey: string) =>
  Effect.all({
    batchIndexRef: Ref.make(0),
    storeRef: Ref.make(emptyEvidenceStoreState)
  }).pipe(Effect.map(({ batchIndexRef, storeRef }) => ({ batchIndexRef, sessionKey, storeRef })))

export const publishWorkflowStreamEvents = ({
  events,
  phaseName,
  session
}: {
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly session: WorkflowStreamSession
}) =>
  Effect.forEach(
    events,
    (event) => appendWorkflowBatch({ events: [event], phaseName, session }),
    { discard: true }
  )

export const recordWorkflowStreamEvents = ({
  events,
  phaseName,
  session
}: {
  readonly events: ReadonlyArray<EvidenceEvent>
  readonly phaseName: string
  readonly session: WorkflowStreamSession
}) =>
  Effect.forEach(
    events,
    (event) =>
      Ref.update(session.storeRef, (store) => applyEvidenceEventToStore(store, event)).pipe(
        Effect.zipRight(appendWorkflowBatch({ events: [event], phaseName, session }))
      ),
    { discard: true }
  )

export const runDataFromWorkflowStreamSession = ({
  durationMs,
  id,
  packageName,
  program,
  session,
  summary
}: {
  readonly durationMs: number
  readonly id: RunnableEntryId
  readonly packageName: string
  readonly program: typeof Program.Type
  readonly session: WorkflowStreamSession
  readonly summary: string
}): Effect.Effect<typeof RunData.Type, never, never> =>
  Ref.get(session.storeRef).pipe(
    Effect.map((store): typeof RunData.Type => ({
      id,
      packageName,
      summary,
      durationMs,
      program,
      sections: evidenceSectionsFromStore(store)
    }))
  )
