/** Scoped generation settings with an application-supplied binder. */
import { BunRuntime } from "@effect/platform-bun"
import { ModelBinder, ModelSettings } from "@scenesystems/effect-lm"
import { Effect, Option } from "effect"

const settings = ModelSettings.merge(
  new ModelSettings.ModelSettings({ temperature: 0.7, maxTokens: 73 }),
  new ModelSettings.ModelSettings({ temperature: 0 })
)
const binder = new ModelBinder.Binder({
  bind: (request) => (effect) => Effect.log(request.role, request.settings).pipe(Effect.andThen(effect))
})

BunRuntime.runMain(
  Effect.log("model operation").pipe(
    ModelBinder.bind(new ModelBinder.Request({ role: "teacher", settings, rolloutId: Option.some(1) })),
    ModelBinder.withBinder(binder)
  )
)
