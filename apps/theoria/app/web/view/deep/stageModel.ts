import { Match } from "effect"

import type { EvidenceSection } from "../../../contracts/evidence.js"
import { statusFromError } from "../../state/status.js"
import { type EvidenceStreamState, type RunState, type StageTab } from "../../state/types.js"

import type { TabHint } from "./interactiveMetadata.js"

type StageBannerViewModel = {
  readonly tone: "live" | "error" | "complete"
  readonly text: string
}

type EvidenceStateViewModel =
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

export type DemoStageViewModel = {
  readonly activeTab: StageTab
  readonly showTabs: boolean
  readonly interactiveLabel: string | null
  readonly hintText: string
  readonly evidence: DemoEvidenceViewModel
}

export type DemoEvidenceViewModel = EvidenceStateViewModel

export type DemoStageFrameViewModel = {
  readonly activeTab: StageTab
  readonly showTabs: boolean
  readonly interactiveLabel: string | null
  readonly hintText: string
}

const emptyEvidenceState = (sections: ReadonlyArray<EvidenceSection>): EvidenceStateViewModel => ({
  _tag: "empty",
  description: "Run the demo to generate reproducible evidence.",
  sections,
  banner: null
})

const runningEvidenceState = ({
  banner,
  description,
  sections
}: {
  readonly banner: StageBannerViewModel | null
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): EvidenceStateViewModel => ({
  _tag: "running",
  description,
  sections,
  banner
})

const pausedEvidenceState = ({
  banner,
  description,
  sections
}: {
  readonly banner: StageBannerViewModel | null
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): EvidenceStateViewModel => ({
  _tag: "paused",
  description,
  sections,
  banner
})

const failureEvidenceState = ({
  banner,
  description,
  sections
}: {
  readonly banner: StageBannerViewModel | null
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): EvidenceStateViewModel => ({
  _tag: "failure",
  description,
  sections,
  banner
})

const resultEvidenceState = ({
  description,
  sections
}: {
  readonly description: string
  readonly sections: ReadonlyArray<EvidenceSection>
}): EvidenceStateViewModel => ({
  _tag: "results",
  description,
  sections,
  banner: null
})

const formatStageId = (stageId: string): string => stageId.replace(/-/gu, " ")

const stageBanner = (run: RunState): StageBannerViewModel | null =>
  run.session.choreography._tag === "InStage"
    ? {
      tone: "live",
      text: `${formatStageId(run.session.choreography.stageId)} · step ${run.session.choreography.step + 1}`
    }
    : null

const runningDescription = (run: RunState, stream: EvidenceStreamState): string =>
  run.session.choreography._tag === "InStage"
    ? `Streaming ${formatStageId(run.session.choreography.stageId)}…`
    : stream.sections.length === 0
    ? "Generating evidence…"
    : "Collecting evidence…"

const pausedDescription = (run: RunState, stream: EvidenceStreamState): string =>
  run.session.choreography._tag === "InStage"
    ? `Run paused at ${formatStageId(run.session.choreography.stageId)}. Resume to continue.`
    : stream.sections.length === 0
    ? "Run paused. Resume to continue collecting evidence."
    : "Resume to continue streaming evidence."

export const demoEvidenceViewModel = ({
  run,
  stream
}: {
  readonly run: RunState
  readonly stream: EvidenceStreamState
}): DemoEvidenceViewModel =>
  Match.value(run).pipe(
    Match.tag("RunIdle", () => emptyEvidenceState(stream.sections)),
    Match.tag("RunRunning", (activeRun) =>
      activeRun.session.control === "paused"
        ? stream.sections.length === 0
          ? pausedEvidenceState({
            banner: stageBanner(activeRun),
            description: pausedDescription(activeRun, stream),
            sections: stream.sections
          })
          : pausedEvidenceState({
            banner: stageBanner(activeRun),
            description: pausedDescription(activeRun, stream),
            sections: stream.sections
          })
        : stream.sections.length === 0
        ? runningEvidenceState({
          banner: stageBanner(activeRun),
          description: activeRun.session.control === "stopping"
            ? "Stopping run…"
            : runningDescription(activeRun, stream),
          sections: stream.sections
        })
        : runningEvidenceState({
          banner: activeRun.session.control === "stopping"
            ? {
              tone: "live",
              text: "Stopping run…"
            }
            : stageBanner(activeRun),
          description: activeRun.session.control === "stopping"
            ? "Stopping run…"
            : runningDescription(activeRun, stream),
          sections: stream.sections
        })),
    Match.tag("RunFailed", ({ error }) => {
      const description = statusFromError(error)
      return stream.sections.length === 0
        ? failureEvidenceState({
          banner: null,
          description,
          sections: stream.sections
        })
        : failureEvidenceState({
          banner: {
            tone: "error",
            text: description
          },
          description,
          sections: stream.sections
        })
    }),
    Match.tag("RunSuccess", ({ data }) =>
      resultEvidenceState({
        description: data.summary,
        sections: stream.sections
      })),
    Match.exhaustive
  )

export const demoStageViewModel = ({
  activeTab,
  interactiveLabel,
  run,
  stream,
  tabHint
}: {
  readonly activeTab: StageTab
  readonly interactiveLabel: string | null
  readonly run: RunState
  readonly stream: EvidenceStreamState
  readonly tabHint: TabHint
}): DemoStageViewModel => ({
  ...demoStageFrameViewModel({ activeTab, interactiveLabel, tabHint }),
  evidence: demoEvidenceViewModel({ run, stream })
})

export const demoStageFrameViewModel = ({
  activeTab,
  interactiveLabel,
  tabHint
}: {
  readonly activeTab: StageTab
  readonly interactiveLabel: string | null
  readonly tabHint: TabHint
}): DemoStageFrameViewModel => ({
  activeTab,
  showTabs: interactiveLabel !== null,
  interactiveLabel,
  hintText: activeTab === "interactive" ? tabHint.interactive : tabHint.evidence
})
