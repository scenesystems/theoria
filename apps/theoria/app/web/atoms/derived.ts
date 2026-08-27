import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Match, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import type { Capabilities } from "../../contracts/capabilities.js"
import { cardById } from "../../contracts/card.js"
import { Id } from "../../contracts/id.js"
import type { Id as IdType } from "../../contracts/id.js"
import type { SurfaceVariant } from "../../contracts/presentation.js"
import type { RunData } from "../../contracts/run.js"
import { statusText } from "../state/status.js"
import { buildEvidencePlaneViewModel, type EvidencePlaneViewModel } from "../view/data/evidence-layout.js"
import { tabHintFor } from "../view/deep/interactiveMetadata.js"
import {
  type DemoEvidenceViewModel,
  demoEvidenceViewModel,
  type DemoStageFrameViewModel,
  demoStageFrameViewModel,
  type DemoStageViewModel,
  demoStageViewModel
} from "../view/deep/stageModel.js"
import { type PresentedRun, presentRun } from "../view/presenter.js"
import type { RunAvailability } from "../view/runControlsModel.js"
import {
  type DeepDiveSurfaceFrameViewModel,
  deepDiveSurfaceFrameViewModel,
  type SurfaceViewModel,
  surfaceViewModel
} from "../view/surfaceModel.js"

import { capabilitiesAtom } from "./capabilities.js"
import { surfaceEvidencePlaneAtom } from "./evidence-plane.js"
import {
  surfaceAtom,
  surfaceEvidenceCompleteAtom,
  surfaceEvidenceMetaAtom,
  surfaceEvidenceSectionCountAtom,
  surfaceEvidenceSectionsAtom,
  surfaceEvidenceStreamAtom,
  surfaceEvidenceSummaryAtom,
  surfacePreloadStateAtom,
  surfaceRunDataAtom,
  surfaceRunStateAtom,
  surfaceStageTabAtom
} from "./surface.js"

type ViewModelKey = `${IdType}:${SurfaceVariant}`

export const viewModelKey = (id: IdType, variant: SurfaceVariant): ViewModelKey => `${id}:${variant}`

const isId = Schema.is(Id)

const dspRunAvailability = (
  result: Result.Result<Capabilities, unknown>
): RunAvailability =>
  Result.match(result, {
    onInitial: () => "checking",
    onFailure: () => "unavailable",
    onSuccess: ({ value }) =>
      Arr.findFirst(value.demos, ({ id }) => id === "effect-dsp").pipe(
        Option.match({
          onNone: (): RunAvailability => "unavailable",
          onSome: ({ enabled }): RunAvailability => enabled ? "available" : "unavailable"
        })
      )
  })

const runAvailability = (id: IdType, get: AtomType.Context): RunAvailability =>
  Match.value(id).pipe(
    Match.when("effect-dsp", () => dspRunAvailability(get(capabilitiesAtom))),
    Match.orElse((): RunAvailability => "available")
  )

export const surfaceViewModelAtom: (key: ViewModelKey) => AtomType.Atom<SurfaceViewModel | null> = Atom.family(
  (key: ViewModelKey) => {
    const separatorIndex = key.lastIndexOf(":")
    const rawId = key.slice(0, separatorIndex)
    const variant: SurfaceVariant = key.slice(separatorIndex + 1) === "compact" ? "compact" : "expanded"

    if (!isId(rawId)) {
      return Atom.make(() => null)
    }

    const id = rawId
    return Atom.make((get: AtomType.Context) =>
      Option.match(cardById(id), {
        onNone: () => null,
        onSome: (card) => {
          const state = get(surfaceAtom(id))
          const presented = get(presentedRunAtom(id))
          const stream = get(surfaceEvidenceStreamAtom(id))
          return surfaceViewModel({ card, presented, state, stream, variant })
        }
      })
    )
  }
)

export const deepDiveSurfaceFrameAtom: (id: IdType) => AtomType.Atom<DeepDiveSurfaceFrameViewModel | null> = Atom
  .family(
    (id: IdType) =>
      Atom.make((get: AtomType.Context) =>
        Option.match(cardById(id), {
          onNone: () => null,
          onSome: (card) =>
            deepDiveSurfaceFrameViewModel({
              availability: runAvailability(id, get),
              card,
              state: get(surfaceAtom(id))
            })
        })
      )
  )

export const deepDiveStatusAtom: (id: IdType) => AtomType.Atom<string | null> = Atom.family(
  (id: IdType) =>
    Atom.make((get: AtomType.Context) =>
      Option.match(cardById(id), {
        onNone: () => null,
        onSome: () =>
          statusText(
            {
              preload: get(surfacePreloadStateAtom(id)),
              run: get(surfaceRunStateAtom(id))
            },
            {
              complete: false,
              sectionCount: get(surfaceEvidenceSectionCountAtom(id))
            }
          )
      })
    )
)

export const deepDiveStageFrameAtom: (id: IdType) => AtomType.Atom<DemoStageFrameViewModel | null> = Atom.family(
  (id: IdType) =>
    Atom.make((get: AtomType.Context) =>
      Option.match(cardById(id), {
        onNone: () => null,
        onSome: (card) =>
          demoStageFrameViewModel({
            activeTab: get(surfaceStageTabAtom(id)),
            interactiveLabel: card.interactiveLabel ?? null,
            tabHint: tabHintFor(card.id)
          })
      })
    )
)

type DeepDiveEvidenceAtomViewModel = DemoEvidenceViewModel & {
  readonly plane: EvidencePlaneViewModel
}

export const deepDiveEvidenceAtom: (id: IdType) => AtomType.Atom<DeepDiveEvidenceAtomViewModel | null> = Atom.family(
  (id: IdType) =>
    Atom.make((get: AtomType.Context) =>
      Option.match(cardById(id), {
        onNone: () => null,
        onSome: () => {
          const run = get(surfaceRunStateAtom(id))
          const stream = get(surfaceEvidenceStreamAtom(id))
          const plane = get(surfaceEvidencePlaneAtom(id))

          return {
            ...demoEvidenceViewModel({ run, stream }),
            plane: buildEvidencePlaneViewModel({
              complete: get(surfaceEvidenceCompleteAtom(id)),
              filter: plane.filter,
              meta: get(surfaceEvidenceMetaAtom(id)),
              order: plane.order,
              sections: get(surfaceEvidenceSectionsAtom(id)),
              sectionKey: plane.sectionKey,
              summary: get(surfaceEvidenceSummaryAtom(id))
            })
          }
        }
      })
    )
)

export const deepDiveStageAtom: (id: IdType) => AtomType.Atom<DemoStageViewModel | null> = Atom.family(
  (id: IdType) =>
    Atom.make((get: AtomType.Context) =>
      Option.match(cardById(id), {
        onNone: () => null,
        onSome: (card) =>
          demoStageViewModel({
            activeTab: get(surfaceStageTabAtom(id)),
            interactiveLabel: card.interactiveLabel ?? null,
            run: get(surfaceRunStateAtom(id)),
            stream: get(surfaceEvidenceStreamAtom(id)),
            tabHint: tabHintFor(card.id)
          })
      })
    )
)

export const presentedRunAtom: (id: IdType) => AtomType.Atom<PresentedRun | null> = Atom.family(
  (id: IdType) =>
    Atom.make((get: AtomType.Context) => {
      const runData: RunData | null = get(surfaceRunDataAtom(id))
      return runData !== null ? presentRun(runData) : null
    })
)
