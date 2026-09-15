/**
 * Cooperative behavior for trial-attributed study stop requests.
 *
 * @since 0.1.0
 */
export {
  defaultMode as defaultStopMode,
  type Mode as StopMode,
  Mode as StopModeSchema,
  modeOrDefault as stopModeOrDefault
} from "@scenesystems/effect-study/Stop"
