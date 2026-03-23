/**
 * @since 0.1.0
 */
import { Effect } from "effect"

import type { InvalidSearchSpace } from "../Errors/index.js"
import { extendSpace } from "./compose/extend.js"
import { projectByNames } from "./compose/rebuild.js"
import { resolveOmitProjectionNames, resolvePickProjectionNames } from "./compose/selection.js"
import type { SearchSpace as SearchSpaceType } from "./model.js"

/**
 * Merge two search spaces and fail when parameter names conflict.
 *
 * @since 0.1.0
 * @category constructors
 */
export const extend = Effect.fn("effect-search/SearchSpace.extend")(
  (left: SearchSpaceType, right: SearchSpaceType): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
    extendSpace(left, right)
)

/**
 * Project a space to selected dimensions and their activation dependencies.
 *
 * @since 0.1.0
 * @category constructors
 */
export const pick = Effect.fn("effect-search/SearchSpace.pick")(
  (space: SearchSpaceType, names: ReadonlyArray<string>): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
    resolvePickProjectionNames(space, names).pipe(
      Effect.flatMap((projectedNames) => projectByNames("pick", space, projectedNames))
    )
)

/**
 * Project a space by removing selected dimensions and their dependent branches.
 *
 * @since 0.1.0
 * @category constructors
 */
export const omit = Effect.fn("effect-search/SearchSpace.omit")(
  (space: SearchSpaceType, names: ReadonlyArray<string>): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
    resolveOmitProjectionNames(space, names).pipe(
      Effect.flatMap((projectedNames) => projectByNames("omit", space, projectedNames))
    )
)
