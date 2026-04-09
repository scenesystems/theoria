import { Schema } from "effect"

import { FailureEnvelope, Metadata } from "../../../envelope.js"
import {
  OpenAgentTraceConsumerArtifactCatalogSchema,
  OpenAgentTraceRegistrySchema,
  OpenAgentTraceWorkflowHookupCatalogSchema
} from "./study-material.js"

export class OpenAgentTraceRegistrySuccessEnvelope extends Schema.Class<OpenAgentTraceRegistrySuccessEnvelope>(
  "OpenAgentTraceRegistrySuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: OpenAgentTraceRegistrySchema
}) {}

export class OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope
  extends Schema.Class<OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope>(
    "OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope"
  )({
    ok: Schema.Literal(true),
    meta: Metadata,
    data: OpenAgentTraceConsumerArtifactCatalogSchema
  })
{}

export class OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope
  extends Schema.Class<OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope>(
    "OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope"
  )({
    ok: Schema.Literal(true),
    meta: Metadata,
    data: OpenAgentTraceWorkflowHookupCatalogSchema
  })
{}

export const OpenAgentTraceRegistryEnvelope = Schema.Union(
  OpenAgentTraceRegistrySuccessEnvelope,
  FailureEnvelope
)

export const OpenAgentTraceConsumerArtifactCatalogEnvelope = Schema.Union(
  OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope,
  FailureEnvelope
)

export const OpenAgentTraceWorkflowHookupCatalogEnvelope = Schema.Union(
  OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope,
  FailureEnvelope
)
