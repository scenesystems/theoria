import type { Schema } from "effect"
import { Effect } from "effect"
import type * as ParseResult from "effect/ParseResult"

import type { FailureEnvelope, Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import {
  AmpThreadImportEnvelope,
  type AmpThreadImportPayload,
  encodeRequestJson,
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
  OpenAgentTraceThreadImportRoute,
  type OpenAgentTraceWorkflowHookupCatalog,
  OpenAgentTraceWorkflowHookupCatalogEnvelope,
  OpenAgentTraceWorkflowHookupRoute,
  requestFromInput
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

const postOpenAgentTraceRoute = <A, I>({
  body,
  route,
  schema
}: {
  readonly body: string
  readonly route: OpenAgentTraceApiRoute
  readonly schema: Schema.Schema<{ readonly ok: true; readonly data: A; readonly meta: Metadata } | FailureEnvelope, I>
}): Effect.Effect<EnvelopeResponse<A>, OpenAgentTraceError> =>
  EnvelopeTransport.postJson({
    body,
    errors: openAgentTraceTransportErrors,
    path: route.pathname(),
    schema
  })

export class OpenAgentTraceClient extends Effect.Service<OpenAgentTraceClient>()("theoria/OpenAgentTraceClient", {
  succeed: {
    consumerArtifacts: (): Effect.Effect<OpenAgentTraceConsumerArtifactCatalog, OpenAgentTraceError> =>
      requestOpenAgentTraceRoute({
        route: OpenAgentTraceConsumerArtifactRoute.consumerArtifacts(),
        schema: OpenAgentTraceConsumerArtifactCatalogEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    registry: (): Effect.Effect<ReadonlyArray<OpenAgentTraceRegistryEntry>, OpenAgentTraceError> =>
      requestOpenAgentTraceRoute({
        route: OpenAgentTraceRegistryRoute.registry(),
        schema: OpenAgentTraceRegistryEnvelope
      }).pipe(
        Effect.map(({ data }) => data)
      ),
    importAmpThread: (input: string): Effect.Effect<AmpThreadImportPayload, OpenAgentTraceError> =>
      requestFromInput(input).pipe(
        Effect.flatMap((request) =>
          postOpenAgentTraceRoute({
            body: encodeRequestJson(request),
            route: OpenAgentTraceThreadImportRoute.import(),
            schema: AmpThreadImportEnvelope
          })
        ),
        Effect.map(({ data }) => data)
      ),
    workflowHookups: (): Effect.Effect<OpenAgentTraceWorkflowHookupCatalog, OpenAgentTraceError> =>
      requestOpenAgentTraceRoute({
        route: OpenAgentTraceWorkflowHookupRoute.workflowHookups(),
        schema: OpenAgentTraceWorkflowHookupCatalogEnvelope
      }).pipe(Effect.map(({ data }) => data))
  }
}) {}
