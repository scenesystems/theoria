/** Private runtime carried by the public scoped Study value. */
import { Data } from "effect"
import type { Mailbox, SynchronizedRef } from "effect"

import type * as SearchSpace from "../../SearchSpace.js"
import type { AskedTrial, Study } from "../../Study.js"
import type * as StudyEvent from "../../StudyEvent.js"
import type { OptimizePlan, OptimizeSettings } from "./options/plan.js"
import type { StudyRuntime } from "./runtime/runtimeState.js"

export class HandleRuntime<Space extends SearchSpace.SearchSpace> extends Data.Class<{
  readonly optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>
  readonly settings: OptimizeSettings
  readonly runtime: StudyRuntime<SearchSpace.Type<Space>>
  readonly eventQueue: Mailbox.Mailbox<StudyEvent.StudyEvent>
  readonly completionPublishedRef: SynchronizedRef.SynchronizedRef<boolean>
}> {}

export type { AskedTrial, Study }

export const stateOf = <Space extends SearchSpace.SearchSpace>(study: Study<Space>): HandleRuntime<Space> =>
  study.runtime
