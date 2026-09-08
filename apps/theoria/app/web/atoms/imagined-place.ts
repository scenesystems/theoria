import { Atom, Result } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Data, Duration, Effect, Option, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Str from "effect/String"

import type { DemoError } from "../../contracts/demo-error.js"
import { stageFor, stageMaxWidth, stageMinWidth } from "../../contracts/demo/imagined-place-flow.js"
import type { PlaceBuild } from "../../contracts/imagined-place-result.js"
import { PlaceBuildRequest, PlaceScenario, placeScenarioMeta } from "../../contracts/imagined-place.js"
import type { ArtifactStageFrame } from "../../contracts/layout.js"
import type { SuccessEnvelopeData } from "../services/envelopeRequest.js"
import { ImaginedPlaceClient } from "../services/ImaginedPlaceClient.js"
import type { PlaceStep } from "../view/home/placeSteps.js"
import { artifactStageBorderPx } from "../view/primitives/ArtifactStage.js"

/**
 * State for the home-page demo.
 *
 * Two independent inputs: what the place *is* (`placeControlsAtom`, sent to
 * the server) and how wide it is *drawn* (`placeStageRequestAtom`, never sent
 * anywhere). Keeping them apart is the point the demo makes: changing the
 * stage width re-renders but leaves every content ID alone.
 */
export const defaultPlaceScenario: PlaceScenario = "unfinished-light"

/**
 * The choices made by a press: the story and which proposals are merged.
 * Each is a decision, built the moment it is made. The brief is not here: it
 * is typed, and typing settles before it is built.
 */
export const PlaceControls = PlaceBuildRequest.pipe(Schema.omit("brief"))
export type PlaceControls = typeof PlaceControls.Type

export const defaultPlaceControls: PlaceControls = {
  scenario: defaultPlaceScenario,
  acceptNeighbor: true,
  acceptProgram: false
}

export const placeControlsAtom: AtomType.Writable<PlaceControls> = Atom.make(defaultPlaceControls)

/**
 * What the visitor has typed into the brief, under the story it was typed
 * for. A draft belongs to its story: under another story it says nothing, so
 * a story chosen while a draft is settling is built with its own brief, and
 * a story chosen again does not bring an old draft back with it.
 */
export const BriefDraft = Schema.Struct({ scenario: PlaceScenario, text: Schema.String })
export type BriefDraft = typeof BriefDraft.Type

export const placeBriefDraftAtom: AtomType.Writable<Option.Option<BriefDraft>> = Atom.make(Option.none<BriefDraft>())

/** Choosing a story: the story's own brief comes with it; whatever was typed under the last one is let go. */
export const chooseScenarioAtom = Atom.fnSync<PlaceScenario>()((scenario, ctx) => {
  ctx.set(placeControlsAtom, { ...ctx.registry.get(placeControlsAtom), scenario })
  ctx.set(placeBriefDraftAtom, Option.none())
})

/** The brief for a story: what was typed under it, or the one it was recorded with. */
const briefFor = (scenario: PlaceScenario, draft: Option.Option<BriefDraft>): string =>
  Option.match(Option.filter(draft, (typed) => typed.scenario === scenario), {
    onNone: () => placeScenarioMeta[scenario].brief,
    onSome: (typed) => typed.text
  })

/** The brief as the field shows it: every keystroke. */
export const placeBriefAtom: AtomType.Atom<string> = Atom.make((get: AtomType.Context) =>
  briefFor(get(placeControlsAtom).scenario, get(placeBriefDraftAtom))
)

/** Whether the brief shown is no longer the one the story was recorded with. */
export const placeBriefEditedAtom: AtomType.Atom<boolean> = Atom.make((get: AtomType.Context) =>
  get(placeBriefAtom) !== placeScenarioMeta[get(placeControlsAtom).scenario].brief
)

/** How long typing rests before the brief is built: not on every keystroke, not long enough to feel ignored. */
export const briefSettleDelay: Duration.Duration = Duration.millis(400)

const settledBriefDraftAtom = Atom.debounce(placeBriefDraftAtom, briefSettleDelay)

/**
 * What is built: the controls as they stand and the brief as typing left it.
 * A value, so a settled draft that changed nothing is the same request and
 * builds nothing again.
 */
export const placeBuildRequestAtom: AtomType.Atom<PlaceBuildRequest> = Atom.make((get: AtomType.Context) => {
  const controls = get(placeControlsAtom)
  return Data.struct({ ...controls, brief: briefFor(controls.scenario, get(settledBriefDraftAtom)) })
})

/** The home page's own runtime: the place build does not share the docs workbench's client. */
const placeRuntime = Atom.runtime(ImaginedPlaceClient.Default)

/** The server's whole answer, metadata included. Refresh this one to build again after a failure. */
export const placeBuildEnvelopeAtom: AtomType.Atom<Result.Result<SuccessEnvelopeData<PlaceBuild>, DemoError>> =
  placeRuntime.atom(
    (get: AtomType.Context) => {
      const request = get(placeBuildRequestAtom)
      return Effect.gen(function*() {
        const client = yield* ImaginedPlaceClient
        return yield* client.build(request)
      })
    }
  )

export const placeBuildAtom: AtomType.Atom<Result.Result<PlaceBuild, DemoError>> = Atom.make(
  (get: AtomType.Context) => Result.map(get(placeBuildEnvelopeAtom), (envelope) => envelope.data)
)

/** The commit the server was built from, so links into the source show exactly the code that ran. */
export const placeBuildShaAtom: AtomType.Atom<Option.Option<string>> = Atom.make(
  (get: AtomType.Context) => Option.map(Result.value(get(placeBuildEnvelopeAtom)), (envelope) => envelope.meta.buildSha)
)

/**
 * The current version's content ID and how many times it has changed since
 * this place was first built. The count keys a one-shot highlight on the ID
 * wherever it is shown: it moves when a merge or an edited brief changes the
 * record, and stays still when the stage is only redrawn. Zero means "first
 * arrival": no highlight, because nothing changed. Picking another pattern is
 * a different place, not a change to this one, so the count starts over.
 */
const PlaceVersion = Schema.Struct({ scenario: PlaceScenario, contentId: Schema.String })
export const PlaceVersionChange = Schema.Struct({
  current: Schema.OptionFromSelf(PlaceVersion),
  changes: Schema.Number
})
export type PlaceVersionChange = typeof PlaceVersionChange.Type

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

/** The width the stage column actually has, reported by a resize observer; none until it has reported. */
export const placeStageContainerWidthAtom: AtomType.Writable<Option.Option<number>> = Atom.make(
  Option.none<number>()
)

/** The resize observer's report: the column's width, now measured. */
export const measureStageContainerAtom = Atom.fnSync<number>()((width, ctx) => {
  ctx.set(placeStageContainerWidthAtom, Option.some(width))
})

/** The place is drawn on the canvas, unframed; the stage frame is what the column must hold, and that is no border at all. */
export const placeStageFrame: ArtifactStageFrame = "none"

/** The stage frame's border, on each side; the drawing sits inside it, so the column must hold both. */
export const placeStageFrameBorderPx = artifactStageBorderPx(placeStageFrame)

/**
 * The widest stage the column can show once the frame's border has taken its
 * share; the widest stage there is until the column has been measured, so
 * every preset is offered from the first render.
 */
export const placeStageMaxDrawableAtom: AtomType.Atom<number> = Atom.make((get: AtomType.Context) =>
  Option.match(get(placeStageContainerWidthAtom), {
    onNone: () => stageMaxWidth,
    onSome: (container) => Math.max(stageMinWidth, Math.min(stageMaxWidth, container - placeStageFrameBorderPx * 2))
  })
)

/** The stage width that is drawn: the request, cut to the column, clamped to the stage's range. */
export const placeStageWidthAtom: AtomType.Atom<number> = Atom.make(
  (get: AtomType.Context) => stageFor(Math.min(get(placeStageRequestAtom), get(placeStageMaxDrawableAtom))).stageWidth
)

/**
 * The frame's width as CSS before the column has been measured: the request,
 * with the frame's border, cut to the column by the browser itself — the same
 * width the measurement will choose, so the frame stands at its width from the
 * first paint and the measurement moves nothing. A frame left to size itself
 * from its placeholder would shrink around it and then jump to the paper.
 */
export const placeStageFrameWidthAtom: AtomType.Atom<string> = Atom.make(
  (get: AtomType.Context) => `min(100%, ${String(get(placeStageRequestAtom) + placeStageFrameBorderPx * 2)}px)`
)

/**
 * The stage width that is drawn, once the column has been measured; none
 * before. Nothing is cut or drawn for a width that was only guessed: a paper
 * cut for the widest stage would be recut a frame later for the column.
 */
export const placeStageMeasuredWidthAtom: AtomType.Atom<Option.Option<number>> = Atom.make((get: AtomType.Context) =>
  Option.map(get(placeStageContainerWidthAtom), () => get(placeStageWidthAtom))
)

/** Which step of the story the visitor is looking at; the code panel follows it. */
export const placeStepAtom: AtomType.Writable<PlaceStep> = Atom.make<PlaceStep>("compose")
