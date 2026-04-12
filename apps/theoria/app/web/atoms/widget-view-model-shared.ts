import { Match } from "effect"

import type { RunState } from "../state/run/types.js"

export type WidgetRuntimeState = {
  readonly controlsLocked: boolean
  readonly isAnimating: boolean
  readonly statusText: string | null
}

const formatStageId = (stageId: string): string => stageId.replace(/-/gu, " ")

export const widgetRuntimeState = (run: RunState): WidgetRuntimeState =>
  Match.value(run).pipe(
    Match.tag("RunRunning", (activeRun) => ({
      controlsLocked: true,
      isAnimating: activeRun.session.control !== "paused",
      statusText: activeRun.session.control === "paused"
        ? activeRun.session.choreography._tag === "InStage"
          ? `Run paused at ${formatStageId(activeRun.session.choreography.stageId)}. Resume to continue.`
          : "Run paused. Resume to continue."
        : activeRun.session.control === "stopping"
        ? "Stopping run…"
        : activeRun.session.choreography._tag === "InStage"
        ? `Streaming ${formatStageId(activeRun.session.choreography.stageId)}…`
        : "Run in progress…"
    })),
    Match.tag("RunSuccess", ({ data }) => ({
      controlsLocked: true,
      isAnimating: false,
      statusText: data.summary
    })),
    Match.tag("RunFailed", () => ({
      controlsLocked: true,
      isAnimating: false,
      statusText: null
    })),
    Match.orElse(() => ({
      controlsLocked: false,
      isAnimating: false,
      statusText: null
    }))
  )
