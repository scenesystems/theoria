import { Match, Schema } from "effect"
import type { WorkflowSessionId } from "effect-inference/Contracts"
import * as Option from "effect/Option"

import { type WorkflowSeedId, workflowStudyPath } from "./manifest.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const taskBriefingWorkflowFixtureId = "task-briefing"
export const chatHandoffWorkflowFixtureId = "chat-handoff"
export const retrievalRequiredWorkflowFixtureId = "retrieval-required"
export const renderSensitiveWorkflowFixtureId = "render-sensitive"

export const taskBriefingWorkflowSessionId: WorkflowSessionId = "11111111-1111-4111-8111-111111111111"
export const chatHandoffWorkflowSessionId: WorkflowSessionId = "22222222-2222-4222-8222-222222222222"
export const retrievalRequiredWorkflowSessionId: WorkflowSessionId = "33333333-3333-4333-8333-333333333333"
export const renderSensitiveWorkflowSessionId: WorkflowSessionId = "44444444-4444-4444-8444-444444444444"

const fixtureSessionIds: readonly [
  typeof taskBriefingWorkflowSessionId,
  typeof chatHandoffWorkflowSessionId,
  typeof retrievalRequiredWorkflowSessionId,
  typeof renderSensitiveWorkflowSessionId
] = [
  taskBriefingWorkflowSessionId,
  chatHandoffWorkflowSessionId,
  retrievalRequiredWorkflowSessionId,
  renderSensitiveWorkflowSessionId
]

const fixtureIds: readonly [
  typeof taskBriefingWorkflowFixtureId,
  typeof chatHandoffWorkflowFixtureId,
  typeof retrievalRequiredWorkflowFixtureId,
  typeof renderSensitiveWorkflowFixtureId
] = [
  taskBriefingWorkflowFixtureId,
  chatHandoffWorkflowFixtureId,
  retrievalRequiredWorkflowFixtureId,
  renderSensitiveWorkflowFixtureId
]

export const WorkflowFixtureIdSchema = Schema.Literal(...fixtureIds)
export const WorkflowFixtureSeedIdSchema = Schema.Literal(...fixtureSessionIds)

export type WorkflowFixtureId = Schema.Schema.Type<typeof WorkflowFixtureIdSchema>
export type WorkflowFixtureSeedId = Schema.Schema.Type<typeof WorkflowFixtureSeedIdSchema>

export const defaultWorkflowFixtureId: WorkflowFixtureId = taskBriefingWorkflowFixtureId

const isWorkflowFixtureSeedId = Schema.is(WorkflowFixtureSeedIdSchema)

export class WorkflowFixtureManifest extends Schema.Class<WorkflowFixtureManifest>("WorkflowFixtureManifest")({
  id: WorkflowFixtureIdSchema,
  label: NonEmptyString,
  seedId: WorkflowFixtureSeedIdSchema,
  summary: NonEmptyString
}) {
  static defaults(): WorkflowFixtureManifest {
    return byId[defaultWorkflowFixtureId]
  }

  static catalog(): ReadonlyArray<WorkflowFixtureManifest> {
    return fixtureIds.map((id) => byId[id])
  }

  static ids(): ReadonlyArray<WorkflowFixtureId> {
    return fixtureIds
  }

  static forId(id: WorkflowFixtureId): WorkflowFixtureManifest {
    return byId[id]
  }

  static optionForSeedId(seedId: WorkflowSeedId): Option.Option<WorkflowFixtureManifest> {
    return isWorkflowFixtureSeedId(seedId)
      ? Option.some(WorkflowFixtureManifest.forSeedId(seedId))
      : Option.none()
  }

  static forSeedId(seedId: WorkflowFixtureSeedId): WorkflowFixtureManifest {
    return Match.value(seedId).pipe(
      Match.when(taskBriefingWorkflowSessionId, () => taskBriefingManifest),
      Match.when(chatHandoffWorkflowSessionId, () => chatHandoffManifest),
      Match.when(retrievalRequiredWorkflowSessionId, () => retrievalRequiredManifest),
      Match.orElse(() => renderSensitiveManifest)
    )
  }

  searchSeed(): number {
    return Match.value(this.id).pipe(
      Match.when(taskBriefingWorkflowFixtureId, () => 410),
      Match.when(chatHandoffWorkflowFixtureId, () => 411),
      Match.when(retrievalRequiredWorkflowFixtureId, () => 412),
      Match.when(renderSensitiveWorkflowFixtureId, () => 413),
      Match.exhaustive
    )
  }

  path(): string {
    return workflowStudyPath(this.seedId)
  }
}

const taskBriefingManifest = WorkflowFixtureManifest.make({
  id: taskBriefingWorkflowFixtureId,
  label: "Task Briefing",
  seedId: taskBriefingWorkflowSessionId,
  summary:
    "Compares a baseline planning graph against an optimized task-first briefing flow under the same evaluation budget."
})

const chatHandoffManifest = WorkflowFixtureManifest.make({
  id: chatHandoffWorkflowFixtureId,
  label: "Chat Handoff",
  seedId: chatHandoffWorkflowSessionId,
  summary:
    "Compares a baseline conversation-handoff graph against an optimized multi-role continuation flow with the same runtime envelope."
})

const retrievalRequiredManifest = WorkflowFixtureManifest.make({
  id: retrievalRequiredWorkflowFixtureId,
  label: "Retrieval Required",
  seedId: retrievalRequiredWorkflowSessionId,
  summary:
    "Compares an ungrounded route summary against a retrieval-backed workflow that searches over evidence depth and bounded critique topology."
})

const renderSensitiveManifest = WorkflowFixtureManifest.make({
  id: renderSensitiveWorkflowFixtureId,
  label: "Render Sensitive",
  seedId: renderSensitiveWorkflowSessionId,
  summary:
    "Compares a surface-agnostic reply against a render-aware workflow that searches over critique depth, render checks, and surface policy."
})

const byId: Readonly<Record<WorkflowFixtureId, WorkflowFixtureManifest>> = {
  [taskBriefingWorkflowFixtureId]: taskBriefingManifest,
  [chatHandoffWorkflowFixtureId]: chatHandoffManifest,
  [retrievalRequiredWorkflowFixtureId]: retrievalRequiredManifest,
  [renderSensitiveWorkflowFixtureId]: renderSensitiveManifest
}
