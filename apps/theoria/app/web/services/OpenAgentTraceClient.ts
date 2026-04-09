import type { Schema } from "effect"
import { Effect } from "effect"
import type * as ParseResult from "effect/ParseResult"

import type { FailureEnvelope, Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import {
  type OpenAgentTraceApiRoute,
  type OpenAgentTraceConsumerArtifactCatalog,
  OpenAgentTraceConsumerArtifactCatalogEnvelope,
  OpenAgentTraceConsumerArtifactRoute,
  OpenAgentTraceDecodeError,
  type OpenAgentTraceError,
  OpenAgentTraceExecutionError,
  type OpenAgentTraceRegistryEntry,
  OpenAgentTraceRegistryEnvelope,
  OpenAgentTraceRegistryRoute,
  OpenAgentTraceRequestError,
  type OpenAgentTraceWorkflowHookupCatalog,
  OpenAgentTraceWorkflowHookupCatalogEnvelope,
  OpenAgentTraceWorkflowHookupRoute
} from "../../contracts/study/workflow/open-agent-trace.js"
import { type EnvelopeResponse, EnvelopeTransport } from "./EnvelopeTransport.js"

const openAgentTraceTransportErrors = {
  decode: (error: ParseResult.ParseError): OpenAgentTraceError => OpenAgentTraceDecodeError.fromParseError(error),
  execution: (error: ErrorModel): OpenAgentTraceError => OpenAgentTraceExecutionError.fromErrorModel(error),
  request: (message: string): OpenAgentTraceError => OpenAgentTraceRequestError.fromMessage(message)
}

const requestOpenAgentTraceRoute = <A, I>({
  route,
  schema
}: {
  readonly route: OpenAgentTraceApiRoute
  readonly schema: Schema.Schema<{ readonly ok: true; readonly data: A; readonly meta: Metadata } | FailureEnvelope, I>
}): Effect.Effect<EnvelopeResponse<A>, OpenAgentTraceError> =>
  EnvelopeTransport.get({
    errors: openAgentTraceTransportErrors,
    path: route.pathname(),
    schema
  })

export class OpenAgentTraceClient extends Effect.Service<OpenAgentTraceClient>()("theoria/OpenAgentTraceClient", {
  succeed: {
    consumerArtifacts: (): Effect.Effect<OpenAgentTraceConsumerArtifactCatalog, OpenAgentTraceError> =>
      requestOpenAgentTraceRoute({
        route: OpenAgentTraceConsumerArtifactRoute.make({}),
        schema: OpenAgentTraceConsumerArtifactCatalogEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    registry: (): Effect.Effect<ReadonlyArray<OpenAgentTraceRegistryEntry>, OpenAgentTraceError> =>
      requestOpenAgentTraceRoute({
        route: OpenAgentTraceRegistryRoute.make({}),
        schema: OpenAgentTraceRegistryEnvelope
      }).pipe(
        Effect.map(({ data }) => data)
      ),
    workflowHookups: (): Effect.Effect<OpenAgentTraceWorkflowHookupCatalog, OpenAgentTraceError> =>
      requestOpenAgentTraceRoute({
        route: OpenAgentTraceWorkflowHookupRoute.make({}),
        schema: OpenAgentTraceWorkflowHookupCatalogEnvelope
      }).pipe(Effect.map(({ data }) => data))
  }
}) {}
