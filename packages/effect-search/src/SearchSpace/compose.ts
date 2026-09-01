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
 * Extends the left schema with the right schema and concatenates their metadata.
 * Fails with `InvalidSearchSpace` when a parameter name occurs in both spaces or
 * the schemas cannot be extended.
 *
 * @since 0.1.0
 * @category constructors
 */
export const extend = Effect.fn("effect-search/SearchSpace.extend")(
  (left: SearchSpaceType, right: SearchSpaceType): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
    extendSpace(left, right)
)

/**
 * Keeps requested parameters and recursively includes their conditional
 * discriminants. Unknown names and an empty selection fail with
 * `InvalidSearchSpace`; the resulting schema and metadata are rebuilt.
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
 * Removes requested parameters and every conditional descendant of a removed
 * discriminant. Unknown names fail with `InvalidSearchSpace`; the resulting
 * schema and metadata retain source parameter order.
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
