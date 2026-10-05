"""Delegate-only observations of all three MIPRO phases."""

from unittest.mock import patch

import dspy
from dspy.teleprompt import mipro_optimizer_v2 as upstream
from dspy.utils import DummyLM

from ._common import examples, history, lm, splits, state


class ObservedMIPRO(dspy.MIPROv2):
    def _bootstrap_fewshot_examples(self, *args, **kwargs):
        value = super()._bootstrap_fewshot_examples(*args, **kwargs)
        self.demo_sets = {i: [[e.toDict() for e in demos] for demos in sets] for i, sets in value.items()}
        return value

    def _propose_instructions(self, *args, **kwargs):
        value = super()._propose_instructions(*args, **kwargs)
        self.instructions = value
        return value

    def _select_and_insert_instructions_and_demos(self, *args, **kwargs):
        value = super()._select_and_insert_instructions_and_demos(*args, **kwargs)
        trial = args[3]
        self.current_trial = trial.number
        self.params.append({"number": trial.number, "params": dict(trial.params)})
        return value


def run(auto, discriminator=False):
    train, val = examples("train", 4), examples("val", 6)
    task = lm()
    proposer = DummyLM([{"proposed_instruction": f"candidate-{i}"} for i in range(100)])
    program = dspy.Predict("question -> answer")
    program.signature = program.signature.with_instructions("baseline")
    optimizer = ObservedMIPRO(
        metric=lambda e, p, trace=None: 0.8,
        prompt_model=proposer, task_model=task, auto=auto,
        num_candidates=3 if auto is None else None,
        max_bootstrapped_demos=1, max_labeled_demos=1,
        num_threads=1, seed=9,
    )
    optimizer.params = []
    optimizer.current_trial = None
    evaluations = []
    proposer_rollouts = []
    real_copy = proposer.copy

    def observed_copy(**kwargs):
        copied = real_copy(**kwargs)
        proposer_rollouts.append(copied)
        return copied

    real_evaluate = upstream.eval_candidate_program

    def observed_evaluate(batch_size, dataset, candidate, evaluate, rng=None):
        # Observe membership at the Evaluate boundary; no extra RNG draws.
        def evaluate_batch(p, devset, **kwargs):
            instruction = p.predictors()[0].signature.instructions
            def metric(e, prediction, trace=None):
                if not discriminator or instruction == "baseline":
                    return 0.8
                # A specialist can win a minibatch yet lose on full validation.
                return 1.0 if e.id in ("val-0", "val-1", "val-2") else 0.0
            result = evaluate(p, devset=devset, metric=metric, **kwargs)
            evaluations.append({"trial": optimizer.current_trial, "ids": [e.id for e in devset],
                                "fullValidation": len(devset) == len(dataset),
                                "instruction": instruction, "score": result.score / 100,
                                "state": state(p)})
            return result
        return real_evaluate(batch_size, dataset, candidate, evaluate_batch, rng)

    with (dspy.context(lm=task), patch.object(upstream, "eval_candidate_program", observed_evaluate),
          patch.object(proposer, "copy", observed_copy)):
        compiled = optimizer.compile(
            program, trainset=train, valset=val, num_trials=12 if auto is None else None,
            minibatch=True, minibatch_size=1, minibatch_full_eval_steps=2,
            program_aware_proposer=False, data_aware_proposer=False,
            tip_aware_proposer=False, fewshot_aware_proposer=False,
        )
    return {"auto": auto, "seed": 9, "splits": splits(train, val),
            "demoSets": optimizer.demo_sets, "instructions": optimizer.instructions,
            "trials": optimizer.params, "evaluations": evaluations,
            "trialLogs": {number: {key: state(value) if isinstance(value, dspy.Module) else value
                                   for key, value in log.items() if not key.endswith("_path")}
                          for number, log in compiled.trial_logs.items()},
            "trialCount": len(optimizer.params), "bestFullValidationScore": compiled.score / 100,
            "state": state(compiled), "taskHistory": history(task),
            "proposerHistory": [entry for model in proposer_rollouts for entry in history(model)]}


def generate():
    docs = []
    for auto in ["light", "medium", "heavy", None]:
        payload = run(auto, discriminator=auto is None)
        name = "mipro-trial-budget-001" if auto == "light" else f"miprov2-{auto or 'explicit'}-001"
        docs.append({"id": name, "description": "Real MIPRO compile phases, Optuna params and validation checkpoints.",
                     "payload": payload})
        if auto is None:
            assert max(e["score"] for e in payload["evaluations"] if not e["fullValidation"]) > payload["bestFullValidationScore"]
            assert payload["state"]["signature"]["instructions"] == "baseline"
            docs.append({"id": "mipro-best-fullval-001",
                         "description": "A minibatch specialist loses to the baseline full-validation checkpoint.",
                         "payload": payload})
    return docs
