/**
 * Error and logging discipline: tagged error construction, no swallowed
 * failures, and Effect logging instead of console. Type spellings alone do not
 * distinguish global Error from a concern-owned Schema-derived Error union.
 *
 * @module eslint/effect/errors
 */

export const NO_NEW_ERROR_RULES = [
  {
    selector: "NewExpression[callee.name='Error']",
    message: "Do not use 'new Error()'. Use Data.TaggedError or Schema.TaggedError for typed errors."
  },
  {
    selector: "NewExpression[callee.name='TypeError']",
    message: "Do not use 'new TypeError()'. Use Data.TaggedError or Schema.TaggedError."
  },
  {
    selector: "NewExpression[callee.name='RangeError']",
    message: "Do not use 'new RangeError()'. Use Data.TaggedError or Schema.TaggedError."
  }
]

export const ERROR_SWALLOWING_RULES = [
  {
    selector:
      "CallExpression[callee.property.name='catchAll'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Literal[value=null]",
    message:
      "Do not swallow errors with Effect.catchAll(() => Effect.succeed(null)). Use Option.none() or handle explicitly."
  },
  {
    selector:
      "CallExpression[callee.property.name='catchAll'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Identifier[name='undefined']",
    message: "Do not swallow errors with Effect.catchAll(() => Effect.succeed(undefined))."
  },
  {
    selector:
      "CallExpression[callee.property.name='catchTag'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Literal[value=null]",
    message: "Do not swallow errors with Effect.catchTag(() => Effect.succeed(null))."
  },
  {
    selector:
      "CallExpression[callee.property.name='catchTag'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] Identifier[name='undefined']",
    message: "Do not swallow errors with Effect.catchTag(() => Effect.succeed(undefined))."
  },
  {
    selector:
      "CallExpression[callee.property.name='catchAll'] ArrowFunctionExpression CallExpression[callee.object.name='Effect'][callee.property.name='succeed'] ArrayExpression[elements.length=0]",
    message: "Do not swallow errors with Effect.catchAll(() => Effect.succeed([]))."
  },
  {
    selector: "Property[key.name='catch'] > ArrowFunctionExpression[body.type='Literal'][body.value=null]",
    message: "Do not swallow errors with catch: () => null. Return typed error instead."
  },
  {
    selector: "Property[key.name='catch'] > ArrowFunctionExpression[body.type='Identifier'][body.name='undefined']",
    message: "Do not swallow errors with catch: () => undefined. Return typed error instead."
  },
  {
    selector:
      "Property[key.name='catch'] > ArrowFunctionExpression[body.type='Identifier'][body.name=/^e$|^err$|^error$/]",
    message: "Do not use catch: (e) => e. Wrap in typed error: new MyError({ cause: e })."
  }
]

export const NO_CONSOLE_RULES = [
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='log']",
    message: "Do not use 'console.log()'. Use Effect.log() instead."
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='error']",
    message: "Do not use 'console.error()'. Use Effect.logError() instead."
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='warn']",
    message: "Do not use 'console.warn()'. Use Effect.logWarning() instead."
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='time']",
    message: "Do not use 'console.time()'. Use Effect.withSpan() instead."
  },
  {
    selector: "CallExpression[callee.object.name='console'][callee.property.name='timeEnd']",
    message: "Do not use 'console.timeEnd()'. Use Effect.withSpan() instead."
  }
]

export const NO_LOG_INTERPOLATION_RULES = ["log", "logError", "logWarning", "logDebug", "logFatal"].map((method) => ({
  selector: `CallExpression[callee.object.name='Effect'][callee.property.name='${method}'] > TemplateLiteral`,
  message: "Do not use template literals in Effect.log*(). Use Effect.annotateLogs() for structured metadata."
}))
