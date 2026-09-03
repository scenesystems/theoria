/**
 * Built-in replacement discipline: Effect collections, Clock/Random, Schema
 * codecs, Record helpers and immutable Array operations.
 *
 * @module eslint/effect/builtins
 */

export const COLLECTIONS_RULES = [
  {
    selector: "NewExpression[callee.name='Map']",
    message: "Do not use 'new Map()'. Use HashMap from 'effect/HashMap'."
  },
  {
    selector: "NewExpression[callee.name='Set']",
    message: "Do not use 'new Set()'. Use HashSet from 'effect/HashSet'."
  },
  {
    selector: "NewExpression[callee.name='WeakMap']",
    message: "Do not use 'new WeakMap()'. Use HashMap from 'effect/HashMap'."
  },
  {
    selector: "NewExpression[callee.name='WeakSet']",
    message: "Do not use 'new WeakSet()'. Use HashSet from 'effect/HashSet'."
  }
]

export const TIME_RANDOMNESS_RULES = [
  {
    selector: "NewExpression[callee.name='Date']",
    message: "Do not use 'new Date()'. Use Clock.currentTimeMillis from 'effect'."
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "Do not use 'Date.now()'. Use Clock.currentTimeMillis from 'effect'."
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: "Do not use 'Math.random()'. Use Random from 'effect'."
  }
]

export const JSON_BUILTINS_RULES = [
  {
    selector: "CallExpression[callee.object.name='JSON'][callee.property.name='parse']",
    message: "Do not use 'JSON.parse()'. Use Schema.decode or Schema.decodeUnknown."
  },
  {
    selector: "CallExpression[callee.object.name='JSON'][callee.property.name='stringify']",
    message: "Do not use 'JSON.stringify()'. Use Schema.encode."
  }
]

export const OBJECT_BUILTINS_RULES = [
  {
    selector: "CallExpression[callee.object.name='Object'][callee.property.name='entries']",
    message: "Do not use 'Object.entries()'. Use Record.toEntries from 'effect'."
  },
  {
    selector: "CallExpression[callee.object.name='Object'][callee.property.name='keys']",
    message: "Do not use 'Object.keys()'. Use Record.keys from 'effect'."
  },
  {
    selector: "CallExpression[callee.object.name='Object'][callee.property.name='fromEntries']",
    message: "Do not use 'Object.fromEntries()'. Use Record.fromEntries from 'effect'."
  },
  {
    selector: "CallExpression[callee.object.name='Object'][callee.property.name='assign']",
    message: "Do not use 'Object.assign()'. Use object spread or Record.union."
  },
  {
    selector: "CallExpression[callee.object.name='Object'][callee.property.name='create']",
    message: "Do not use 'Object.create()'. Use object literals or Schema.Class."
  },
  {
    selector: "CallExpression[callee.object.name='Object'][callee.property.name='values']",
    message: "Do not use 'Object.values()'. Use Record.values from 'effect'."
  }
]

export const ARRAY_MUTATION_RULES = [
  {
    selector: "CallExpression[callee.property.name='push'] > SpreadElement.arguments",
    message: "Do not use spread in Array.push. Use Arr.appendAll from 'effect'."
  },
  {
    selector: "CallExpression[callee.property.name='push']",
    message: "Do not use Array.push(). Use Arr.append or Arr.appendAll from 'effect'."
  }
]

export const ARRAY_BUILTINS_RULES = [
  {
    selector: "CallExpression[callee.object.name='Array'][callee.property.name='from']",
    message: "Do not use Array.from(). Use Arr.fromIterable from effect/Array."
  },
  {
    selector: "CallExpression[callee.object.name='Array'][callee.property.name='isArray']",
    message: "Do not use Array.isArray(). Use Arr.isArray or Predicate.isArray from effect."
  }
]
