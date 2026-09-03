/**
 * Named procedure catalog for manual ask/tell operations.
 *
 * @since 0.1.0
 */
import { ask, cancel, fail, open, tell } from "./operations.js"
import { events, result } from "./resultEvents.js"
import { snapshot } from "./snapshot.js"

/**
 * Groups the public manual-study functions for adapters that register procedures
 * by name. Each property references the corresponding standalone export.
 *
 * @since 0.1.0
 * @category models
 */
export const askTellProcedureCatalog = {
  open,
  ask,
  tell,
  fail,
  cancel,
  result,
  snapshot,
  events
}
