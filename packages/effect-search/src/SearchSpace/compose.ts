/**
 * Composition and projection of compiled search spaces.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import type { InvalidSearchSpace } from "../Errors/index.js"
import { extendSpace } from "./compose/extend.js"
import { projectByNames } from "./compose/rebuild.js"
import { resolveOmitProjectionNames, resolvePickProjectionNames } from "./compose/selection.js"
import type { SearchSpace as SearchSpaceType } from "./model.js"

/**
 * Combines two spaces whose parameter names and schemas are compatible.
 *
 * @remarks
 * Parameter metadata preserves left-then-right order. Duplicate parameter names
 * and schema extension failures use `InvalidSearchSpace`; neither input is
 * modified.
 *
 * @since 0.1.0
 * @category combinators
 */
export const extend = Effect.fn("effect-search/SearchSpace.extend")(
  (left: SearchSpaceType, right: SearchSpaceType): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
    extendSpace(left, right)
)

/**
 * Projects selected parameters together with their activation dependencies.
 *
 * @remarks
 * Names are deduplicated. Conditional discriminants are added recursively and
 * metadata retains source order. Unknown names, an empty request, dangling
 * dependencies, and unsupported conditional shapes fail with
 * `InvalidSearchSpace`. The schema is rebuilt from distribution metadata, so
 * numeric bounds remain sampling constraints rather than decode refinements.
 *
 * @since 0.1.0
 * @category combinators
 */
export const pick = Effect.fn("effect-search/SearchSpace.pick")(
  (space: SearchSpaceType, names: ReadonlyArray<string>): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
    resolvePickProjectionNames(space, names).pipe(
      Effect.flatMap((projectedNames) => projectByNames("pick", space, projectedNames))
    )
)

/**
 * Projects a space after removing parameters and conditional descendants.
 *
 * @remarks
 * Removing a discriminant removes every parameter whose activation path depends
 * on it. Names are deduplicated, source order is retained, and omitting every
 * parameter produces an empty struct. Unknown names and unsupported rebuilt
 * conditional shapes fail with `InvalidSearchSpace`.
 *
 * @since 0.1.0
 * @category combinators
 */
export const omit = Effect.fn("effect-search/SearchSpace.omit")(
  (space: SearchSpaceType, names: ReadonlyArray<string>): Effect.Effect<SearchSpaceType, InvalidSearchSpace> =>
    resolveOmitProjectionNames(space, names).pipe(
      Effect.flatMap((projectedNames) => projectByNames("omit", space, projectedNames))
    )
)
