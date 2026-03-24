/**
 * Terminal progress reporter utilities for streaming study events.
 *
 * @since 0.1.0
 */

export {
  /** @since 0.1.0 @category formatters */
  formatTerminalProgressEvent,
  /** @since 0.1.0 @category models */
  ProgressLine,
  /** @since 0.1.0 @category type-level */
  type TerminalRenderMode,
  /** @since 0.1.0 @category schemas */
  TerminalRenderModeSchema
} from "./formatter.js"

export {
  /** @since 0.1.0 @category constructors */
  defaultTerminalSink,
  /** @since 0.1.0 @category constructors */
  makeTerminalSink,
  /** @since 0.1.0 @category models */
  TerminalSink,
  /** @since 0.1.0 @category combinators */
  writeProgressLines
} from "./terminalSink.js"

export {
  /** @since 0.1.0 @category constructors */
  makeTerminalReporter,
  /** @since 0.1.0 @category combinators */
  reportTerminalProgress,
  /** @since 0.1.0 @category combinators */
  tapTerminalProgress,
  /** @since 0.1.0 @category type-level */
  type TerminalProgressReporter
} from "./terminalReporter.js"
