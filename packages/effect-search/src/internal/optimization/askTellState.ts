/** Private runtime carried by the public scoped Optimization value. */
import { Data } from "effect"
import type { Mailbox, SynchronizedRef } from "effect"

import type * as OptimizationEvent from "../../OptimizationEvent.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type { OptimizePlan, OptimizeSettings } from "./options/plan.js"
import type { OptimizationRuntime } from "./runtime/bootstrap.js"

export class HandleRuntime<Space extends SearchSpace.SearchSpace> extends Data.Class<{
  readonly optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>
  readonly settings: OptimizeSettings
  readonly runtime: OptimizationRuntime<SearchSpace.Type<Space>>
  readonly eventQueue: Mailbox.Mailbox<OptimizationEvent.OptimizationEvent>
  readonly completionPublishedRef: SynchronizedRef.SynchronizedRef<boolean>
}> {}
