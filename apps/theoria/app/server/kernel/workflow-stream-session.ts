import { Activity } from "@effect/workflow"
import type { PackageName } from "@theoria/source-proof/contracts"
import { Data, Effect, Ref } from "effect"

import type { RunnableEntryId } from "../../contracts/entry/id.js"
import { EvidenceStore } from "../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../contracts/evidence/stream.js"
import type { Program } from "../../contracts/presentation/program.js"
import type { RunData } from "../../contracts/study/run.js"

import { EntryStreamSessionRegistry } from "./kinds/stream-session-registry.js"

type WorkflowStreamStore = EvidenceStore

export class WorkflowStreamSession extends Data.Class<WorkflowStreamSession.Shape> {
  static allocate(sessionKey: string) {
    return Effect.all({
      batchIndexRef: Ref.make(0),
      storeRef: Ref.make(EvidenceStore.empty())
    }).pipe(
      Effect.map(({ batchIndexRef, storeRef }) => new WorkflowStreamSession({ batchIndexRef, sessionKey, storeRef }))
    )
  }
}

export namespace WorkflowStreamSession {
  export interface Shape {
    readonly batchIndexRef: Ref.Ref<number>
    readonly sessionKey: string
    readonly storeRef: Ref.Ref<WorkflowStreamStore>
  }
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
      Ref.update(session.storeRef, (store) => store.apply(event)).pipe(
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
  readonly packageName: PackageName
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
      sections: store.sections()
    }))
  )
