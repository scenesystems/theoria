import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import type { DemoError } from "../../contracts/demo-error.js"
import { stageFor, stageMaxWidth, stageMinWidth } from "../../contracts/demo/imagined-place-flow.js"
import type { PlaceBuild } from "../../contracts/imagined-place-result.js"
import {
  type PlaceArtifact,
  type PlaceBuildRequest,
  type PlaceScenario,
  placeScenarioMeta
} from "../../contracts/imagined-place.js"
import { ImaginedPlaceClient } from "../services/ImaginedPlaceClient.js"
import type { PlaceStep } from "../view/home/placeSteps.js"

/**
 * State for the home-page demo.
 *
 * Two independent inputs: what the place *is* (`placeControlsAtom`, sent to
 * the server) and how wide it is *drawn* (`placeStageRequestAtom`, never sent
 * anywhere). Keeping them apart is the point the demo makes: changing the
 * stage width re-renders but leaves every content ID alone.
 */
export const defaultPlaceScenario: PlaceScenario = "unfinished-light"

export const defaultPlaceControls: PlaceBuildRequest = {
  scenario: defaultPlaceScenario,
  brief: placeScenarioMeta[defaultPlaceScenario].brief,
  acceptNeighbor: true,
  acceptProgram: false
}

export const placeControlsAtom: AtomType.Writable<PlaceBuildRequest> = Atom.make(defaultPlaceControls)

/** Switching patterns also resets the brief to the one the pattern was recorded for. */
export const controlsForScenario = (controls: PlaceBuildRequest, scenario: PlaceScenario): PlaceBuildRequest => ({
  ...controls,
  scenario,
  brief: placeScenarioMeta[scenario].brief
})

export const briefIsEdited = (controls: PlaceBuildRequest): boolean =>
  controls.brief !== placeScenarioMeta[controls.scenario].brief

/** Typing in the brief should not build on every keystroke. */
const buildRequestAtom = Atom.debounce(placeControlsAtom, "400 millis")

/** The home page's own runtime: the place build does not share the docs workbench's client. */
const placeRuntime = Atom.runtime(ImaginedPlaceClient.Default)

export const placeBuildAtom: AtomType.Atom<Result.Result<PlaceBuild, DemoError>> = placeRuntime.atom(
  (get: AtomType.Context) => {
    const request = get(buildRequestAtom)
    return Effect.gen(function*() {
      const client = yield* ImaginedPlaceClient
      return yield* client.build(request)
    })
  }
)

/**
 * The artifact to draw: the latest successful build's, kept while the next
 * build is in flight so the stage never blanks. The reference is stable across
 * a rebuild's waiting state, so dependents do not re-run until a new artifact
 * arrives.
 */
export const placeArtifactAtom: AtomType.Atom<Option.Option<PlaceArtifact>> = Atom.make(
  (get: AtomType.Context) => Option.map(Result.value(get(placeBuildAtom)), (build) => build.artifact)
)

export const placeBuildingAtom: AtomType.Atom<boolean> = Atom.make(
  (get: AtomType.Context) => get(placeBuildAtom).waiting
)

/**
 * The current version's content ID and how many times it has changed since
 * this place was first built. The count keys a one-shot highlight on the ID
 * wherever it is shown: it moves when a merge or an edited brief changes the
 * record, and stays still when the stage is only redrawn. Zero means "first
 * arrival": no highlight, because nothing changed. Picking another pattern is
 * a different place, not a change to this one, so the count starts over.
 */
export type PlaceVersionChange = {
  readonly current: Option.Option<{ readonly scenario: PlaceScenario; readonly contentId: string }>
  readonly changes: number
}

const sameVersion = Option.getEquivalence<{ readonly scenario: PlaceScenario; readonly contentId: string }>(
  (a, b) => a.scenario === b.scenario && Str.Equivalence(a.contentId, b.contentId)
)

export const placeVersionChangeAtom: AtomType.Atom<PlaceVersionChange> = Atom.make(
  (get: AtomType.Context): PlaceVersionChange => {
    const current = Option.flatMap(
      Result.value(get(placeBuildAtom)),
      (build) =>
        Option.map(Arr.last(build.evidence.lineage), (version) => ({
          scenario: build.artifact.scenario,
          contentId: version.contentId
        }))
    )
    return Option.match(get.self<PlaceVersionChange>(), {
      onNone: () => ({ current, changes: 0 }),
      onSome: (previous) =>
        Option.isNone(current) || sameVersion(previous.current, current)
          ? previous
          : {
            current,
            changes: Option.match(previous.current, {
              onNone: () => 0,
              onSome: (before) =>
                Option.exists(current, (now) => now.scenario === before.scenario)
                  ? previous.changes + 1
                  : 0
            })
          }
    })
  }
)

export const placeStageMinWidth = stageMinWidth
export const placeStageMaxWidth = stageMaxWidth

/**
 * Narrower screens the same version can be drawn for; the full column is
 * always the last choice. Nothing about the choice reaches the server.
 */
export const placeStagePresets: ReadonlyArray<number> = [320, 520]

/** The width the visitor asked for; by default, as wide as the column allows. */
export const placeStageRequestAtom: AtomType.Writable<number> = Atom.make(stageMaxWidth)

/** The width the stage column actually has, reported by a resize observer. */
export const placeStageContainerWidthAtom: AtomType.Writable<number> = Atom.make(0)

/** The widest stage the column can show. */
export const placeStageMaxDrawableAtom: AtomType.Atom<number> = Atom.make((get: AtomType.Context) => {
  const container = get(placeStageContainerWidthAtom)
  return container > 0 ? Math.max(stageMinWidth, Math.min(stageMaxWidth, container)) : stageMaxWidth
})

/** The stage width that is drawn: the request, cut to the column, clamped to the stage's range. */
export const placeStageWidthAtom: AtomType.Atom<number> = Atom.make(
  (get: AtomType.Context) => stageFor(Math.min(get(placeStageRequestAtom), get(placeStageMaxDrawableAtom))).stageWidth
)

/** Which step of the story the visitor is looking at; the code panel follows it. */
export const placeStepAtom: AtomType.Writable<PlaceStep> = Atom.make<PlaceStep>("compose")
