import { Atom } from "@effect-atom/atom"
import { Layer } from "effect"

/**
 * Effect runtime bridge for atoms that need no services of their own (the
 * wordmark loop, the syntax highlighter). Feature runtimes that do need a
 * client build their own, for example `placeRuntime` in `imagined-place.ts`.
 */
export const appRuntime = Atom.runtime(Layer.empty)
