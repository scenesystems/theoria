/**
 * Study API façade.
 *
 * @since 0.1.0
 */

export { maximize, minimize, optimize, resume, resumeFromStorage } from "./api/execute.js"

export {
  ask,
  AskedTrial,
  askTellProcedureCatalog,
  cancel,
  events,
  fail,
  isStudyHandle,
  open,
  result,
  snapshot,
  StudyHandle,
  tell
} from "./api/askTell.js"

export { optimizeStream, resumeFromStorageStream, resumeStream } from "./api/stream.js"

export { MultiObjectiveResult, pareto, SingleObjectiveResult, type StudyResult } from "./api/result.js"
