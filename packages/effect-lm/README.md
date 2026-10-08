# @scenesystems/effect-lm

Use model binding when parts of an Effect program need different language models
or generation settings. A binder applies settings and model identity within an
invocation's scope. For hosted providers, use
[`effect-inference`](../effect-inference/README.md#model-binding-by-role).

## Installation

```sh
bun add @scenesystems/effect-lm effect
```

Requires Effect `^4.0.0` as a peer dependency.

## Binding model settings

`ModelBinder.withBinder` installs a binder for the current fiber;
`ModelBinder.bind` applies it to an invocation. Requests carry a role such as
`task` or `teacher`, optional settings, and a rollout identity. Without a binder,
the caller's language model remains unchanged.

This binder merges a request's settings with defaults and declares the model
identity. `ModelSettings.merge` preserves omitted defaults and accepts zero as
an override.

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

## Model identity

`ModelIdentity.Current` declares the active provider and model;
`ModelSettings.Current` exposes the resolved settings. Declare an identity when
results should be reusable across runs. DSP's [cache documentation](../effect-dsp/README.md#traces-payloads-and-cache)
describes how these values affect reuse.
