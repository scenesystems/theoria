import { Match, Option, Schema } from "effect"

export const RunControlPhase = Schema.Literal("idle", "running", "paused", "stopping", "failed", "success")

export type RunControlPhase = typeof RunControlPhase.Type

export type RunControlsPresentationInput = {
  readonly phase: RunControlPhase
  readonly runLabel: string
}

export class RunControlActionViewModel extends Schema.Class<RunControlActionViewModel>("RunControlActionViewModel")({
  action: Schema.Literal("run", "pause", "resume", "stop", "reset"),
  disabled: Schema.Boolean,
  label: Schema.String
}) {}

const action = (
  nextAction: RunControlActionViewModel["action"],
  label: string,
  disabled = false
): RunControlActionViewModel => RunControlActionViewModel.make({ action: nextAction, disabled, label })

export class RunControlsViewModel extends Schema.Class<RunControlsViewModel>("RunControlsViewModel")({
  phase: RunControlPhase,
  primary: RunControlActionViewModel,
  secondary: Schema.OptionFromSelf(RunControlActionViewModel)
}) {
  static project({ phase, runLabel }: RunControlsPresentationInput): RunControlsViewModel {
    return Match.value(phase).pipe(
      Match.withReturnType<RunControlsViewModel>(),
      Match.when(
        "idle",
        () =>
          RunControlsViewModel.make({
            phase,
            primary: action("run", runLabel),
            secondary: noSecondaryRunControlAction()
          })
      ),
      Match.when(
        "running",
        () =>
          RunControlsViewModel.make({
            phase,
            primary: action("pause", "Pause"),
            secondary: Option.some(action("stop", "Stop"))
          })
      ),
      Match.when(
        "paused",
        () =>
          RunControlsViewModel.make({
            phase,
            primary: action("resume", "Resume"),
            secondary: Option.some(action("stop", "Stop"))
          })
      ),
      Match.when(
        "stopping",
        () =>
          RunControlsViewModel.make({
            phase,
            primary: action("stop", "Stopping…", true),
            secondary: noSecondaryRunControlAction()
          })
      ),
      Match.when(
        "failed",
        () =>
          RunControlsViewModel.make({
            phase,
            primary: action("run", runLabel),
            secondary: Option.some(action("reset", "Reset"))
          })
      ),
      Match.when(
        "success",
        () =>
          RunControlsViewModel.make({
            phase,
            primary: action("run", runLabel),
            secondary: Option.some(action("reset", "Reset"))
          })
      ),
      Match.exhaustive
    )
  }
}

export const noSecondaryRunControlAction = (): Option.Option<RunControlActionViewModel> => Option.none()
