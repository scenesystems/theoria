import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/rpc"

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
  edge: Schema.Finite,
  swing: Schema.Finite,
  phase: Schema.Finite,
  turns: Schema.Finite,
  top: Schema.Finite,
  step: Schema.Finite
})
export type Meander = typeof Meander.Type

/**
 * Deterministic search settings. The seed is fixed so the same artifact at the
 * same stage width always renders the same way; both values are reported.
 *
 * @since 0.3.0
 */
export const renderSeed = 42
export const renderTrials = 36

/** One open search on the worker, of possibly several: a new one for every artifact and every stage width. */
export const PlaceSearchId = Schema.Int.pipe(
  Schema.brand("@theoria/app/contracts/demo/ImaginedPlaceSearch/PlaceSearchId")
)

export type PlaceSearchId = typeof PlaceSearchId.Type

/** The search could not do what was asked: an unknown search, a trial told twice, a sampler that gave up. */
export class PlaceSearchFailed extends Schema.TaggedError<PlaceSearchFailed>(
  "@theoria/app/contracts/demo/ImaginedPlaceSearch/PlaceSearchFailed"
)("PlaceSearchFailed", {
  message: Schema.String
}) {}

/** Opens a search with the render sampler, seed and trial budget the server uses, and names it. */
export class OpenSearch extends Rpc.make("OpenSearch", {
  error: PlaceSearchFailed,
  success: PlaceSearchId,
  payload: {}
}) {}

/** A meander the search proposes, and the trial it is, so its loss can be told back. */
export class AskedMeander
  extends Schema.Class<AskedMeander>("@theoria/app/contracts/demo/ImaginedPlaceSearch/AskedMeander")({
    trial: Schema.Int,
    meander: Meander
  })
{}

/** Asks the search for its next meander to try. */
export class AskSearch extends Rpc.make("AskSearch", {
  error: PlaceSearchFailed,
  success: AskedMeander,
  payload: { search: PlaceSearchId }
}) {}

/** Tells the search what a trial scored. */
export class TellSearch extends Rpc.make("TellSearch", {
  error: PlaceSearchFailed,
  success: Schema.Void,
  payload: { search: PlaceSearchId, trial: Schema.Int, loss: Schema.Finite }
}) {}

/** Closes a search, letting the worker forget it. */
export class CloseSearch extends Rpc.make("CloseSearch", {
  error: PlaceSearchFailed,
  success: Schema.Void,
  payload: { search: PlaceSearchId }
}) {}

export const PlaceSearchRequest = RpcGroup.make(OpenSearch, AskSearch, TellSearch, CloseSearch)

export type PlaceSearchRequest = RpcGroup.Rpcs<typeof PlaceSearchRequest>
