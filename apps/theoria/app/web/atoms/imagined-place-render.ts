import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType, Result } from "@effect-atom/atom"
import { Study } from "@scenesystems/effect-search"
import { Duration, Effect, Layer, Option, Ref, Stream } from "effect"
import * as Arr from "effect/Array"

import { DemoExecutionError } from "../../contracts/demo-error.js"
import {
  arrange,
  type Arrangement,
  descriptionInput,
  meanderSpace,
  renderingFor,
  renderSampler,
  renderTrials
} from "../../contracts/demo/imagined-place-arrangement.js"
import { type Stage, stageFor } from "../../contracts/demo/imagined-place-flow.js"
import type { PlaceRendering } from "../../contracts/imagined-place-result.js"
import type { PlaceArtifact } from "../../contracts/imagined-place.js"
import { prepareBrowserText } from "../view/text/authority.js"

import { placeArtifactAtom, placeStageWidthAtom } from "./imagined-place.js"

/**
 * Draws the place in the browser with the browser's own font metrics.
 *
 * This is the same search the server runs in `server/imagined-place/render.ts`
 * (same seed, same trial budget, same objective), driven step by step with
 * `Study.ask`/`Study.tell` so the page can show the arrangement improving.
 * Every frame is the best arrangement found so far.
 */
export type PlaceRenderFrame = {
  readonly phase: "running" | "complete"
  readonly trial: number
  readonly rendering: PlaceRendering
}

const renderRuntime = Atom.runtime(Layer.empty)

/** Long enough to see the markers settle, short enough that 36 trials finish in about a second. */
const frameDelay = Duration.millis(28)

type Best = {
  readonly arrangement: Arrangement
  readonly loss: number
}

const frame = (best: Best, stage: Stage, trial: number, phase: PlaceRenderFrame["phase"]): PlaceRenderFrame => ({
  phase,
  trial,
  rendering: renderingFor({ arrangement: best.arrangement, bestLoss: best.loss, stage, trials: trial })
})

const renderFailed = (message: string) => new DemoExecutionError({ code: "execution-failed", message, retryable: true })

const renderStream = (
  artifact: PlaceArtifact,
  stageWidth: number
): Stream.Stream<PlaceRenderFrame, DemoExecutionError> =>
  Study.streamFromEmitter<PlaceRenderFrame, void, DemoExecutionError, never>((emit) =>
    Effect.scoped(
      Effect.gen(function*() {
        const stage = stageFor(stageWidth)
        const prepared = yield* prepareBrowserText(descriptionInput(artifact))
        const candidate = arrange(artifact, prepared, stage)
        const space = yield* meanderSpace
        const handle = yield* Study.open({
          space,
          sampler: renderSampler(),
          objective: (meander) => Effect.succeed(candidate(meander).quality.loss),
          trials: renderTrials,
          direction: "minimize"
        })
        const bestRef = yield* Ref.make(Option.none<Best>())

        yield* Effect.forEach(
          Arr.range(1, renderTrials),
          (trial) =>
            Effect.gen(function*() {
              const asked = yield* Study.ask(handle)
              const arrangement = candidate(asked.config)
              const loss = arrangement.quality.loss
              yield* Study.tell(handle, asked.trialNumber, loss)

              const best = yield* Ref.updateAndGet(
                bestRef,
                Option.match({
                  onNone: () => Option.some({ arrangement, loss }),
                  onSome: (current) => Option.some(loss < current.loss ? { arrangement, loss } : current)
                })
              )
              yield* Option.match(best, {
                onNone: () => Effect.void,
                onSome: (found) => emit(frame(found, stage, trial, trial === renderTrials ? "complete" : "running"))
              })
              yield* Effect.sleep(frameDelay)
            }),
          { concurrency: 1, discard: true }
        )
      })
    ).pipe(Effect.mapError((cause) => renderFailed(String(cause))))
  )

/**
 * The latest frame for the current artifact at the current stage width. A new
 * artifact or a new width starts a new search; the previous frame is kept
 * while it runs so the stage never blanks.
 */
export const placeRenderFrameAtom: AtomType.Atom<Result.Result<PlaceRenderFrame, DemoExecutionError>> = renderRuntime
  .atom((get: AtomType.Context) => {
    const artifact = get(placeArtifactAtom)
    const stageWidth = get(placeStageWidthAtom)
    return Option.match(artifact, {
      onNone: () => Stream.empty,
      onSome: (value) => renderStream(value, stageWidth)
    })
  })
