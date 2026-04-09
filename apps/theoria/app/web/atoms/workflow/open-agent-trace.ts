import type { Atom as AtomType, Result } from "@effect-atom/atom"
import { Atom } from "@effect-atom/atom"
import { Effect } from "effect"

import type { OpenAgentTraceError } from "../../../contracts/study/workflow/open-agent-trace.js"
import { OpenAgentTracePanelData } from "../../../contracts/study/workflow/open-agent-trace.js"
import { OpenAgentTraceClient } from "../../services/OpenAgentTraceClient.js"

const openAgentTraceRuntime = Atom.runtime(OpenAgentTraceClient.Default)

export const openAgentTracePanelAtom: AtomType.Atom<
  Result.Result<OpenAgentTracePanelData, OpenAgentTraceError>
> = openAgentTraceRuntime.atom(
  Effect.gen(function*() {
    const client = yield* OpenAgentTraceClient

    return yield* Effect.all(
      {
        consumerArtifacts: client.consumerArtifacts(),
        registry: client.registry(),
        workflowHookups: client.workflowHookups()
      },
      {
        concurrency: "unbounded"
      }
    ).pipe(Effect.map(OpenAgentTracePanelData.assemble))
  })
)
