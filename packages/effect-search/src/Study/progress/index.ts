/**
 * Terminal progress reporter utilities for streaming study events.
 *
 * @since 0.1.0
 * @module
 */

export {
  formatTerminalProgressEvent,
  ProgressLine,
  type TerminalRenderMode,
  TerminalRenderModeSchema
} from "./formatter.js"

export { defaultTerminalSink, makeTerminalSink, TerminalSink, writeProgressLines } from "./terminalSink.js"

export {
  makeTerminalReporter,
  reportTerminalProgress,
  tapTerminalProgress,
  type TerminalProgressReporter
} from "./terminalReporter.js"
