/**
 * Built-in replacement discipline: Effect collections, Clock/Random, Schema
 * codecs, Record helpers, immutable Array operations and host globals.
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

/**
 * The browser's own objects, for `no-restricted-globals`. Unlike the syntax
 * selectors below this rule is scope-aware: it reports a reference to the
 * global and not a local that happens to share the name, and it leaves type
 * annotations alone. `../scopes.mjs` applies it to shipped code outside
 * `apps/*\/app/web/platform/`, the one place that acquires `window` and
 * `document` and offers them as the `BrowserWindow`/`BrowserDocument`
 * services; the DOM constructors and observers below are properties of that
 * window, so code that needs one at runtime reaches it through the service.
 *
 * The parser's scope analysis records a type parameter declared on a `type`
 * alias as a reference, so a type parameter may not share a name with one of
 * these globals. That is no loss: a type parameter called `Event` or `Node`
 * shadows the DOM type of the same name for every reader.
 */
const windowMember = (name) => ({
  name,
  message:
    `Do not read '${name}' from the global scope. Reach it through the BrowserWindow service from the platform module.`
})

export const BROWSER_GLOBALS = [
  {
    name: "window",
    message: "Do not read 'window'. Use the BrowserWindow service from the platform module."
  },
  {
    name: "document",
    message: "Do not read 'document'. Use the BrowserDocument service from the platform module."
  },
  {
    name: "navigator",
    message: "Do not read 'navigator'. Offer the capability as a service from the platform module."
  },
  ...[
    "location",
    "history",
    "localStorage",
    "sessionStorage",
    "matchMedia",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "ResizeObserver",
    "IntersectionObserver",
    "MutationObserver",
    "Node",
    "Element",
    "HTMLElement",
    "HTMLAnchorElement",
    "HTMLButtonElement",
    "HTMLDivElement",
    "HTMLHeadingElement",
    "HTMLInputElement",
    "HTMLParagraphElement",
    "HTMLSpanElement",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "PointerEvent",
    "KeyboardEvent",
    "TouchEvent",
    "FocusEvent"
  ].map(windowMember)
]

/**
 * Host globals that Effect or `@effect/platform*` already model as services.
 * Web `Request`/`Response` construction is not banned:
 * `HttpServerRequest.fromWeb` and `HttpClientResponse.fromWeb` are Effect's
 * designed interop seam and its own tests build fixtures this way.
 */
export const HOST_GLOBAL_RULES = [
  {
    selector: "Identifier[name='globalThis']",
    message:
      "Do not read 'globalThis'. Provide the capability as an Effect service (@effect/platform, @effect/platform-browser)."
  },
  {
    selector: "NewExpression[callee.name='URL']",
    message: "Do not use 'new URL()'. Use Url.fromString from '@effect/platform'."
  },
  {
    selector: "CallExpression[callee.type='Identifier'][callee.name='fetch']",
    message: "Do not call 'fetch()'. Use HttpClient from '@effect/platform'."
  },
  {
    selector:
      "CallExpression[callee.type='Identifier'][callee.name=/^(setTimeout|setInterval|clearTimeout|clearInterval)$/]",
    message: "Do not use host timers. Use Effect.sleep, Effect.repeat and Schedule from 'effect'."
  },
  {
    selector: "CallExpression[callee.type='Identifier'][callee.name=/^(requestAnimationFrame|cancelAnimationFrame)$/]",
    message: "Do not call requestAnimationFrame directly. Use the AnimationFrame service or Motion's frame scheduler."
  },
  {
    selector: "MemberExpression[object.name='performance']",
    message: "Do not read 'performance'. Use Clock.currentTimeNanos from 'effect'."
  },
  {
    selector: "MemberExpression[object.name='process']",
    message:
      "Do not read 'process'. Use Config for environment, Console for output, Path/import.meta.url for locations, Clock for time and BunRuntime.runMain for exit codes."
  },
  {
    selector: "MemberExpression[object.name='Bun']",
    message: "Do not use the 'Bun' global. Use BunContext, BunHttpServer and BunRuntime from '@effect/platform-bun'."
  },
  {
    selector: "MemberExpression[object.name='crypto']",
    message:
      "Do not use the 'crypto' global. Use @scenesystems/digest for hashing and generateEntropy from @scenesystems/sign for CSPRNG bytes."
  },
  {
    selector: "Identifier[name=/^(localStorage|sessionStorage)$/]",
    message: "Do not use Web Storage directly. Use BrowserKeyValueStore from '@effect/platform-browser'."
  }
]
