import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import {
  type RunRuntimeTelemetryRow,
  runRuntimeTelemetryRow,
  runRuntimeTelemetrySection,
  type RunRuntimeTelemetryViewModel,
  runRuntimeTelemetryViewModel
} from "../../../contracts/presentation/run-runtime-telemetry.js"
import type { RunRuntimeTelemetryState } from "../../state/run/runtime-telemetry-state.js"
import type { RunRuntimeTelemetryKind } from "../../state/run/types.js"

import { surfaceRunStateAtom } from "./state.js"

const telemetryEventLabel = (kind: RunRuntimeTelemetryKind): string =>
  Match.value(kind).pipe(
    Match.when("run-started", () => "Run started"),
    Match.when("pause-requested", () => "Pause requested"),
    Match.when("resume-requested", () => "Resume requested"),
    Match.when("stop-requested", () => "Stop requested"),
    Match.when("checkpoint-reached", () => "Next cooperative checkpoint"),
    Match.when("stream-complete-observed", () => "Stream completion observed"),
    Match.when("step-queue-drained", () => "Step queue drained"),
    Match.orElse(() => "Run finalized")
  )

const telemetryEventValue = ({
  atMs,
  detail,
  startedAtMs
}: {
  readonly atMs: number
  readonly detail: string | null
  readonly startedAtMs: number
}): string => {
  const elapsedMs = Math.max(atMs - startedAtMs, 0)
  const elapsedText = `+${elapsedMs} ms`

  return detail === null ? elapsedText : `${elapsedText} · ${detail}`
}

export const surfaceRunRuntimeTelemetryAtom: (id: EntryId) => AtomType.Atom<RunRuntimeTelemetryState> = Atom
  .family((id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.telemetry))

export const surfaceRunRuntimeTelemetryViewModelAtom: (
  id: EntryId
) => AtomType.Atom<RunRuntimeTelemetryViewModel | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      const telemetry = get(surfaceRunRuntimeTelemetryAtom(id))

      if (telemetry.startedAtMs === null || run.session.sequence === null || run.session.token === null) {
        return null
      }

      const startedAtMs = telemetry.startedAtMs
      const ownership = run.session.ownership
      const facts = run.session.facts
      const draft = run.session.draft
      const identity = run.session.identity
      const localProjectionScript = run.session.localProjectionScript
      const localRunFrame = run.session.localRunFrame
      const canonicalFrame = run.session.canonicalFrame
      const choreography = run.session.choreography
      const summaryRows: ReadonlyArray<RunRuntimeTelemetryRow> = [
        runRuntimeTelemetryRow("Run session", `sequence ${run.session.sequence} · token ${run.session.token}`),
        runRuntimeTelemetryRow(
          "Run state",
          `${run._tag} · control ${run.session.control} · outcome ${run.session.outcome}`
        ),
        runRuntimeTelemetryRow("Entry draft", draft === null ? "none" : `${draft.entryId} · seed ${draft.seedId}`),
        runRuntimeTelemetryRow("Run identity", identity === null ? "none" : identity.requestFingerprint),
        runRuntimeTelemetryRow("Ownership", ownership.detail()),
        runRuntimeTelemetryRow(
          "Internal facts",
          `step queue ${facts.stepQueueDrain.state} · stream ${facts.streamComplete.state}`
        ),
        runRuntimeTelemetryRow("Local plan", localProjectionScript === null ? "none" : localProjectionScript._tag),
        runRuntimeTelemetryRow("Local frame", localRunFrame === null ? "none" : localRunFrame._tag),
        runRuntimeTelemetryRow("Canonical frame", canonicalFrame === null ? "none" : canonicalFrame.step._tag),
        runRuntimeTelemetryRow(
          "Choreography",
          choreography._tag === "Idle"
            ? "idle"
            : `${choreography.stageId} · step ${choreography.step + 1}`
        ),
        ...Option.fromNullable(facts.streamCompletionSummary()).pipe(
          Option.match({
            onNone: (): ReadonlyArray<RunRuntimeTelemetryRow> => [],
            onSome: (
              summary
            ): ReadonlyArray<RunRuntimeTelemetryRow> => [runRuntimeTelemetryRow("Stream summary", summary)]
          })
        )
      ]
      const traceRows = telemetry.events.map((event) =>
        runRuntimeTelemetryRow(
          telemetryEventLabel(event.kind),
          telemetryEventValue({
            atMs: event.atMs,
            detail: event.detail,
            startedAtMs
          })
        )
      )

      return runRuntimeTelemetryViewModel([
        runRuntimeTelemetrySection({
          description: "Reducer-owned session facts, ownership, and internal success-gate facts for the active run.",
          kind: "facts",
          rows: summaryRows,
          title: "Session snapshot"
        }),
        ...(traceRows.length === 0
          ? []
          : [runRuntimeTelemetrySection({
            description: "Cooperative checkpoints and completion observations in reducer order.",
            kind: "trace",
            rows: traceRows,
            title: "Lifecycle trace"
          })])
      ])
    })
)
