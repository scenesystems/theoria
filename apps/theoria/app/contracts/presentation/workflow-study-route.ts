import { Option, Schema } from "effect"

import { type EntryId, workflowEntryId } from "../entry/id.js"
import { EntryRegistry } from "../entry/registry.js"
import type { ReleaseStage } from "../release-stage.js"
import {
  decodeWorkflowStudyInputOrEmpty,
  encodeWorkflowStudyInputJson,
  WorkflowStudyInput
} from "../study/workflow/input.js"
import { type WorkflowSeedId, WorkflowSeedIdSchema, workflowStudyPath } from "../study/workflow/manifest.js"

import type { PageLocation } from "./page-location.js"
import { WorkflowStudyRouteKey } from "./page-route-key.js"

const entryRegistry = EntryRegistry.current()
const isWorkflowSeedId = Schema.is(WorkflowSeedIdSchema)
const workflowStudyInputSearchParam = "input"

export class WorkflowStudyRoute extends Schema.TaggedClass<WorkflowStudyRoute>()("WorkflowStudyRoute", {
  input: WorkflowStudyInput,
  sessionId: WorkflowSeedIdSchema
}) {
  static fromSessionId(
    sessionId: WorkflowSeedId,
    input: WorkflowStudyInput = WorkflowStudyInput.empty()
  ): WorkflowStudyRoute {
    return WorkflowStudyRoute.make({ input, sessionId })
  }

  static fromLocation(location: PageLocation): Option.Option<WorkflowStudyRoute> {
    const segments = location.pathname.split("/").filter((segment) => segment.length > 0)
    const sessionId = segments[2]

    return segments[0] === "studies" && segments[1] === "workflows" && segments.length === 3 &&
        isWorkflowSeedId(sessionId)
      ? Option.some(
        WorkflowStudyRoute.fromSessionId(
          sessionId,
          decodeWorkflowStudyInputOrEmpty(new URLSearchParams(location.search).get(workflowStudyInputSearchParam))
        )
      )
      : Option.none()
  }

  key(): WorkflowStudyRouteKey {
    return WorkflowStudyRouteKey.fromSessionId(this.sessionId)
  }

  path(): string {
    return this.input.handoff === null
      ? workflowStudyPath(this.sessionId)
      : `${workflowStudyPath(this.sessionId)}?${
        new URLSearchParams({
          [workflowStudyInputSearchParam]: encodeWorkflowStudyInputJson(this.input)
        }).toString()
      }`
  }

  visibleEntryIds(_: ReleaseStage): ReadonlyArray<EntryId> {
    return [workflowEntryId]
  }

  visibleInReleaseStage(stage: ReleaseStage): boolean {
    return entryRegistry.descriptorForId(workflowEntryId).visibleInReleaseStage(stage)
  }
}
