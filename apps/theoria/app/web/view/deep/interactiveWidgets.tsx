import { Match } from "effect"
import type { ReactNode } from "react"

import type { Id } from "../../../contracts/id.js"

import { LiveDspEvaluation } from "./LiveDspEvaluation.js"
import { LiveOptimization } from "./LiveOptimization.js"
import { LivePowerExplorer } from "./LivePowerExplorer.js"
import { LiveReflow } from "./LiveReflow.js"

export const interactiveWidgetFor = (id: Id): ReactNode | undefined =>
  Match.value(id).pipe(
    Match.when("effect-text", () => <LiveReflow />),
    Match.when("effect-search", () => <LiveOptimization />),
    Match.when("effect-math", () => <LivePowerExplorer />),
    Match.when("effect-dsp", () => <LiveDspEvaluation />),
    Match.orElse(() => undefined)
  )
