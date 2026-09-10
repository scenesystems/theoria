import { WorkerRunner } from "@effect/platform"
import { BrowserRuntime, BrowserWorkerRunner } from "@effect/platform-browser"
import { type Errors, Study } from "@scenesystems/effect-search"
import { Effect, type Scope } from "effect"

import { AskedMeander, meanderSpace, renderSampler, renderTrials } from "../contracts/demo/imagined-place-search.js"
import { OpenedStudy, PlaceSearchStudies } from "./services/PlaceSearchStudies.js"

/**
 * The arrangement search's Web Worker: the program root of the thread that
 * hosts the TPE studies, the way `main.tsx` is the page's. Each open search
 * is one `Study` over the meander space; the objective is the page's to
 * compute, so the one given here is never invoked (`Study.open` retains it
 * without calling it).
 */

const openStudy: Effect.Effect<OpenedStudy, Errors.SearchError, Scope.Scope> = Effect.gen(function*() {
  const space = yield* meanderSpace
  const handle = yield* Study.open({
    space,
    sampler: renderSampler(),
    objective: () => Effect.dieMessage("the page scores every trial; the search only proposes them"),
    trials: renderTrials,
    direction: "minimize"
  })
  return new OpenedStudy({
    ask: Effect.map(
      Study.ask(handle),
      (asked) => new AskedMeander({ trial: asked.trialNumber, meander: asked.config })
    ),
    tell: (trial, loss) => Study.tell(handle, trial, loss)
  })
})

const main = WorkerRunner.launch(PlaceSearchStudies.layer(openStudy)).pipe(Effect.provide(BrowserWorkerRunner.layer))

BrowserRuntime.runMain(main)
