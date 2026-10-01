/**
 * Merges two search spaces into one by combining their schemas, dimensions, and parameter metadata with conflict detection.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, HashMap, Option, Schema } from "effect"

import type { InvalidSearchSpace } from "../../../SearchError.js"
import { SearchSpace } from "../../../SearchSpace.js"
import { invalidSearchSpace } from "../failure.js"
import { ensureUniqueParameterNames } from "../validation.js"
import { parameterByName } from "./parameters.js"

const extendFailure = (reason: string, dimension?: string): InvalidSearchSpace =>
  invalidSearchSpace(`SearchSpace.extend: ${reason}`, dimension)

/**
 * Merges two non-overlapping search spaces into one by combining their schemas, dimensions, and metadata.
 *
 * @since 0.1.0
 * @category combinators
 */
export const extendSpace = (
  left: SearchSpace,
  right: SearchSpace
): Effect.Effect<SearchSpace, InvalidSearchSpace> =>
  Effect.gen(function*() {
    const conflict = Arr.findFirst(
      left.params,
      (parameter) =>
        Option.isSome(
          parameterByName(right.params, parameter.name)
        )
    )

    yield* Option.match(conflict, {
      onNone: () => Effect.void,
      onSome: (parameter) =>
        Effect.fail(extendFailure(`cannot extend spaces with duplicate parameter "${parameter.name}"`, parameter.name))
    })

    const schema = yield* Effect.try({
      try: () => Schema.extend(left.schema, right.schema),
      catch: () => extendFailure("schema extension failed")
    })
    const params = yield* ensureUniqueParameterNames(Arr.appendAll(left.params, right.params))

    return new SearchSpace({
      schema,
      dimensions: HashMap.union(left.dimensions, right.dimensions),
      params
    })
  })
