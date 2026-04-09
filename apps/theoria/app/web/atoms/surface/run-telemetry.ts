import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { RunRuntimeTelemetryState } from "../../state/run/runtime-telemetry-state.js"
import type { RunRuntimeTelemetryKind } from "../../state/run/types.js"

import { surfaceRunStateAtom } from "./state.js"

export type RunRuntimeTelemetryRow = {
  readonly label: string
  readonly value: string
}

export type RunRuntimeTelemetrySection = {
  readonly description: string
  readonly kind: "facts" | "trace"
  readonly rows: ReadonlyArray<RunRuntimeTelemetryRow>
  readonly title: string
}

export type RunRuntimeTelemetryViewModel = {
  readonly sections: ReadonlyArray<RunRuntimeTelemetrySection>
}

const telemetrySection = ({
  description,
  kind,
  rows,
  title
}: {
  readonly description: string
  readonly kind: RunRuntimeTelemetrySection["kind"]
  readonly rows: ReadonlyArray<RunRuntimeTelemetryRow>
  readonly title: string
}): RunRuntimeTelemetrySection => ({
  description,
  kind,
  rows,
  title
})

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
        {
          label: "Run session",
          value: `sequence ${run.session.sequence} · token ${run.session.token}`
        },
        {
          label: "Run state",
          value: `${run._tag} · control ${run.session.control} · outcome ${run.session.outcome}`
        },
        {
          label: "Entry draft",
          value: draft === null ? "none" : `${draft.entryId} · seed ${draft.seedId}`
        },
        {
          label: "Run identity",
          value: identity === null ? "none" : identity.requestFingerprint
        },
        {
          label: "Ownership",
          value: ownership.detail()
        },
        {
          label: "Internal facts",
          value: `step queue ${facts.stepQueueDrain.state} · stream ${facts.streamComplete.state}`
        },
        {
          label: "Local plan",
          value: localProjectionScript === null ? "none" : localProjectionScript._tag
        },
        {
          label: "Local frame",
          value: localRunFrame === null ? "none" : localRunFrame._tag
        },
        {
          label: "Canonical frame",
          value: canonicalFrame === null ? "none" : canonicalFrame.step._tag
        },
        {
          label: "Choreography",
          value: choreography._tag === "Idle"
            ? "idle"
            : `${choreography.stageId} · step ${choreography.step + 1}`
        },
        ...Option.fromNullable(facts.streamCompletionSummary()).pipe(
          Option.match({
            onNone: (): ReadonlyArray<RunRuntimeTelemetryRow> => [],
            onSome: (summary): ReadonlyArray<RunRuntimeTelemetryRow> => [{
              label: "Stream summary",
              value: summary
            }]
          })
        )
      ]
      const traceRows = telemetry.events.map((event) => ({
        label: telemetryEventLabel(event.kind),
        value: telemetryEventValue({
          atMs: event.atMs,
          detail: event.detail,
          startedAtMs
        })
      }))

      return {
        sections: [
          telemetrySection({
            description: "Reducer-owned session facts, ownership, and internal success-gate facts for the active run.",
            kind: "facts",
            rows: summaryRows,
            title: "Session snapshot"
          }),
          ...(traceRows.length === 0
            ? []
            : [telemetrySection({
              description: "Cooperative checkpoints and completion observations in reducer order.",
              kind: "trace",
              rows: traceRows,
              title: "Lifecycle trace"
            })])
        ]
      }
    })
)
