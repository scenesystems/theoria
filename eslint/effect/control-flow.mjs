/**
 * Control-flow discipline: async/await, promises, throw/try, mutable bindings,
 * imperative loops, switch, runtime entry points and cancellation.
 *
 * @module eslint/effect/control-flow
 */

export const NO_ASYNC_RULES = [
  {
    selector: "FunctionDeclaration[async=true]",
    message: "Do not use async functions. Use Effect.gen with yield* and Effect.tryPromise."
  },
  {
    selector: "FunctionExpression[async=true]",
    message: "Do not use async functions. Use Effect.gen with yield* and Effect.tryPromise."
  },
  {
    selector: "ArrowFunctionExpression[async=true]",
    message: "Do not use async arrow functions. Use Effect.gen with yield* and Effect.tryPromise."
  },
  {
    selector: "NewExpression[callee.name='Promise']",
    message: "Do not use 'new Promise()'. Use Effect.tryPromise instead."
  },
  {
    selector: "CallExpression[callee.object.name='Promise'][callee.property.name='resolve']",
    message: "Do not use 'Promise.resolve()'. Use Effect.succeed instead."
  },
  {
    selector: "CallExpression[callee.object.name='Promise'][callee.property.name='reject']",
    message: "Do not use 'Promise.reject()'. Use yield* new MyError() with Schema.TaggedError."
  },
  {
    selector: "CallExpression[callee.object.name='Promise'][callee.property.name='all']",
    message: "Do not use 'Promise.all()'. Use Effect.all instead."
  },
  {
    selector: "CallExpression[callee.object.name='Promise'][callee.property.name='race']",
    message: "Do not use 'Promise.race()'. Use Effect.raceAll instead."
  },
  {
    selector: "CallExpression[callee.object.name='Promise'][callee.property.name='allSettled']",
    message: "Do not use 'Promise.allSettled()'. Use Effect.forEach + Effect.either instead."
  },
  {
    selector: "CallExpression[callee.object.name='Promise'][callee.property.name='any']",
    message: "Do not use 'Promise.any()'. Use Effect.raceAll instead."
  },
  { selector: "AwaitExpression", message: "Do not use 'await'. Use Effect.gen with yield* for async operations." }
]

export const PROMISE_CHAINING_RULES = [
  {
    selector: "CallExpression[callee.property.name='then']",
    message: "Do not use '.then()'. Use Effect.map or Effect.andThen."
  },
  {
    selector: "CallExpression[callee.property.name='catch'][callee.object.type!='Identifier']",
    message: "Do not use '.catch()'. Use Effect.catchAll or Effect.catchTag."
  },
  {
    selector: "CallExpression[callee.property.name='finally']",
    message: "Do not use '.finally()'. Use Effect.ensuring."
  }
]

export const NO_THROW_TRY_RULES = [
  {
    selector: "ThrowStatement",
    message:
      "Do not use 'throw'. Use yield* new MyError() with Data.TaggedError or Schema.TaggedError. For defects: Effect.die()."
  },
  {
    selector: "TryStatement",
    message: "Do not use try/catch. Use Effect.tryPromise with a catch handler or Effect.catchTag/catchTags."
  }
]

export const NO_LET_RULES = [
  {
    selector: "VariableDeclaration[kind='let']",
    message: "Do not use 'let'. Use 'const' for bindings. For mutable state, use Ref from 'effect'."
  }
]

export const IMPERATIVE_LOOP_RULES = [
  { selector: "ForStatement", message: "Do not use 'for' loops. Use Arr.map, Arr.filter, Effect.forEach, or pipe." },
  { selector: "ForInStatement", message: "Do not use 'for...in'. Use Record.toEntries or Record.keys from 'effect'." },
  { selector: "ForOfStatement", message: "Do not use 'for...of'. Use Arr.map, Arr.forEach, or Effect.forEach." },
  { selector: "WhileStatement", message: "Do not use 'while'. Use Effect.iterate or Effect.loop." },
  { selector: "DoWhileStatement", message: "Do not use 'do...while'. Use Effect.iterate or Effect.loop." }
]

export const SWITCH_STATEMENT_RULES = [
  {
    selector: "SwitchStatement",
    message: "Do not use switch statements. Use Match.type<T>().pipe(Match.tag(...), Match.exhaustive) from effect."
  }
]

export const ENTRY_POINT_RULES = [
  {
    selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runPromise']",
    message: "Do not use 'Effect.runPromise' in library code. Use Runtime.runMain at the entry point."
  },
  {
    selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runSync']",
    message: "Do not use 'Effect.runSync' in library code. Use Runtime.runMain at the entry point."
  },
  {
    selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runFork']",
    message: "Do not use 'Effect.runFork' in library code. Use Runtime.runMain at the entry point."
  },
  {
    selector: "CallExpression[callee.object.name='Effect'][callee.property.name='runPromiseExit']",
    message: "Do not use 'Effect.runPromiseExit' in library code. Use Runtime.runMain at the entry point."
  }
]

export const ABORT_CONTROLLER_RULES = [
  {
    selector: "NewExpression[callee.name='AbortController']",
    message: "Do not use 'new AbortController()'. Use Effect.interrupt or Fiber.interrupt."
  }
]
