import { Option, Schema } from "effect"

const openAgentTraceApiPathnamePrefix = "/api/open-agent-trace"

export class OpenAgentTraceRegistryRoute extends Schema.TaggedClass<OpenAgentTraceRegistryRoute>()("registry", {}) {
  static fromPathname(pathname: string): Option.Option<OpenAgentTraceRegistryRoute> {
    return pathname === OpenAgentTraceRegistryRoute.pathname()
      ? Option.some(OpenAgentTraceRegistryRoute.make({}))
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(OpenAgentTraceRegistryRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return `${openAgentTraceApiPathnamePrefix}/registry`
  }

  pathname(): string {
    return OpenAgentTraceRegistryRoute.pathname()
  }
}

export class OpenAgentTraceConsumerArtifactRoute extends Schema.TaggedClass<OpenAgentTraceConsumerArtifactRoute>()(
  "consumer-artifacts",
  {}
) {
  static fromPathname(pathname: string): Option.Option<OpenAgentTraceConsumerArtifactRoute> {
    return pathname === OpenAgentTraceConsumerArtifactRoute.pathname()
      ? Option.some(OpenAgentTraceConsumerArtifactRoute.make({}))
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(OpenAgentTraceConsumerArtifactRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return `${openAgentTraceApiPathnamePrefix}/consumer-artifacts`
  }

  pathname(): string {
    return OpenAgentTraceConsumerArtifactRoute.pathname()
  }
}

export class OpenAgentTraceWorkflowHookupRoute extends Schema.TaggedClass<OpenAgentTraceWorkflowHookupRoute>()(
  "workflow-hookups",
  {}
) {
  static fromPathname(pathname: string): Option.Option<OpenAgentTraceWorkflowHookupRoute> {
    return pathname === OpenAgentTraceWorkflowHookupRoute.pathname()
      ? Option.some(OpenAgentTraceWorkflowHookupRoute.make({}))
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(OpenAgentTraceWorkflowHookupRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return `${openAgentTraceApiPathnamePrefix}/workflow-hookups`
  }

  pathname(): string {
    return OpenAgentTraceWorkflowHookupRoute.pathname()
  }
}

export const OpenAgentTraceApiRouteSchema = Schema.Union(
  OpenAgentTraceRegistryRoute,
  OpenAgentTraceConsumerArtifactRoute,
  OpenAgentTraceWorkflowHookupRoute
)

export type OpenAgentTraceApiRoute = typeof OpenAgentTraceApiRouteSchema.Type
