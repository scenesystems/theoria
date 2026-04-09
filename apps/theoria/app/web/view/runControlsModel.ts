import { Match, Option, Schema } from "effect"

import { type RunControlActionKind, type RunState } from "../state/run/types.js"

export class RunControlActionViewModel extends Schema.Class<RunControlActionViewModel>("RunControlActionViewModel")({
  action: Schema.Literal("run", "pause", "resume", "stop", "reset"),
  disabled: Schema.Boolean,
  label: Schema.String
}) {}

export class RunControlsViewModel extends Schema.Class<RunControlsViewModel>("RunControlsViewModel")({
  phase: Schema.Literal("idle", "running", "paused", "stopping", "failed", "success"),
  primary: RunControlActionViewModel,
  secondary: Schema.OptionFromSelf(RunControlActionViewModel)
}) {}

const action = (
  nextAction: RunControlActionKind,
  label: string,
  disabled = false
): RunControlActionViewModel => RunControlActionViewModel.make({ action: nextAction, disabled, label })

export const runControlsViewModel = ({
  run,
  runLabel
}: {
  readonly run: RunState
  readonly runLabel: string
}): RunControlsViewModel =>
  Match.value(run).pipe(
    Match.tag(
      "RunIdle",
      (): RunControlsViewModel =>
        RunControlsViewModel.make({
          phase: "idle",
          primary: action("run", runLabel),
          secondary: Option.none()
        })
    ),
    Match.tag("RunRunning", ({ session }): RunControlsViewModel =>
      Match.value(session.control).pipe(
        Match.withReturnType<RunControlsViewModel>(),
        Match.when(
          "running",
          () =>
            RunControlsViewModel.make({
              phase: "running",
              primary: action("pause", "Pause"),
              secondary: Option.some(action("stop", "Stop"))
            })
        ),
        Match.when(
          "paused",
          () =>
            RunControlsViewModel.make({
              phase: "paused",
              primary: action("resume", "Resume"),
              secondary: Option.some(action("stop", "Stop"))
            })
        ),
        Match.when(
          "stopping",
          () =>
            RunControlsViewModel.make({
              phase: "stopping",
              primary: action("stop", "Stopping…", true),
              secondary: Option.none()
            })
        ),
        Match.exhaustive
      )),
    Match.tag(
      "RunFailed",
      (): RunControlsViewModel =>
        RunControlsViewModel.make({
          phase: "failed",
          primary: action("run", runLabel),
          secondary: Option.some(action("reset", "Reset"))
        })
    ),
    Match.tag(
      "RunSuccess",
      (): RunControlsViewModel =>
        RunControlsViewModel.make({
          phase: "success",
          primary: action("run", runLabel),
          secondary: Option.some(action("reset", "Reset"))
        })
    ),
    Match.exhaustive
  )
