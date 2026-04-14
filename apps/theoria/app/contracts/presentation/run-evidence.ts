import { Match, Schema } from "effect"

export const RunEvidenceBannerTone = Schema.Literal("live", "complete", "error")

export type RunEvidenceBannerTone = typeof RunEvidenceBannerTone.Type

export class RunEvidenceBanner extends Schema.Class<RunEvidenceBanner>("RunEvidenceBanner")({
  tone: RunEvidenceBannerTone,
  text: Schema.String
}) {}

export const RunEvidenceControl = Schema.Literal("running", "paused", "stopping")

export type RunEvidenceControl = typeof RunEvidenceControl.Type

export type RunEvidencePresentationInput =
  | {
    readonly _tag: "RunEvidenceIdleInput"
  }
  | {
    readonly _tag: "RunEvidenceInFlightInput"
    readonly control: RunEvidenceControl
    readonly sectionCount: number
    readonly stageId: string | null
    readonly step: number | null
  }
  | {
    readonly _tag: "RunEvidenceFailureInput"
    readonly description: string
    readonly hasRetainedEvidence: boolean
  }
  | {
    readonly _tag: "RunEvidenceResultsInput"
    readonly summary: string
  }

export class RunEvidenceIdleViewModel extends Schema.TaggedClass<RunEvidenceIdleViewModel>()("RunEvidenceIdle", {
  banner: Schema.NullOr(RunEvidenceBanner),
  description: Schema.String
}) {}

export class RunEvidenceInFlightViewModel
  extends Schema.TaggedClass<RunEvidenceInFlightViewModel>()("RunEvidenceInFlight", {
    banner: Schema.NullOr(RunEvidenceBanner),
    control: RunEvidenceControl,
    description: Schema.String
  })
{}

export class RunEvidenceFailureViewModel
  extends Schema.TaggedClass<RunEvidenceFailureViewModel>()("RunEvidenceFailure", {
    banner: Schema.NullOr(RunEvidenceBanner),
    description: Schema.String
  })
{}

export class RunEvidenceResultsViewModel
  extends Schema.TaggedClass<RunEvidenceResultsViewModel>()("RunEvidenceResults", {
    banner: Schema.NullOr(RunEvidenceBanner),
    description: Schema.String
  })
{}

export const RunEvidenceViewModel = Schema.Union(
  RunEvidenceIdleViewModel,
  RunEvidenceInFlightViewModel,
  RunEvidenceFailureViewModel,
  RunEvidenceResultsViewModel
)

export type RunEvidenceViewModel = typeof RunEvidenceViewModel.Type

const formatStageId = (stageId: string): string => stageId.replace(/-/gu, " ")

const liveBanner = (text: string): RunEvidenceBanner => RunEvidenceBanner.make({ tone: "live", text })

const stageBanner = ({
  stageId,
  step
}: {
  readonly stageId: string | null
  readonly step: number | null
}): RunEvidenceBanner | null =>
  stageId === null || step === null ? null : liveBanner(`${formatStageId(stageId)} · step ${step + 1}`)

const streamingDescription = ({
  sectionCount,
  stageId
}: {
  readonly sectionCount: number
  readonly stageId: string | null
}): string =>
  stageId === null
    ? sectionCount === 0 ? "Generating evidence…" : "Collecting evidence…"
    : `Streaming ${formatStageId(stageId)}…`

const pausedDescription = ({
  sectionCount,
  stageId
}: {
  readonly sectionCount: number
  readonly stageId: string | null
}): string =>
  stageId === null
    ? sectionCount === 0
      ? "Run paused. Resume to continue collecting evidence."
      : "Resume to continue streaming evidence."
    : `Run paused at ${formatStageId(stageId)}. Resume to continue.`

export const runEvidenceViewModel = (input: RunEvidencePresentationInput): RunEvidenceViewModel =>
  Match.value(input).pipe(
    Match.withReturnType<RunEvidenceViewModel>(),
    Match.tag(
      "RunEvidenceIdleInput",
      () =>
        RunEvidenceIdleViewModel.make({
          banner: null,
          description: "Run the study to generate reproducible evidence."
        })
    ),
    Match.tag(
      "RunEvidenceInFlightInput",
      ({ control, sectionCount, stageId, step }) =>
        Match.value(control).pipe(
          Match.withReturnType<RunEvidenceViewModel>(),
          Match.when(
            "running",
            () =>
              RunEvidenceInFlightViewModel.make({
                banner: stageBanner({ stageId, step }),
                control,
                description: streamingDescription({ sectionCount, stageId })
              })
          ),
          Match.when(
            "paused",
            () =>
              RunEvidenceInFlightViewModel.make({
                banner: stageBanner({ stageId, step }),
                control,
                description: pausedDescription({ sectionCount, stageId })
              })
          ),
          Match.when(
            "stopping",
            () =>
              RunEvidenceInFlightViewModel.make({
                banner: liveBanner("Stopping run…"),
                control,
                description: "Stopping run…"
              })
          ),
          Match.exhaustive
        )
    ),
    Match.tag(
      "RunEvidenceFailureInput",
      ({ description, hasRetainedEvidence }) =>
        RunEvidenceFailureViewModel.make({
          banner: hasRetainedEvidence ? RunEvidenceBanner.make({ tone: "error", text: description }) : null,
          description
        })
    ),
    Match.tag(
      "RunEvidenceResultsInput",
      ({ summary }) =>
        RunEvidenceResultsViewModel.make({
          banner: null,
          description: summary
        })
    ),
    Match.exhaustive
  )

export const runEvidenceComplete = (viewModel: RunEvidenceViewModel): boolean =>
  Match.value(viewModel).pipe(
    Match.tag("RunEvidenceIdle", () => false),
    Match.tag("RunEvidenceInFlight", () => false),
    Match.tag("RunEvidenceFailure", () => false),
    Match.tag("RunEvidenceResults", () => true),
    Match.exhaustive
  )
