/**
 * Choreography Protocol — server-authored demo progression.
 *
 * The choreography protocol decouples "what to show" (server authority)
 * from "how to render it" (client projection). The server authors a
 * sequence of stages and cues; the client's local animation driver
 * listens to those cues and renders the appropriate frames.
 *
 * ## The Problem
 *
 * Today, server evidence streams and client animation drivers run
 * independently. The server emits EvidenceSection data (tables, metrics)
 * and the client runs a self-timed animation loop (sleepWithRunSignal).
 * There is no coordination — the server doesn't know what the client is
 * showing, and the client doesn't know what the server is computing.
 *
 * ## The Solution
 *
 * The server emits choreography cues alongside evidence events. A cue
 * tells the client: "advance to this stage", "set this parameter",
 * "highlight this result". The client's local animation driver becomes
 * a *reactor* — it listens to server cues and performs browser-only
 * work (canvas measurement, smooth animation) in response.
 *
 * ## Architecture
 *
 * ```
 * Server                          Client
 * ──────                          ──────
 * streamSections() ──→ SSE ──→ evidence-stream.ts
 *                                  ├─ SectionAppend/Upsert → evidence store
 *                                  ├─ StageCue → choreography reducer
 *                                  │    └─ local driver reacts: prepare, project, emit frame
 *                                  └─ StreamComplete → finalization
 * ```
 *
 * ## Design Principles
 *
 * 1. **Cues are hints, not commands.** The client may ignore cues it
 *    doesn't understand (forward compatibility). The client may also
 *    run ahead or behind the server's cue stream.
 *
 * 2. **Cues carry stage identity, not frame data.** The server says
 *    "show corpus entry A at width 280" — the client does the canvas
 *    measurement and produces the actual frame.
 *
 * 3. **Evidence events remain unchanged.** Choreography extends the
 *    stream; it does not replace existing section/upsert/complete events.
 *
 * 4. **Local-only demos are valid.** A demo may have choreography
 *    without a server stream (pure client animation), or a server
 *    stream without choreography (evidence-only demos like digest/seal).
 *
 * @since 0.1.0
 * @module
 */

import { Data, Match, Schema } from "effect"

// ---------------------------------------------------------------------------
// Stage Identity
// ---------------------------------------------------------------------------

/**
 * A stage is a named phase in a demo's progression. Each demo defines
 * its own stage vocabulary.
 *
 * @example
 *   "corpus-sweep"    — effect-text iterating corpus entries
 *   "obstacle-toggle" — effect-text enabling obstacle reflow
 *   "effect-size"     — effect-math sweeping effect sizes
 *   "sample-size"     — effect-math sweeping sample sizes
 *   "tpe-trial"       — effect-search advancing TPE sampler
 */
export const StageId = Schema.String.pipe(Schema.minLength(1))

export type StageId = typeof StageId.Type

// ---------------------------------------------------------------------------
// Cue Payloads — per-demo parameter instructions
// ---------------------------------------------------------------------------

/**
 * A parameter update tells the client to set a specific control value.
 * Keys are parameter names within the demo's domain; values are the
 * target values. The client maps these to its local control atoms.
 *
 * @example
 *   { "corpusIndex": 2, "width": 380, "obstaclesEnabled": false }
 *   { "d": 0.5, "n": 30, "alpha": 0.05 }
 *   { "trialIndex": 7 }
 */
export const CueParams = Schema.Record({
  key: Schema.String,
  value: Schema.Union(Schema.Number, Schema.String, Schema.Boolean)
})

export type CueParams = typeof CueParams.Type

// ---------------------------------------------------------------------------
// Choreography Cues — the server's instruction vocabulary
// ---------------------------------------------------------------------------

/**
 * Begin a named stage. The client should prepare resources for this
 * stage (e.g., prepare a text handle, configure the search space).
 *
 * @example
 *   new StageEnter({ stageId: "corpus-sweep", params: { corpusIndex: 0 } })
 */
export class StageEnter extends Schema.TaggedClass<StageEnter>()("StageEnter", {
  stageId: StageId,
  params: Schema.optionalWith(CueParams, { exact: true, default: () => ({}) })
}) {}

/**
 * Advance within the current stage. The client should update controls
 * and project a new frame.
 *
 * @example
 *   new StageAdvance({ stageId: "corpus-sweep", step: 3, params: { width: 480 } })
 */
export class StageAdvance extends Schema.TaggedClass<StageAdvance>()("StageAdvance", {
  stageId: StageId,
  step: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  params: Schema.optionalWith(CueParams, { exact: true, default: () => ({}) })
}) {}

/**
 * Exit a named stage. The client should finalize any stage-specific
 * state (e.g., emit a summary section, freeze the final frame).
 *
 * @example
 *   new StageExit({ stageId: "corpus-sweep" })
 */
export class StageExit extends Schema.TaggedClass<StageExit>()("StageExit", {
  stageId: StageId
}) {}

/**
 * Highlight a result. The client should visually emphasize a specific
 * metric, trial, or region. This is purely presentational — the
 * evidence data is already in the store.
 *
 * @example
 *   new Highlight({ target: "tpe-best", params: { trialIndex: 12 } })
 */
export class Highlight extends Schema.TaggedClass<Highlight>()("Highlight", {
  target: Schema.String.pipe(Schema.minLength(1)),
  params: Schema.optionalWith(CueParams, { exact: true, default: () => ({}) })
}) {}

/**
 * The complete choreography cue union. This is what flows in the
 * evidence stream alongside SectionAppend/SectionUpsert events.
 */
export const ChoreographyCue = Schema.Union(
  StageEnter,
  StageAdvance,
  StageExit,
  Highlight
)

export type ChoreographyCue = typeof ChoreographyCue.Type

// ---------------------------------------------------------------------------
// Choreography State — client-side reducer
// ---------------------------------------------------------------------------

/**
 * The client's view of choreography progression. Updated by reducing
 * cues from the server stream.
 */
export type ChoreographyState = Data.TaggedEnum<{
  /** No choreography active — demo is idle or uses local-only animation. */
  readonly Idle: {}
  /** A stage is active. The client is rendering frames for this stage. */
  readonly InStage: {
    readonly stageId: StageId
    readonly step: number
    readonly params: CueParams
  }
  /** Choreography is complete — all stages have been exited. */
  readonly Complete: {}
}>

export const ChoreographyState = Data.taggedEnum<ChoreographyState>()

export const { Idle, InStage, Complete } = ChoreographyState

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer for choreography state. Processes a single cue and
 * returns the next state. Unknown cues are ignored (forward compat).
 */
export const reduceChoreographyState = (
  state: ChoreographyState,
  cue: ChoreographyCue
): ChoreographyState =>
  Match.value(cue).pipe(
    Match.tag("StageEnter", (c) => InStage({ stageId: c.stageId, step: 0, params: c.params })),
    Match.tag("StageAdvance", (c) =>
      state._tag === "InStage" && state.stageId === c.stageId
        ? InStage({ stageId: c.stageId, step: c.step, params: { ...state.params, ...c.params } })
        : state),
    Match.tag("StageExit", (c) =>
      state._tag === "InStage" && state.stageId === c.stageId
        ? Idle()
        : state),
    Match.tag("Highlight", () => state),
    Match.exhaustive
  )

/**
 * Initial choreography state for a new run.
 */
export const initialChoreographyState: ChoreographyState = Idle()
