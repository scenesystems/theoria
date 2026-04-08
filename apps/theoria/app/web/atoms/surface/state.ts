import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import { emptyEvidenceStoreState, type EvidenceStoreState } from "../../../contracts/evidence/store.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import { type EvidenceStreamState } from "../../state/evidence/stream.js"
import {
  type LocalProjectionScript,
  type LocalRunFrame,
  type RunRuntimeTelemetryKind,
  type RunRuntimeTelemetryState,
  type RunState
} from "../../state/run/types.js"
import { initialSurfaceState, type PreloadState, type SurfaceState } from "../../state/surface/state.js"

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

const runIsActive = (run: RunState): boolean => run._tag !== "RunIdle"

export const surfaceAtom: (id: EntryId) => AtomType.Writable<SurfaceState> = Atom.family(
  (id: EntryId) => Atom.make(initialSurfaceState(id)).pipe(Atom.keepAlive)
)

export const surfacePreloadStateAtom: (id: EntryId) => AtomType.Atom<PreloadState> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).preload)
)

export const surfaceRunStateAtom: (id: EntryId) => AtomType.Atom<RunState> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).run)
)

export const surfaceDraftAtom: (id: EntryId) => AtomType.Atom<SurfaceState["draft"]> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).draft)
)

export const surfaceRunDraftAtom: (id: EntryId) => AtomType.Atom<RunState["session"]["draft"]> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.draft)
)

export const surfaceRunIdentityAtom: (id: EntryId) => AtomType.Atom<RunState["session"]["identity"]> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.identity)
)

export const surfaceLocalProjectionScriptAtom: (id: EntryId) => AtomType.Atom<LocalProjectionScript | null> = Atom
  .family(
    (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.localProjectionScript)
  )

export const surfaceLocalRunFrameAtom: (id: EntryId) => AtomType.Atom<LocalRunFrame | null> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.localRunFrame)
)

export const surfaceCanonicalFrameAtom: (id: EntryId) => AtomType.Atom<CanonicalFrame | null> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.canonicalFrame)
)

export const surfaceChoreographyStateAtom: (id: EntryId) => AtomType.Atom<ChoreographyState> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.choreography)
)

export const surfaceActiveLocalProjectionScriptAtom: (id: EntryId) => AtomType.Atom<LocalProjectionScript | null> = Atom
  .family(
    (id: EntryId) =>
      Atom.make((get: AtomType.Context) => {
        const run = get(surfaceRunStateAtom(id))
        return runIsActive(run) ? run.session.localProjectionScript : null
      })
  )

export const surfaceActiveLocalRunFrameAtom: (id: EntryId) => AtomType.Atom<LocalRunFrame | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      return runIsActive(run) ? run.session.localRunFrame : null
    })
)

export const surfaceActiveCanonicalFrameAtom: (id: EntryId) => AtomType.Atom<CanonicalFrame | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      return runIsActive(run) ? run.session.canonicalFrame : null
    })
)

export const surfaceStageTabAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceAtom(id)).stageTab)
)

export const surfaceRunDataAtom: (id: EntryId) => AtomType.Atom<RunData | null> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => {
      const run = get(surfaceRunStateAtom(id))
      return run._tag === "RunSuccess" ? run.data : null
    })
)

export const surfaceRunRuntimeTelemetryAtom: (id: EntryId) => AtomType.Atom<RunRuntimeTelemetryState> = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceRunStateAtom(id)).session.telemetry)
)

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
          value: `local ${ownership.localDriver ? "yes" : "no"} · server ${ownership.serverStream ? "yes" : "no"}`
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
        ...Option.fromNullable(facts.streamComplete.summary).pipe(
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

      const sections: ReadonlyArray<RunRuntimeTelemetrySection> = [
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

      return { sections }
    })
)

export const surfaceEvidenceStoreAtom: (id: EntryId) => AtomType.Writable<EvidenceStoreState> = Atom.family(
  (_id: EntryId) => Atom.make(emptyEvidenceStoreState).pipe(Atom.keepAlive)
)

export const surfaceEvidenceStreamStateAtom: (id: EntryId) => AtomType.Writable<EvidenceStoreState> =
  surfaceEvidenceStoreAtom

const surfaceEvidenceSectionOrderAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).sectionOrder)
)

const surfaceEvidenceSectionsByIdAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).sectionsById)
)

export const surfaceEvidenceSectionCountAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceSectionOrderAtom(id)).length)
)

export const surfaceEvidenceCompleteAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).complete)
)

export const surfaceEvidenceSummaryAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).summary)
)

export const surfaceEvidenceMetaAtom = Atom.family(
  (id: EntryId) => Atom.make((get: AtomType.Context) => get(surfaceEvidenceStoreAtom(id)).meta)
)

export const surfaceEvidenceSectionsAtom: (id: EntryId) => AtomType.Atom<ReadonlyArray<EvidenceSection>> = Atom
  .family(
    (id: EntryId) =>
      Atom.make((get: AtomType.Context) => {
        const sectionOrder = get(surfaceEvidenceSectionOrderAtom(id))
        const sectionsById = get(surfaceEvidenceSectionsByIdAtom(id))

        return sectionOrder.flatMap((sectionId: string) => {
          const section = sectionsById[sectionId]
          return Option.fromNullable(section).pipe(
            Option.match({
              onNone: () => [],
              onSome: (value) => [value]
            })
          )
        })
      })
  )

export const surfaceEvidenceStreamAtom: (id: EntryId) => AtomType.Atom<EvidenceStreamState> = Atom.family(
  (id: EntryId) =>
    Atom.make((get: AtomType.Context) => ({
      sections: get(surfaceEvidenceSectionsAtom(id)),
      complete: get(surfaceEvidenceCompleteAtom(id)),
      summary: get(surfaceEvidenceSummaryAtom(id)),
      meta: get(surfaceEvidenceMetaAtom(id))
    }))
)
