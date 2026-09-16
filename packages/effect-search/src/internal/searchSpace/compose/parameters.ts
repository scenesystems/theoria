/** Parameter metadata lookup for search-space composition. */
import { Array as Arr, Equal, type Option } from "effect"

import type { Parameter, SearchSpace } from "../../../SearchSpace.js"

export const knownParameterNames = (space: SearchSpace) => Arr.map(space.params, (parameter) => parameter.name)

export const parameterByName = (
  parameters: Iterable<Parameter>,
  name: string
): Option.Option<Parameter> => Arr.findFirst(parameters, (parameter) => Equal.equals(parameter.name, name))
