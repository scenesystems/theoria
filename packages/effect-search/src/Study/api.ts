/**
 * Study API façade.
 *
 * @since 0.1.0
 */

export {
  /** @since 0.1.0 */
  maximize,
  /** @since 0.1.0 */
  minimize,
  /** @since 0.1.0 */
  optimize,
  /** @since 0.1.0 */
  resume,
  /** @since 0.1.0 */
  resumeFromStorage
} from "./api/execute.js"

export {
  /** @since 0.1.0 */
  ask,
  /** @since 0.1.0 */
  AskedTrial,
  /** @since 0.1.0 */
  askTellProcedureCatalog,
  /** @since 0.1.0 */
  cancel,
  /** @since 0.1.0 */
  events,
  /** @since 0.1.0 */
  fail,
  /** @since 0.1.0 */
  isStudyHandle,
  /** @since 0.1.0 */
  open,
  /** @since 0.1.0 */
  result,
  /** @since 0.1.0 */
  snapshot,
  /** @since 0.1.0 */
  StudyHandle,
  /** @since 0.1.0 */
  tell
} from "./api/askTell.js"

export {
  /** @since 0.1.0 */
  optimizeStream,
  /** @since 0.1.0 */
  resumeFromStorageStream,
  /** @since 0.1.0 */
  resumeStream
} from "./api/stream.js"

export {
  /** @since 0.1.0 */
  MultiObjectiveResult,
  /** @since 0.1.0 */
  pareto,
  /** @since 0.1.0 */
  SingleObjectiveResult,
  /** @since 0.1.0 */
  type StudyResult
} from "./api/result.js"
