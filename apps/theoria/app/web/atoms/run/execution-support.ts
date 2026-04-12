import { Clock, Effect, Match, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import { EntryRunIdentity } from "../../../contracts/entry/routing.js"
import type { EvidenceStore } from "../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { Program } from "../../../contracts/presentation/program.js"
import {
  projectionDriverFor,
  resetProjectionDriverState,
  setProjectionPlayback,
  syncProjectionFrameToControls
} from "../../runtime/kernel/surface-runtime.js"
import { EvidenceStreamState } from "../../state/evidence/stream.js"
import type { RunMessage } from "../../state/run/messages.js"
import type { RunRegistry } from "../run-registry-context.js"
import { surfaceEvidenceStoreAtom } from "../surface/evidence-store.js"
import { dispatchRunMessage } from "../surface/internal.js"
import { surfaceAtom } from "../surface/state.js"

import type { ActiveRun } from "./lifecycle.js"
import { interruptActiveRun } from "./lifecycle.js"

export const pendingProgram: Program = {
  files: [{ source: "// pending", entry: "pending", language: "ts", name: "pending" }]
}

export const applyEvidenceEventToSurface = (
  registry: RunRegistry,
  id: EntryId,
  sequence: number,
  event: EvidenceEvent
): void =>
  Match.value(registry.get(surfaceAtom(id)).run).pipe(
    Match.when(
      (run) => run.session.hasActiveSequence(sequence),
      () => {
        registry.update(surfaceEvidenceStoreAtom(id), (store) => store.apply(event))
      }
    ),
    Match.orElse(() => undefined)
  )

export const dispatchCurrentTimeRunMessage = (
  registry: RunRegistry,
  id: EntryId,
  buildMessage: (atMs: number) => RunMessage
): Effect.Effect<void, never, never> =>
  Clock.currentTimeMillis.pipe(
    Effect.tap((atMs) =>
      Effect.sync(() => {
        dispatchRunMessage(registry, id, buildMessage(atMs))
      })
    ),
    Effect.asVoid
  )

export const runDataFromStore = (id: EntryId, program: Program, store: EvidenceStore) => {
  const stream = EvidenceStreamState.fromStore(store)

  return {
    id,
    packageName: EntryRunIdentity.fromEntryId(id).packageName,
    summary: stream.summary ?? "Run complete.",
    durationMs: stream.meta?.durationMs ?? 0,
    program,
    sections: stream.sections
  }
}

export type RunningExecution = {
  readonly sequence: number
  readonly signal: ActiveRun["signal"]
  readonly token: number
}

export const runIsPaused = (id: EntryId, registry: RunRegistry): boolean =>
  registry.get(surfaceAtom(id)).run.session.control === "paused"

export const syncCurrentProjectionFrameToControls = (
  registry: RunRegistry,
  id: EntryId
): Effect.Effect<void, never, never> =>
  Effect.sync(() => registry.get(surfaceAtom(id)).run.session.localRunFrame).pipe(
    Effect.flatMap((localRunFrame) => syncProjectionFrameToControls(projectionDriverFor(id), registry, localRunFrame))
  )

export const interruptRunAuthority = ({
  id,
  registry
}: {
  readonly id: EntryId
  readonly registry: RunRegistry
}): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  interruptActiveRun(id, registry).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(Option.none()),
        onSome: (active) => {
          const projectionDriver = projectionDriverFor(id)

          return syncCurrentProjectionFrameToControls(registry, id).pipe(
            Effect.zipRight(setProjectionPlayback(projectionDriver, registry, false)),
            Effect.zipRight(resetProjectionDriverState(projectionDriver, registry)),
            Effect.as(Option.some(active))
          )
        }
      })
    )
  )
