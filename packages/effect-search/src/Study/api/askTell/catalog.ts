/**
 * Procedure catalog grouping all ask/tell orchestration operations.
 *
 * @since 0.1.0
 */
import { ask, cancel, fail, open, tell } from "./operations.js"
import { events, result } from "./resultEvents.js"
import { snapshot } from "./snapshot.js"

/**
 * Procedure catalog for manual ask/tell orchestration.
 *
 * This stable grouping is intentionally decoupled from runtime internals so
 * adapters can depend on one protocol boundary.
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
