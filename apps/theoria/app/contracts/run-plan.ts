import { Effect, Predicate, Schema } from "effect"

import { DurableFingerprint, fingerprintOf } from "./fingerprint.js"
import { RunnableDemoId, type SurfaceId } from "./id.js"
import { StreamManifest } from "./stream-manifest.js"
import { WorkflowComparisonRunPlan } from "./workflow/comparison-run.js"

const RunToken = Schema.String.pipe(Schema.minLength(1))

export const RunPlan = Schema.Struct({
  id: RunnableDemoId,
  manifest: Schema.NullOr(StreamManifest)
})

export type RunPlan = typeof RunPlan.Type

export const RunWorkflowRequest = Schema.Struct({
  runToken: RunToken,
  plan: RunPlan
})

export type RunWorkflowRequest = typeof RunWorkflowRequest.Type

export const SurfaceRunPlan = Schema.Union(RunPlan, WorkflowComparisonRunPlan)

export type SurfaceRunPlan = typeof SurfaceRunPlan.Type

export const isDemoSurfaceRunPlan = (plan: SurfaceRunPlan | null): plan is RunPlan =>
  Predicate.isRecord(plan) && Predicate.hasProperty(plan, "id")

export const isWorkflowComparisonSurfaceRunPlan = (
  plan: SurfaceRunPlan | null
): plan is WorkflowComparisonRunPlan => Predicate.isRecord(plan) && Predicate.hasProperty(plan, "consumerId")

export const surfaceRunPlanId = (plan: SurfaceRunPlan): SurfaceId =>
  isWorkflowComparisonSurfaceRunPlan(plan) ? plan.consumerId : plan.id

export const RunWorkflowIdentity = Schema.Struct({
  consumerId: RunnableDemoId,
  runToken: RunToken,
  manifestFingerprint: DurableFingerprint,
  planFingerprint: DurableFingerprint,
  requestFingerprint: DurableFingerprint
})

export type RunWorkflowIdentity = typeof RunWorkflowIdentity.Type

const encodeRunManifest = Schema.encodeSync(Schema.NullOr(StreamManifest))
const encodeRunPlan = Schema.encodeSync(RunPlan)
const encodeRunWorkflowRequest = Schema.encodeSync(RunWorkflowRequest)

const RunWorkflowRequestJson = Schema.parseJson(RunWorkflowRequest)

export const encodeRunWorkflowRequestJson = Schema.encodeSync(RunWorkflowRequestJson)

export const fingerprintRunManifest = (
  manifest: StreamManifest | null
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeRunManifest(manifest))

export const fingerprintRunPlan = (plan: RunPlan): Effect.Effect<typeof DurableFingerprint.Type, never, never> =>
  fingerprintOf(encodeRunPlan(plan))

export const fingerprintRunWorkflowRequest = (
  request: RunWorkflowRequest
): Effect.Effect<typeof DurableFingerprint.Type, never, never> => fingerprintOf(encodeRunWorkflowRequest(request))

export const resolveRunWorkflowIdentity = (
  request: RunWorkflowRequest
): Effect.Effect<RunWorkflowIdentity, never, never> =>
  Effect.all({
    manifestFingerprint: fingerprintRunManifest(request.plan.manifest),
    planFingerprint: fingerprintRunPlan(request.plan),
    requestFingerprint: fingerprintRunWorkflowRequest(request)
  }).pipe(
    Effect.map(({ manifestFingerprint, planFingerprint, requestFingerprint }) => ({
      consumerId: request.plan.id,
      runToken: request.runToken,
      manifestFingerprint,
      planFingerprint,
      requestFingerprint
    }))
  )
