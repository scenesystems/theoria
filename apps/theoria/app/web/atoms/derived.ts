import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Option, Schema } from "effect"

import { cardById } from "../../contracts/card.js"
import { Id } from "../../contracts/id.js"
import type { Id as IdType } from "../../contracts/id.js"
import type { SurfaceVariant } from "../../contracts/presentation.js"
import type { RunData } from "../../contracts/run.js"
import { statusText } from "../state/status.js"
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
import {
  type DeepDiveSurfaceFrameViewModel,
  deepDiveSurfaceFrameViewModel,
  type SurfaceViewModel,
  surfaceViewModel
} from "../view/surfaceModel.js"

import {
  surfaceAtom,
  surfaceEvidenceSectionCountAtom,
  surfaceEvidenceStreamAtom,
  surfacePreloadStateAtom,
  surfaceRunDataAtom,
  surfaceRunStateAtom,
  surfaceStageTabAtom
} from "./surface.js"

type ViewModelKey = `${IdType}:${SurfaceVariant}`

export const viewModelKey = (id: IdType, variant: SurfaceVariant): ViewModelKey => `${id}:${variant}`

const isId = Schema.is(Id)

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
          onSome: (card) => deepDiveSurfaceFrameViewModel({ card, state: get(surfaceAtom(id)) })
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

export const deepDiveEvidenceAtom: (id: IdType) => AtomType.Atom<DemoEvidenceViewModel | null> = Atom.family(
  (id: IdType) =>
    Atom.make((get: AtomType.Context) =>
      Option.match(cardById(id), {
        onNone: () => null,
        onSome: () =>
          demoEvidenceViewModel({
            run: get(surfaceRunStateAtom(id)),
            stream: get(surfaceEvidenceStreamAtom(id))
          })
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
