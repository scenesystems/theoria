import { Effect, Match, Option } from "effect"

import { openAgentTraceApiRouteFromPathname } from "../../contracts/study/workflow/open-agent-trace.js"
import { OpenAgentTraceService } from "../study/workflow/open-agent-trace/service.js"
import {
  openAgentTraceConsumerArtifactResponse,
  openAgentTraceRegistryResponse,
  openAgentTraceRouteNotFoundResponse,
  openAgentTraceThreadImportResponse,
  openAgentTraceWorkflowHookupResponse
} from "./open-agent-trace-response.js"

export const openAgentTraceRoute = (pathname: string, requestId: string) =>
  openAgentTraceApiRouteFromPathname(pathname).pipe(
    Option.match({
      onNone: () => openAgentTraceRouteNotFoundResponse(requestId),
      onSome: (route) =>
        Match.value(route).pipe(
          Match.tag("consumer-artifacts", () => openAgentTraceConsumerArtifactResponse(requestId)),
          Match.tag("registry", () => openAgentTraceRegistryResponse(requestId)),
          Match.tag("thread-import", () => openAgentTraceThreadImportResponse(requestId)),
          Match.tag("workflow-hookups", () => openAgentTraceWorkflowHookupResponse(requestId)),
          Match.exhaustive
        )
    }),
    Effect.flatten,
    Effect.provide(OpenAgentTraceService.Default)
  )
