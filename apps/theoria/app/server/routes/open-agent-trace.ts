import { Effect, Match } from "effect"

import {
  OpenAgentTraceConsumerArtifactRoute,
  OpenAgentTraceRegistryRoute,
  OpenAgentTraceWorkflowHookupRoute
} from "../../contracts/study/workflow/open-agent-trace.js"
import { OpenAgentTraceService } from "../study/workflow/open-agent-trace/service.js"
import {
  openAgentTraceConsumerArtifactResponse,
  openAgentTraceRegistryResponse,
  openAgentTraceRouteNotFoundResponse,
  openAgentTraceWorkflowHookupResponse
} from "./open-agent-trace-response.js"

export const openAgentTraceRoute = (pathname: string, requestId: string) =>
  Effect.flatten(
    Match.value(pathname).pipe(
      Match.when(OpenAgentTraceConsumerArtifactRoute.matches, () => openAgentTraceConsumerArtifactResponse(requestId)),
      Match.when(OpenAgentTraceRegistryRoute.matches, () => openAgentTraceRegistryResponse(requestId)),
      Match.when(OpenAgentTraceWorkflowHookupRoute.matches, () => openAgentTraceWorkflowHookupResponse(requestId)),
      Match.orElse(() => openAgentTraceRouteNotFoundResponse(requestId)),
      Effect.provide(OpenAgentTraceService.Default)
    )
  )
