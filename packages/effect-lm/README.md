# @scenesystems/effect-lm

LM defines generation settings and model binding for Effect programs. Use it
when building an integration that needs to select a model or apply settings for
an invocation. A request names its role, such as `task` or `teacher`, so the
application can choose a model without putting provider configuration in the
calling code.

For hosted model calls, start with
[`effect-inference`](../effect-inference/README.md#model-binding-by-role), which
implements this binding contract. [`effect-dsp`](../effect-dsp/README.md) uses it
to request models during prediction and optimization.

## Installation

```sh
bun add @scenesystems/effect-lm effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package
root or matching subpaths, such as `@scenesystems/effect-lm/ModelSettings`.

## Basic use

Combine application defaults with the settings for a particular request:

```ts typecheck
import { ModelSettings } from "@scenesystems/effect-lm"

const defaults = new ModelSettings.ModelSettings({ temperature: 0.7, maxTokens: 256 })
const request = new ModelSettings.ModelSettings({ temperature: 0 })

export const settings = ModelSettings.merge(defaults, request)
```

The result has temperature `0` and a token limit of `256`. Omitted fields keep
their default values; zero and an empty stop list are explicit overrides.
These settings describe an invocation. A binder must apply them to the provider
that will execute it.

## Bind a model invocation

Wrap an Effect with `ModelBinder.bind(request)` to pass its role, settings and
optional rollout identity to the current binder. Install your binder around the
program with `ModelBinder.withBinder`. Without one, `bind` leaves the wrapped
Effect unchanged.

A custom [`ModelBinder.Binder`](./src/ModelBinder.ts) applies configuration within
the wrapped Effect's scope and preserves its error and service channels. It can
select a model by role and expose resolved settings through
`ModelSettings.Current`. Use Inference's
[`ModelBinder.layer`](../effect-inference/README.md#model-binding-by-role) for
hosted providers; its documentation covers role fallback, setting precedence and
unsupported settings.

Declare the selected provider and model through
[`ModelIdentity.Current`](./src/ModelIdentity.ts) when consumers need that identity,
for example to reuse cached results across runs. DSP's
[cache documentation](../effect-dsp/README.md#traces-payloads-and-cache) describes
the requirements for durable reuse.

## Examples

See the [API reference](./src/index.ts) for the public contracts. The
[binding example](./examples/binding.ts) logs a request through an
application-supplied binder. Run it from a repository checkout with
`bun packages/effect-lm/examples/binding.ts`; it needs no provider credentials.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples)
when choosing a package version.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
