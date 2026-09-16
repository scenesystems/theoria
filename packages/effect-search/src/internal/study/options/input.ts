/** Internal names for canonical public study option relationships. */
import type * as SearchSpace from "../../../SearchSpace.js"
import type * as Study from "../../../Study.js"
import type { OptimizePlan } from "./plan.js"

export type FlatOptimizeOptions<Config, Space extends SearchSpace.SearchSpace> = Study.FlatOptions<Config, Space>
export type ScheduledOptimizeOptions<Config, Space extends SearchSpace.SearchSpace> = Study.ScheduledOptions<
  Config,
  Space
>
export type OptimizeOptions<Config, Space extends SearchSpace.SearchSpace> = Study.Options<Config, Space>
export type OptimizeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = Study.Options<
  SearchSpace.Type<Space>,
  Space
>
export type ResumeOptionFields<Config, Space extends SearchSpace.SearchSpace> = Study.StorageResumeOptions<
  Config,
  Space
>
export type ResumeOptions<Config, Space extends SearchSpace.SearchSpace> = Study.ResumeOptions<Config, Space>
export type ResumeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = Study.ResumeOptions<
  SearchSpace.Type<Space>,
  Space
>
export type ResumeFromStorageOptions<Config, Space extends SearchSpace.SearchSpace> = Study.StorageResumeOptions<
  Config,
  Space
>
export type ResumeFromStorageOptionsFromSpace<Space extends SearchSpace.SearchSpace> = Study.StorageResumeOptions<
  SearchSpace.Type<Space>,
  Space
>
export type OptimizeSettingsSource<Config, Space extends SearchSpace.SearchSpace> = OptimizePlan<Config, Space>
