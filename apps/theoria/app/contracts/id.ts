import { Schema } from "effect"

export const DemoId = Schema.Literal(
  "effect-math",
  "effect-search",
  "effect-dsp",
  "effect-text",
  "effect-inference",
  "digest",
  "seal",
  "sign"
)

export type DemoId = typeof DemoId.Type

export const AuthorityId = DemoId

export type AuthorityId = typeof AuthorityId.Type

export const PackageConsumerId = DemoId

export type PackageConsumerId = typeof PackageConsumerId.Type

export const WorkflowComparisonConsumerId = Schema.Literal("workflow-comparison")

export type WorkflowComparisonConsumerId = typeof WorkflowComparisonConsumerId.Type

export const AppConsumerId = WorkflowComparisonConsumerId

export type AppConsumerId = typeof AppConsumerId.Type

export const PublishedConsumerId = Schema.Union(PackageConsumerId, AppConsumerId)

export type PublishedConsumerId = typeof PublishedConsumerId.Type

export const SurfaceId = PublishedConsumerId

export type SurfaceId = PublishedConsumerId

export const ConsumerId = PackageConsumerId

export type ConsumerId = PackageConsumerId

export const Id = DemoId

export type Id = DemoId

export const demoIds: ReadonlyArray<DemoId> = [
  "effect-math",
  "effect-search",
  "effect-dsp",
  "effect-text",
  "effect-inference",
  "digest",
  "seal",
  "sign"
]

export const authorityIds: ReadonlyArray<AuthorityId> = demoIds

export const packageConsumerIds: ReadonlyArray<PackageConsumerId> = demoIds

export const appConsumerIds: ReadonlyArray<AppConsumerId> = ["workflow-comparison"]

export const publishedConsumerIds: ReadonlyArray<PublishedConsumerId> = [
  ...packageConsumerIds,
  ...appConsumerIds
]

export const consumerIds: ReadonlyArray<ConsumerId> = packageConsumerIds

export const RunnableDemoId = Schema.Literal(
  "effect-math",
  "effect-search",
  "effect-dsp",
  "effect-text",
  "digest",
  "seal",
  "sign"
)

export type RunnableDemoId = typeof RunnableDemoId.Type

export const runnableDemoIds: ReadonlyArray<RunnableDemoId> = [
  "effect-math",
  "effect-search",
  "effect-dsp",
  "effect-text",
  "digest",
  "seal",
  "sign"
]

export const isDemoId = Schema.is(DemoId)

export const isAuthorityId = Schema.is(AuthorityId)

export const isPackageConsumerId = Schema.is(PackageConsumerId)

export const isWorkflowComparisonConsumerId = Schema.is(WorkflowComparisonConsumerId)

export const isAppConsumerId = Schema.is(AppConsumerId)

export const isPublishedConsumerId = Schema.is(PublishedConsumerId)

export const isSurfaceId = Schema.is(SurfaceId)

export const isConsumerId = Schema.is(ConsumerId)

export const isRunnableDemoId = Schema.is(RunnableDemoId)
