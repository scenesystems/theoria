/**
 * Scoped model binding without additional service requirements.
 * @since 0.1.0
 * @module
 */
import type { Option } from "effect"
import { Context, Data, Effect } from "effect"
import type { ModelSettings } from "./ModelSettings.js"
import type { Role } from "./Role.js"

/** Effective configuration for one model invocation. @since 0.1.0 @category models */
export class Request extends Data.Class<{
  readonly role: Role
  readonly settings: ModelSettings
  readonly rolloutId: Option.Option<number>
}> {}

/** Applies model configuration within the wrapped effect. @since 0.1.0 @category models */
export class Binder extends Data.Class<{
  readonly bind: (request: Request) => <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}> {}

/** Leaves caller-provided models unchanged. @since 0.1.0 @category constants */
export const identity = new Binder({ bind: () => (effect) => effect })

/** Fiber-local binder, with no binding required by default. @since 0.1.0 @category references */
export const Current = Context.Reference<Binder>("@scenesystems/effect-lm/ModelBinder/Current", {
  defaultValue: () => identity
})

/** Installs a binder for the duration of an effect. @since 0.1.0 @category combinators */
export const withBinder = (binder: Binder) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.provideService(effect, Current, binder)

/** Applies the current binder to a model invocation. @since 0.1.0 @category combinators */
export const bind = (request: Request) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.flatMap(Current, (binder) => binder.bind(request)(effect))
