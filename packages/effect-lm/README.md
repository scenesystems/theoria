# @scenesystems/effect-lm

Provider-independent model settings and scoped model binding for Effect programs.
Requires Effect 4; contains no providers or optimization algorithms.

## Installation

```sh
bun add @scenesystems/effect-lm effect
```

## Binding model settings

`ModelSettings.merge(base, override)` retains omitted base fields and applies only
defined overrides, including zero. `Role` names task, teacher, proposer, evaluator,
and critic invocations. `ModelBinder.withBinder(binder)` installs a fiber-local
binder; `ModelBinder.bind(request)` applies it without adding a service requirement.
Without a binder, caller-provided language models remain unchanged.

```ts typecheck
import { Effect, Option } from "effect"
import { ModelBinder, ModelIdentity, ModelSettings } from "@scenesystems/effect-lm"

const defaults = new ModelSettings.ModelSettings({ temperature: 0.7, maxTokens: 256 })

const binder = new ModelBinder.Binder({
  bind: (request) => (effect) =>
    effect.pipe(
      Effect.provideService(ModelSettings.Current, ModelSettings.merge(defaults, request.settings)),
      Effect.provideService(
        ModelIdentity.Current,
        Option.some(new ModelIdentity.Identity({ provider: "example", model: "example-model" }))
      )
    )
})

export const resolved = Effect.all({
  settings: ModelSettings.Current,
  identity: ModelIdentity.Current
}).pipe(
  ModelBinder.bind(
    new ModelBinder.Request({
      role: "teacher",
      settings: new ModelSettings.ModelSettings({ temperature: 0 }),
      rolloutId: Option.some(1)
    })
  ),
  ModelBinder.withBinder(binder)
)
```

`resolved` succeeds with `{ temperature: 0, maxTokens: 256 }` and the declared
`example/example-model` identity: the request override wins, including zero, and
the omitted `maxTokens` keeps the binder default.

## Model identity and caching

`ModelIdentity.Current` declares the active provider and model for durable cache
identity. `ModelSettings.Current` exposes settings resolved by the binder;
predictor and invocation overrides take precedence over provider defaults.
Without a declared identity, automatic DSP caches partition native runtime
objects only for the lifetime of the installed DSP cache layer rather than
inventing a provider or model name; closing that layer releases them.
