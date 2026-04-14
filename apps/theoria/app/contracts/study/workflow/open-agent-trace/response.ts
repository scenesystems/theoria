import { Schema } from "effect"

import { FailureEnvelope, Metadata } from "../../../envelope.js"
import {
  OpenAgentTraceConsumerArtifactCatalogSchema,
  OpenAgentTraceRegistrySchema,
  OpenAgentTraceWorkflowHookupCatalogSchema
} from "./study-material.js"
import { AmpThreadImportPayload } from "./thread-import.js"

export class OpenAgentTraceRegistrySuccessEnvelope extends Schema.Class<OpenAgentTraceRegistrySuccessEnvelope>(
  "OpenAgentTraceRegistrySuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: OpenAgentTraceRegistrySchema
}) {
  static ok(
    meta: Metadata,
    data: typeof OpenAgentTraceRegistrySchema.Type
  ): OpenAgentTraceRegistrySuccessEnvelope {
    return OpenAgentTraceRegistrySuccessEnvelope.make({ ok: true, meta, data })
  }
}

export class OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope
  extends Schema.Class<OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope>(
    "OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope"
  )({
    ok: Schema.Literal(true),
    meta: Metadata,
    data: OpenAgentTraceConsumerArtifactCatalogSchema
  })
{
  static ok(
    meta: Metadata,
    data: typeof OpenAgentTraceConsumerArtifactCatalogSchema.Type
  ): OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope {
    return OpenAgentTraceConsumerArtifactCatalogSuccessEnvelope.make({ ok: true, meta, data })
  }
}

export class OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope
  extends Schema.Class<OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope>(
    "OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope"
  )({
    ok: Schema.Literal(true),
    meta: Metadata,
    data: OpenAgentTraceWorkflowHookupCatalogSchema
  })
{
  static ok(
    meta: Metadata,
    data: typeof OpenAgentTraceWorkflowHookupCatalogSchema.Type
  ): OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope {
    return OpenAgentTraceWorkflowHookupCatalogSuccessEnvelope.make({ ok: true, meta, data })
  }
}

export class AmpThreadImportSuccessEnvelope extends Schema.Class<AmpThreadImportSuccessEnvelope>(
  "AmpThreadImportSuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: AmpThreadImportPayload
}) {
  static ok(meta: Metadata, data: AmpThreadImportPayload): AmpThreadImportSuccessEnvelope {
    return AmpThreadImportSuccessEnvelope.make({ ok: true, meta, data })
  }
}

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

export const AmpThreadImportEnvelope = Schema.Union(AmpThreadImportSuccessEnvelope, FailureEnvelope)
