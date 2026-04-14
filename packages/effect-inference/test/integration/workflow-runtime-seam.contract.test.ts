import { describe, expect, it } from "@effect/vitest"
import { Effect, Option, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"
import * as Testing from "../../src/testing/index.js"

import { taskFirstWorkflowRecord } from "./workflowFixtures.js"

const capabilityRequirementsSatisfied = (
  requirements: {
    readonly textGeneration: Option.Option<boolean>
    readonly streaming: Option.Option<boolean>
    readonly structuredOutput: Option.Option<Contracts.RuntimeCapabilities["structuredOutput"]>
  },
  capabilities: Contracts.RuntimeCapabilities
): boolean =>
  Option.match(requirements.textGeneration, {
    onNone: () => true,
    onSome: (value) => value === capabilities.textGeneration
  })
  && Option.match(requirements.streaming, {
    onNone: () => true,
    onSome: (value) => value === capabilities.streaming
  })
  && Option.match(requirements.structuredOutput, {
    onNone: () => true,
    onSome: (value) => value === capabilities.structuredOutput
  })

describe("integration/workflow-runtime-seam", () => {
  it.effect("keeps node runtime-role and capability truth aligned with requested and resolved runtime evidence", () =>
    Effect.gen(function*() {
      const workflowRecord = yield* Schema.decodeUnknown(Contracts.WorkflowExecutionRecordSchema)(
        taskFirstWorkflowRecord
      )
      const plannerNode = yield* Option.fromNullable(
        workflowRecord.graph.nodes.find((node) => node.nodeId === "planner")
      ).pipe(
        Option.match({
          onNone: () => Effect.fail("Expected planner node").pipe(Effect.orDie),
          onSome: Effect.succeed
        })
      )

      const desired = Testing.DesiredRuntimeDescriptor.fromTesting({
        modelRef: "openai/gpt-4o-mini",
        route: {
          family: "OpenAiCompatible",
          serveMode: "hosted-api",
          authMethod: "api-key",
          baseUrl: "https://api.openai.com/v1"
        }
      })
      const requestedRuntime = yield* Schema.decodeUnknown(Contracts.DesiredRuntimeDescriptorSchema)({
        ...desired,
        capabilities: plannerNode.capabilityRequirements,
        role: plannerNode.runtimeRole
      })
      const runtimeEvidence = yield* Schema.decodeUnknown(Contracts.RuntimeEvidenceSchema)(
        Testing.RuntimeEvidence.fromTesting({
          desired: requestedRuntime,
          capabilities: {
            textGeneration: true,
            embeddings: false,
            streaming: false,
            toolCalling: false,
            structuredOutput: "best-effort",
            usageReporting: true,
            multimodalInput: false,
            maxContextTokens: 8192
          },
          resolvedRuntime: Testing.ResolvedRuntimeDescriptor.fromTesting({
            responseModel: "gpt-4o-mini-2024-07-18",
            responseId: "resp_workflow_runtime_seam"
          })
        })
      )

      expect(runtimeEvidence.desired.role).toBe(plannerNode.runtimeRole)
      expect(runtimeEvidence.desired.capabilities).toEqual(plannerNode.capabilityRequirements)
      expect(runtimeEvidence.desired.route?.family).toBe("OpenAiCompatible")
      expect(runtimeEvidence.resolvedRoute.route.family).toBe("OpenAiCompatible")
      expect(runtimeEvidence.resolvedRuntime.responseModel).toBe("gpt-4o-mini-2024-07-18")
      expect(
        capabilityRequirementsSatisfied(
          {
            textGeneration: Option.fromNullable(plannerNode.capabilityRequirements?.textGeneration),
            streaming: Option.fromNullable(plannerNode.capabilityRequirements?.streaming),
            structuredOutput: Option.fromNullable(plannerNode.capabilityRequirements?.structuredOutput)
          },
          runtimeEvidence.capabilities
        )
      ).toBe(true)
    }))
})
