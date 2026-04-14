import { Match, Option } from "effect"
import type { GraphVariant, NodeExecutionContract, WorkflowExecutionRecord } from "effect-inference/Contracts"

import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowSelectedKnobs } from "../../../../contracts/study/workflow/runtime-plan.js"
import type { WorkflowExecutionState } from "./execution-state.js"

const firstUserPrompt = (record: WorkflowExecutionRecord): string =>
  record.session.turns.find((turn) => turn.role === "user")?.content ?? "Summarize the authored graph outcome."

export const inputContextForNode = ({
  node,
  record,
  state
}: {
  readonly node: NodeExecutionContract
  readonly record: WorkflowExecutionRecord
  readonly state: WorkflowExecutionState
}): string => {
  const laneInputs = node.inputLanes.flatMap((lane) => state[lane])

  return laneInputs.length > 0 ? laneInputs.slice(-2).join(" ") : firstUserPrompt(record)
}

const knobValue = ({
  fallback,
  key,
  selectedKnobs
}: {
  readonly fallback: string
  readonly key: string
  readonly selectedKnobs: WorkflowSelectedKnobs
}): string =>
  Option.fromNullable(selectedKnobs[key]).pipe(
    Option.getOrElse(() => fallback)
  )

const responseLengthText = (responseLengthTarget: string): string =>
  Match.value(responseLengthTarget).pipe(
    Match.when("medium", () => "a compact paragraph"),
    Match.when("short", () => "a single compact sentence"),
    Match.orElse(() => "a concise response")
  )

const plannerFraming = (instructionProfile: string): string =>
  Match.value(instructionProfile).pipe(
    Match.when("stepwise", () => "in two compact steps"),
    Match.when("brief", () => "in one concise line"),
    Match.orElse(() => "with a concise planning note")
  )

const runtimePreferenceText = (runtimeProfile: string): string =>
  Match.value(runtimeProfile).pipe(
    Match.when("preferred", () => "the preferred stable runtime path"),
    Match.when("fastest", () => "the fastest available runtime path"),
    Match.orElse(() => "the resolved runtime path")
  )

const renderSurfaceText = (surfaceProfile: string): string =>
  Match.value(surfaceProfile).pipe(
    Match.when("sidebar", () => "sidebar surface"),
    Match.when("full-panel", () => "full-panel surface"),
    Match.orElse(() => "render surface")
  )

const relevantKnobSummary = ({
  node,
  selectedKnobs
}: {
  readonly node: NodeExecutionContract
  readonly selectedKnobs: WorkflowSelectedKnobs
}): string =>
  node.optimizationKnobRefs
    .flatMap((key) =>
      Option.fromNullable(selectedKnobs[key]).pipe(
        Option.match({
          onNone: (): ReadonlyArray<string> => [],
          onSome: (value): ReadonlyArray<string> => [`${key}=${value}`]
        })
      )
    )
    .join(", ")

export const authoredAnswerForNode = ({
  workflowRun,
  node,
  record,
  selectedKnobs,
  state,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly node: NodeExecutionContract
  readonly record: WorkflowExecutionRecord
  readonly selectedKnobs: WorkflowSelectedKnobs
  readonly state: WorkflowExecutionState
  readonly variant: GraphVariant
}): string => {
  const inputContext = inputContextForNode({ node, record, state })
  const instructionProfile = knobValue({
    fallback: "brief",
    key: "instruction-profile",
    selectedKnobs
  })
  const responseLengthTarget = knobValue({
    fallback: "short",
    key: "response-length-target",
    selectedKnobs
  })
  const critiquePassBudget = knobValue({
    fallback: "1",
    key: "critique-pass-budget",
    selectedKnobs
  })
  const runtimeProfile = knobValue({
    fallback: "preferred",
    key: "runtime-profile",
    selectedKnobs
  })
  const retrievalDepth = knobValue({
    fallback: "1",
    key: "retrieval-depth",
    selectedKnobs
  })
  const surfaceProfile = knobValue({
    fallback: "sidebar",
    key: "surface-profile",
    selectedKnobs
  })

  return Match.value(node.nodeKind).pipe(
    Match.when(
      "planner",
      () =>
        `${variant} planner frames ${workflowRun.label.toLowerCase()} around ${inputContext} ${
          plannerFraming(instructionProfile)
        }. It foregrounds requested runtime, route family, and resolved runtime evidence.`
    ),
    Match.when(
      "critic",
      () =>
        `${variant} critic runs ${critiquePassBudget} critique pass${
          critiquePassBudget === "1" ? "" : "es"
        } and adds the missing runtime tradeoff, supporting evidence, and concise handoff that the current graph state still needs.`
    ),
    Match.when(
      "chat-handoff",
      () =>
        `${variant} handoff preserves conversation continuity, the latest route delta, and the user constraint before the next response node runs on ${
          runtimePreferenceText(runtimeProfile)
        }.`
    ),
    Match.when(
      "retrieval",
      () =>
        `${variant} retrieval surfaces ${retrievalDepth} supporting clue${
          retrievalDepth === "1" ? "" : "s"
        }, route memory, and grounding details from the active graph state for downstream nodes.`
    ),
    Match.when(
      "render-evaluator",
      () =>
        `${variant} render evaluator checks ${
          renderSurfaceText(surfaceProfile)
        } fit, narrow panel readability, and above-the-fold coverage before the answer is sealed.`
    ),
    Match.when(
      "responder",
      () =>
        `${variant} responder turns ${inputContext} into ${responseLengthText(responseLengthTarget)} that explains ${
          runtimePreferenceText(runtimeProfile)
        }, the route reason, and the most relevant supporting detail while staying readable in the ${
          renderSurfaceText(surfaceProfile)
        }.`
    ),
    Match.orElse(() =>
      `${variant} ${node.nodeKind} executes on the shared workflow spine for ${workflowRun.workflowKind}.`
    )
  )
}

export const nodeInstructionFor = ({
  workflowRun,
  node,
  selectedKnobs,
  variant
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly node: NodeExecutionContract
  readonly selectedKnobs: WorkflowSelectedKnobs
  readonly variant: GraphVariant
}): string =>
  `${workflowRun.label} runs a ${variant} ${workflowRun.workflowKind} graph. You are the ${node.nodeKind} node writing the next ${node.outputLane} lane update. Return a concise authored answer that preserves route reasoning, runtime provenance, and the most useful supporting detail.${
    Option.fromNullable(relevantKnobSummary({ node, selectedKnobs })).pipe(
      Option.filter((summary) => summary.length > 0),
      Option.match({ onNone: () => "", onSome: (summary) => ` Active knobs: ${summary}.` })
    )
  }`
