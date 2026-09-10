import { Schema } from "effect"

import { Sampler, SearchSpace } from "@scenesystems/effect-search"

/**
 * The arrangement search as driven from another thread. The sampler (TPE,
 * seeded) is the costly part of a trial and grows with every observation; it
 * runs in a Web Worker so the page's frames stay smooth while the drawing
 * travels. The objective — flowing the place's text around the discs with
 * the browser's own font metrics — cannot leave the page, so the search is
 * driven ask by ask: the worker proposes a meander, the page scores it and
 * tells the worker the loss. Every message is a `TaggedRequest`, encoded and
 * decoded through its schema on both sides.
 */

/**
 * Where the markers go: along a meander down the right-hand side of the
 * stage. Six numbers describe it whatever the feature count, which keeps the
 * search small; the text then has to flow around whatever curve is chosen.
 * All values are fractions of the stage width.
 */
export const Meander = Schema.Struct({
  edge: Schema.Number,
  swing: Schema.Number,
  phase: Schema.Number,
  turns: Schema.Number,
  top: Schema.Number,
  step: Schema.Number
})
export type Meander = typeof Meander.Type

type Bounds = readonly [low: number, high: number]

export const meanderBounds: Record<keyof Meander, Bounds> = {
  edge: [0.5, 0.9],
  swing: [0, 0.3],
  phase: [-Math.PI, Math.PI],
  turns: [0.5, 2.5],
  top: [0.04, 0.6],
  step: [0.03, 0.24]
}

export const meanderSpace = SearchSpace.make({
  edge: SearchSpace.float(...meanderBounds.edge),
  swing: SearchSpace.float(...meanderBounds.swing),
  phase: SearchSpace.float(...meanderBounds.phase),
  turns: SearchSpace.float(...meanderBounds.turns),
  top: SearchSpace.float(...meanderBounds.top),
  step: SearchSpace.float(...meanderBounds.step)
})

/**
 * Deterministic search settings. The seed is fixed so the same artifact at the
 * same stage width always renders the same way; both values are reported.
 *
 * @since 0.3.0
 */
export const renderSeed = 42
export const renderTrials = 36

export const renderSampler = () => Sampler.tpe({ seed: renderSeed })

/** One open search on the worker, of possibly several: a new one for every artifact and every stage width. */
export const PlaceSearchId = Schema.Number.pipe(Schema.brand("PlaceSearchId"))

export type PlaceSearchId = typeof PlaceSearchId.Type

/** The search could not do what was asked: an unknown search, a trial told twice, a sampler that gave up. */
export class PlaceSearchFailed extends Schema.TaggedError<PlaceSearchFailed>()("PlaceSearchFailed", {
  message: Schema.String
}) {}

/** Opens a search with the render sampler, seed and trial budget the server uses, and names it. */
export class OpenSearch extends Schema.TaggedRequest<OpenSearch>()("OpenSearch", {
  failure: PlaceSearchFailed,
  success: PlaceSearchId,
  payload: {}
}) {}

/** A meander the search proposes, and the trial it is, so its loss can be told back. */
export class AskedMeander extends Schema.Class<AskedMeander>("AskedMeander")({
  trial: Schema.Number,
  meander: Meander
}) {}

/** Asks the search for its next meander to try. */
export class AskSearch extends Schema.TaggedRequest<AskSearch>()("AskSearch", {
  failure: PlaceSearchFailed,
  success: AskedMeander,
  payload: { search: PlaceSearchId }
}) {}

/** Tells the search what a trial scored. */
export class TellSearch extends Schema.TaggedRequest<TellSearch>()("TellSearch", {
  failure: PlaceSearchFailed,
  success: Schema.Void,
  payload: { search: PlaceSearchId, trial: Schema.Number, loss: Schema.Number }
}) {}

/** Closes a search, letting the worker forget it. */
export class CloseSearch extends Schema.TaggedRequest<CloseSearch>()("CloseSearch", {
  failure: PlaceSearchFailed,
  success: Schema.Void,
  payload: { search: PlaceSearchId }
}) {}

export const PlaceSearchRequest = Schema.Union(OpenSearch, AskSearch, TellSearch, CloseSearch)

export type PlaceSearchRequest = typeof PlaceSearchRequest.Type
