import { Match } from "effect"

import type { EvidenceSection } from "../../../contracts/evidence/item.js"
import type { ChoreographyState } from "../../../contracts/study/workflow/choreography.js"
import type { EvidenceStreamState } from "../../state/evidence/stream.js"
import { statusFromError } from "../../state/run/status.js"
import type { RunInFlightState, RunState } from "../../state/run/types.js"

export type StageBannerViewModel = {
  readonly tone: "live" | "error" | "complete"
  readonly text: string
}

export type DemoEvidenceViewModel =
  | {
    readonly _tag: "empty"
    readonly description: string
    readonly sections: ReadonlyArray<EvidenceSection>
    readonly banner: null
  }
  | {
    readonly _tag: "running"
    readonly description: string
    readonly sections: ReadonlyArray<EvidenceSection>
    readonly banner: StageBannerViewModel | null
  }
  | {
    readonly _tag: "paused"
    readonly description: string
    readonly sections: ReadonlyArray<EvidenceSection>
    readonly banner: StageBannerViewModel | null
  }
  | {
    readonly _tag: "failure"
    readonly description: string
    readonly sections: ReadonlyArray<EvidenceSection>
    readonly banner: StageBannerViewModel | null
  }
  | {
    readonly _tag: "results"
    readonly description: string
    readonly sections: ReadonlyArray<EvidenceSection>
    readonly banner: StageBannerViewModel | null
  }

type InFlightEvidenceViewModel = Extract<DemoEvidenceViewModel, { readonly _tag: "running" | "paused" }>

const formatStageId = (stageId: string): string => stageId.replace(/-/gu, " ")

const liveBanner = (text: string): StageBannerViewModel => ({ tone: "live", text })

const runningEvidenceViewModel = ({
  banner,
  description,
  sections
}: {
  readonly banner: StageBannerViewModel | null
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): Extract<DemoEvidenceViewModel, { readonly _tag: "running" }> => ({
  _tag: "running",
  description,
  sections,
  banner
})

const pausedEvidenceViewModel = ({
  banner,
  description,
  sections
}: {
  readonly banner: StageBannerViewModel | null
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): Extract<DemoEvidenceViewModel, { readonly _tag: "paused" }> => ({
  _tag: "paused",
  description,
  sections,
  banner
})

const stageBanner = (choreography: ChoreographyState): StageBannerViewModel | null =>
  Match.value(choreography).pipe(
    Match.tag("Idle", () => null),
    Match.tag("InStage", ({ stageId, step }) => liveBanner(`${formatStageId(stageId)} · step ${step + 1}`)),
    Match.exhaustive
  )

const streamingDescription = ({
  choreography,
  sectionCount
}: {
  readonly choreography: ChoreographyState
  readonly sectionCount: number
}): string =>
  Match.value(choreography).pipe(
    Match.tag("Idle", () => sectionCount === 0 ? "Generating evidence…" : "Collecting evidence…"),
    Match.tag("InStage", ({ stageId }) => `Streaming ${formatStageId(stageId)}…`),
    Match.exhaustive
  )

const pausedDescription = ({
  choreography,
  sectionCount
}: {
  readonly choreography: ChoreographyState
  readonly sectionCount: number
}): string =>
  Match.value(choreography).pipe(
    Match.tag("Idle", () =>
      sectionCount === 0
        ? "Run paused. Resume to continue collecting evidence."
        : "Resume to continue streaming evidence."),
    Match.tag("InStage", ({ stageId }) => `Run paused at ${formatStageId(stageId)}. Resume to continue.`),
    Match.exhaustive
  )

const emptyEvidenceViewModel = (
  sections: ReadonlyArray<EvidenceSection>
): Extract<DemoEvidenceViewModel, { readonly _tag: "empty" }> => ({
  _tag: "empty",
  description: "Run the demo to generate reproducible evidence.",
  sections,
  banner: null
})

const failureEvidenceViewModel = ({
  description,
  sections
}: {
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): Extract<DemoEvidenceViewModel, { readonly _tag: "failure" }> => ({
  _tag: "failure",
  description,
  sections,
  banner: sections.length === 0
    ? null
    : {
      tone: "error",
      text: description
    }
})

const resultEvidenceViewModel = ({
  description,
  sections
}: {
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): Extract<DemoEvidenceViewModel, { readonly _tag: "results" }> => ({
  _tag: "results",
  description,
  sections,
  banner: null
})

const inFlightEvidenceViewModel = ({
  run,
  stream
}: {
  readonly run: RunInFlightState
  readonly stream: EvidenceStreamState
}): InFlightEvidenceViewModel => {
  const sectionCount = stream.sections.length
  const choreography = run.session.choreography

  return Match.value(run.session.control).pipe(
    Match.when("running", () =>
      runningEvidenceViewModel({
        description: streamingDescription({ choreography, sectionCount }),
        sections: stream.sections,
        banner: stageBanner(choreography)
      })),
    Match.when("paused", () =>
      pausedEvidenceViewModel({
        description: pausedDescription({ choreography, sectionCount }),
        sections: stream.sections,
        banner: stageBanner(choreography)
      })),
    Match.when("stopping", () =>
      runningEvidenceViewModel({
        description: "Stopping run…",
        sections: stream.sections,
        banner: liveBanner("Stopping run…")
      })),
    Match.exhaustive
  )
}

export const demoEvidenceViewModel = ({
  run,
  stream
}: {
  readonly run: RunState
  readonly stream: EvidenceStreamState
}): DemoEvidenceViewModel =>
  Match.value(run).pipe(
    Match.tag("RunIdle", () => emptyEvidenceViewModel(stream.sections)),
    Match.tag("RunRunning", (activeRun) => inFlightEvidenceViewModel({ run: activeRun, stream })),
    Match.tag("RunFailed", ({ error }) =>
      failureEvidenceViewModel({
        description: statusFromError(error),
        sections: stream.sections
      })),
    Match.tag("RunSuccess", ({ data }) =>
      resultEvidenceViewModel({
        description: data.summary,
        sections: stream.sections
      })),
    Match.exhaustive
  )
