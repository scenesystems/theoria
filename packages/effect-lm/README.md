# @scenesystems/effect-lm

Provider-independent model settings and scoped model binding for Effect programs.
Requires Effect 4; contains no providers or optimization algorithms.

`ModelSettings.merge(base, override)` retains omitted base fields and applies only
defined overrides, including zero. `Role` names task, teacher, proposer, evaluator,
and critic invocations. `ModelBinder.withBinder(binder)` installs a fiber-local
binder; `ModelBinder.bind(request)` applies it without adding a service requirement.
Without a binder, caller-provided language models remain unchanged.
