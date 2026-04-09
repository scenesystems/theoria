/**
 * Choreography Protocol — server-authored study progression.
 *
 * The choreography protocol decouples "what to show" (server authority)
 * from "how to render it" (client projection). The server authors a
 * sequence of stages and cues; the browser reacts to those cues while the
 * canonical frame stream carries the actual authored projection inputs.
 *
 * ## The Problem
 *
 * Older deep-dive surfaces let the browser invent pacing between authored
 * checkpoints. That split timing loop made the UI look authoritative even
 * when the live evidence ledger had already moved on.
 *
 * ## The Solution
 *
 * The server emits choreography cues alongside evidence events. A cue
 * tells the client when to enter, advance, exit, or highlight a stage.
 * The browser becomes a *reactor* — it listens to server cues and performs
 * browser-only work such as canvas measurement or local projection in
 * response. Canonical frame data never travels on cues; it arrives on `Step`.
 *
 * ## Architecture
 *
 * ```
 * Server                          Client
 * ──────                          ──────
 * streamSections() ──→ SSE ──→ evidence-stream.ts
 *                                  ├─ SectionAppend/Upsert → evidence store
 *                                  ├─ Choreography → choreography reducer
 *                                  │    └─ projection reactor reacts: prepare, project, emit frame
 *                                  └─ StreamComplete → finalization
 * ```
 *
 * ## Design Principles
 *
 * 1. **Recognized cues are sequencing authority.** Once a cue decodes as a
 *    known `ChoreographyCue`, the client must reduce it successfully or fail
 *    the run. Only future unknown cue tags may be ignored at the transport
 *    compatibility boundary.
 *
 * 2. **Cues carry sequencing only, not frame payload.** `Step` transports the
 *    canonical frame envelope; choreography tells the browser when to reduce
 *    that authored progression and when to highlight it.
 *
 * 3. **Evidence events remain unchanged.** Choreography extends the
 *    stream; it does not replace existing section/upsert/complete events.
 *
 * 4. **Choreography remains coordination, not authored frame payload.**
 *    `Step` carries canonical frame data; choreography tells the browser how
 *    to sequence that authored progression.
 *
 * @since 0.1.0
 * @module
 */

import { Data, Either, Match, Schema } from "effect"

// ---------------------------------------------------------------------------
// Stage Identity
// ---------------------------------------------------------------------------

/**
 * A stage is a named phase in a study's progression. Each study defines
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
// Cue Payloads — stage parameter instructions
// ---------------------------------------------------------------------------

/**
 * A parameter update tells the client to set a specific control value.
 * Keys are parameter names within the active study domain; values are the
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

export class ChoreographyProtocolViolation extends Schema.TaggedError<ChoreographyProtocolViolation>()(
  "ChoreographyProtocolViolation",
  {
    cueTag: Schema.String,
    message: Schema.String,
    stateTag: Schema.String
  }
) {}

// ---------------------------------------------------------------------------
// Choreography State — client-side reducer
// ---------------------------------------------------------------------------

/**
 * The client's view of choreography progression. Updated by reducing
 * cues from the server stream.
 */
export type ChoreographyState = Data.TaggedEnum<{
  /** No choreography active — the study is idle or has not yet entered a staged run. */
  readonly Idle: {}
  /** A stage is active. The client is rendering frames for this stage. */
  readonly InStage: {
    readonly stageId: StageId
    readonly step: number
    readonly params: CueParams
  }
}>

export const ChoreographyState = Data.taggedEnum<ChoreographyState>()

export const { Idle, InStage } = ChoreographyState

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer for choreography state.
 *
 * Recognized cues are mandatory sequencing authority. A decoded cue either
 * advances the state or returns a protocol violation that the caller must
 * surface as a run failure.
 */
export const reduceChoreographyState = (
  state: ChoreographyState,
  cue: ChoreographyCue
): Either.Either<ChoreographyState, ChoreographyProtocolViolation> => {
  const violation = (message: string): Either.Either<ChoreographyState, ChoreographyProtocolViolation> =>
    Either.left(
      new ChoreographyProtocolViolation({
        cueTag: cue._tag,
        message,
        stateTag: state._tag
      })
    )

  return Match.value(cue).pipe(
    Match.tag("StageEnter", (resolvedCue) =>
      state._tag === "Idle"
        ? Either.right(InStage({ stageId: resolvedCue.stageId, step: 0, params: resolvedCue.params }))
        : violation(`Stage ${resolvedCue.stageId} entered before the active stage completed.`)),
    Match.tag("StageAdvance", (resolvedCue) =>
      state._tag !== "InStage"
        ? violation(`Stage ${resolvedCue.stageId} advanced before any stage was entered.`)
        : state.stageId !== resolvedCue.stageId
        ? violation(`Stage ${resolvedCue.stageId} advanced while ${state.stageId} remained active.`)
        : Either.right(
          InStage({
            stageId: resolvedCue.stageId,
            step: resolvedCue.step,
            params: { ...state.params, ...resolvedCue.params }
          })
        )),
    Match.tag("StageExit", (resolvedCue) =>
      state._tag !== "InStage"
        ? violation(`Stage ${resolvedCue.stageId} exited before any stage was entered.`)
        : state.stageId !== resolvedCue.stageId
        ? violation(`Stage ${resolvedCue.stageId} exited while ${state.stageId} remained active.`)
        : Either.right(Idle())),
    Match.tag("Highlight", () => Either.right(state)),
    Match.exhaustive
  )
}

/**
 * Initial choreography state for a new run.
 */
export const initialChoreographyState: ChoreographyState = Idle()
