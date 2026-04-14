import { Match, Option } from "effect"
import * as Arr from "effect/Array"

import {
  chatHandoffWorkflowSessionId,
  retrievalRequiredWorkflowSessionId,
  taskBriefingWorkflowSessionId,
  WorkflowFixtureManifest
} from "../../../../contracts/study/workflow/fixture-manifest.js"
import type { WorkflowSeedId } from "../../../../contracts/study/workflow/manifest.js"
import type { WorkflowScenario } from "../../../../contracts/study/workflow/scenario.js"
import { type WorkflowScenarioCatalog } from "../../../../contracts/study/workflow/scenario.js"
import { chatHandoffWorkflowScenario } from "./chat-handoff.js"
import { renderSensitiveWorkflowScenario } from "./render-sensitive.js"
import { retrievalRequiredWorkflowScenario } from "./retrieval-required.js"
import { taskBriefingWorkflowScenario } from "./task-briefing.js"

export const scenarios: WorkflowScenarioCatalog = Arr.make(
  taskBriefingWorkflowScenario,
  chatHandoffWorkflowScenario,
  retrievalRequiredWorkflowScenario,
  renderSensitiveWorkflowScenario
)

export const fixtureScenarioForSeedId = (seedId: WorkflowSeedId): Option.Option<WorkflowScenario> =>
  WorkflowFixtureManifest.optionForSeedId(seedId).pipe(
    Option.match({
      onNone: () => Option.none(),
      onSome: (fixture) =>
        Option.some(
          Match.value(fixture.seedId).pipe(
            Match.when(taskBriefingWorkflowSessionId, () => taskBriefingWorkflowScenario),
            Match.when(chatHandoffWorkflowSessionId, () => chatHandoffWorkflowScenario),
            Match.when(retrievalRequiredWorkflowSessionId, () => retrievalRequiredWorkflowScenario),
            Match.orElse(() => renderSensitiveWorkflowScenario)
          )
        )
    })
  )
