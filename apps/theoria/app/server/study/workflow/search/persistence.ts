import { Array as Arr, Effect, Option, Schema } from "effect"
import { Contracts, Study } from "effect-search"
import type * as SearchSpace from "effect-search/SearchSpace"

import { fingerprintOf } from "../../../../contracts/entry/fingerprint.js"
import { WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import type { WorkflowStudyInput } from "../../../../contracts/study/workflow/input.js"
import { formatWorkflowRevisionDigest } from "../../../../contracts/study/workflow/revision.js"
import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"

const EFFECT_SEARCH_PACKAGE_VERSION = "0.2.1"
const STORAGE_ROOT_DIRECTORY = ".amp/theoria/workflow-studies"
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const ULID_PREFIX = "01ARZ3NDEK"

type WorkflowSearchPersistence = {
  readonly directory: string
  readonly packageVersion: Schema.Schema.Type<typeof Contracts.PackageVersion>
  readonly runId: Schema.Schema.Type<typeof Contracts.RunId>
  readonly studyId: string
}

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const pathSegmentForDigest = (workflowRun: FrozenWorkflowRun): string =>
  formatWorkflowRevisionDigest(workflowRun.revisionDigest).replace(/[^A-Za-z0-9_-]+/gu, "-")

const ulidCharacterAt = (index: number, seed: string): string => {
  const character = ULID_ALPHABET[(seed.charCodeAt(index % seed.length) + index) % ULID_ALPHABET.length]

  return character ?? ULID_ALPHABET[0] ?? "0"
}

const runIdTextFromStudyFingerprint = (studyFingerprint: string): string =>
  `${ULID_PREFIX}${Arr.range(0, 15).map((index) => ulidCharacterAt(index, studyFingerprint)).join("")}`

export const workflowSearchPersistence = ({
  input,
  workflowRun,
  plan
}: {
  readonly input: WorkflowStudyInput
  readonly workflowRun: FrozenWorkflowRun
  readonly plan: WorkflowEntrySelection
}): Effect.Effect<WorkflowSearchPersistence, WorkflowStudyExecutionError, never> =>
  Effect.gen(function*() {
    const inputFingerprint = yield* fingerprintOf(input)
    const controlsFingerprint = yield* fingerprintOf(plan.controls)
    const studyFingerprint = yield* fingerprintOf({
      controlsFingerprint,
      inputFingerprint,
      revisionDigest: formatWorkflowRevisionDigest(workflowRun.revisionDigest)
    })
    const packageVersion = yield* Schema.decode(Contracts.PackageVersion)(EFFECT_SEARCH_PACKAGE_VERSION).pipe(
      Effect.mapError(() =>
        executionError(`Effect-search package version ${EFFECT_SEARCH_PACKAGE_VERSION} is not valid.`)
      )
    )
    const runId = yield* Schema.decode(Contracts.RunId)(runIdTextFromStudyFingerprint(studyFingerprint)).pipe(
      Effect.mapError(() => executionError(`Workflow study run identity synthesis failed for ${workflowRun.seedId}.`))
    )

    return {
      directory: `${STORAGE_ROOT_DIRECTORY}/${
        pathSegmentForDigest(workflowRun)
      }/${inputFingerprint}/${controlsFingerprint}`,
      packageVersion,
      runId,
      studyId: `theoria.workflow.${studyFingerprint}`
    }
  })

export const completedPriorTrialsFromStorage = <Space extends SearchSpace.SearchSpace>({
  space,
  storage,
  workflowRun
}: {
  readonly space: Space
  readonly storage: Study.StudyStorageApi
  readonly workflowRun: FrozenWorkflowRun
}): Effect.Effect<ReadonlyArray<Study.PriorTrial<SearchSpace.Type<Space>>>, WorkflowStudyExecutionError, never> =>
  storage.loadTrialLog().pipe(
    Effect.mapError(() => executionError(`Workflow study storage replay failed for ${workflowRun.seedId}.`)),
    Effect.flatMap((trials) =>
      Effect.forEach(
        trials,
        (trial) => {
          const state = trial.state

          return state._tag !== "Completed"
            ? Effect.succeed(Option.none<Study.PriorTrial<SearchSpace.Type<Space>>>())
            : Schema.decodeUnknown(space.schema)(trial.config).pipe(
              Effect.map((config) =>
                Option.some(
                  new Study.PriorTrial<SearchSpace.Type<Space>>({
                    config,
                    value: state.value,
                    ...(typeof trial.cost === "number" ? { cost: trial.cost } : {})
                  })
                )
              ),
              Effect.mapError(() =>
                executionError(`Workflow study storage contains an invalid persisted config for ${workflowRun.seedId}.`)
              )
            )
        },
        { concurrency: 1 }
      ).pipe(Effect.map(Arr.getSomes))
    )
  )
