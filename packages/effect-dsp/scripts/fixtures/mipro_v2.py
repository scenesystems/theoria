"""Delegate-only observations of all three MIPRO phases."""

from pathlib import Path
import runpy
from unittest.mock import patch

import dspy
import numpy
# Resolve DSPy's lazy NumPy import before Optuna imports its submodules.
numpy.__version__
import optuna
from dspy.teleprompt import mipro_optimizer_v2 as upstream
from dspy.utils import DummyLM

from ._common import examples, history, lm, splits, state

# The Optuna corpus owns the passive acquisition observer; DSPy runs use it too.
ObservedTPE = runpy.run_path(Path(__file__).resolve().parents[3] /
                            "effect-search/scripts/fixtures/mipro_kernel.py")["ObservedTPE"]


class ObservedMIPRO(dspy.MIPROv2):
    def _bootstrap_fewshot_examples(self, *args, **kwargs):
        self.bootstrap_active = True
        start = len(self.task_model.history)
        value = super()._bootstrap_fewshot_examples(*args, **kwargs)
        self.bootstrap_active = False
        self.bootstrap_calls = len(self.task_model.history) - start
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


def run(auto, discriminator=False, max_bootstrapped_demos=1, max_labeled_demos=1,
        minibatch=True, expect_error=False, val_size=6, full_eval_steps=2):
    train, val = examples("train", 4), examples("val", val_size)
    task = lm()
    proposer = DummyLM([{"proposed_instruction": f"candidate-{i}"} for i in range(100)])
    program = dspy.Predict("question -> answer")
    program.signature = program.signature.with_instructions("baseline")
    bootstrap_metrics = []

    def metric(e, p, trace=None):
        if getattr(optimizer, "bootstrap_active", False):
            bootstrap_metrics.append(e.id)
        return 0.8

    optimizer = ObservedMIPRO(
        metric=metric,
        prompt_model=proposer, task_model=task, auto=auto,
        num_candidates=3 if auto is None else None,
        max_bootstrapped_demos=max_bootstrapped_demos, max_labeled_demos=max_labeled_demos,
        num_threads=1, seed=9,
    )
    optimizer.params = []
    optimizer.current_trial = None
    evaluations = []
    proposer_rollouts = []
    studies = []
    real_create_study = optuna.create_study
    real_copy = proposer.copy

    def observed_study(*args, **kwargs):
        study = real_create_study(*args, **kwargs)
        studies.append(study)
        return study

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

    error = None
    with (dspy.context(lm=task), patch.object(upstream, "eval_candidate_program", observed_evaluate),
          patch.object(proposer, "copy", observed_copy),
          patch.object(optuna.samplers, "TPESampler", ObservedTPE),
          patch.object(optuna, "create_study", observed_study)):
        try:
            compiled = optimizer.compile(
                program, trainset=train, valset=val, num_trials=12 if auto is None else None,
                minibatch=minibatch, minibatch_size=1, minibatch_full_eval_steps=full_eval_steps,
                program_aware_proposer=False, data_aware_proposer=False,
                tip_aware_proposer=False, fewshot_aware_proposer=False,
            )
        except ValueError as failure:
            if not expect_error or str(failure) != "No valid program found in param_score_dict":
                raise
            error = str(failure)
    assert (error is not None) == expect_error
    study = studies[0]
    trajectory = {
        "numTrials": 12 if auto is None else len(optimizer.params),
        "minibatch": minibatch if auto is None else val_size > upstream.MIN_MINIBATCH_SIZE,
        "minibatchSize": 1, "minibatchFullEvalSteps": full_eval_steps,
        "strictThroughTrial": study.sampler.strict_through(study.trials[-1].number),
        "acquisitionGaps": study.sampler.acquisition_gaps,
        "trialTable": [{"number": trial.number, "params": trial.params,
                        "value": trial.value / 100 if trial.value is not None else None,
                        "state": trial.state.name,
                        "fullValidation": evaluations[trial.number]["fullValidation"]}
                       for trial in study.trials],
    }
    if error:
        return {**trajectory, "error": error, "seed": 9, "splits": splits(train, val),
                "maxBootstrappedDemos": max_bootstrapped_demos, "maxLabeledDemos": max_labeled_demos,
                "trials": optimizer.params, "evaluations": evaluations}
    return {"auto": auto, "seed": 9, "splits": splits(train, val),
            **trajectory,
            "maxBootstrappedDemos": max_bootstrapped_demos, "maxLabeledDemos": max_labeled_demos,
            "bootstrapCalls": optimizer.bootstrap_calls, "bootstrapMetricIds": bootstrap_metrics,
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
        name = "mipro-trial-budget" if auto == "light" else f"miprov2-{auto or 'explicit'}"
        docs.append({"id": name, "description": "Real MIPRO compile phases, Optuna params and validation checkpoints.",
                     "payload": payload})
        if auto is None:
            assert max(e["score"] for e in payload["evaluations"] if not e["fullValidation"]) > payload["bestFullValidationScore"]
            assert payload["state"]["signature"]["instructions"] == "baseline"
            docs.append({"id": "mipro-best-fullval",
                         "description": "A minibatch specialist loses to the baseline full-validation checkpoint.",
                         "payload": payload})
    for name, cap in [("miprov2-no-labels", 2), ("miprov2-zero-shot", 0)]:
        payload = run(None, max_bootstrapped_demos=cap, max_labeled_demos=0, minibatch=False)
        assert payload["bootstrapCalls"] > 0
        assert payload["bootstrapMetricIds"]
        if cap == 0:
            assert all(not any("demo" in key for key in trial["params"]) for trial in payload["trials"])
        docs.append({"id": name,
                     "description": "Real MIPRO compile with unlabeled-only bootstrap catalog and shared RNG; zero caps retain proposer evidence but remove demo search.",
                     "payload": payload})
    docs.append({"id": "miprov2-exhausted-full-eval",
                 "description": "Three instruction candidates exhaust all not-yet-fully-evaluated combinations during twelve minibatch trials.",
                 "payload": run(None, max_bootstrapped_demos=0, max_labeled_demos=0, expect_error=True)})
    docs.append({"id": "miprov2-auto-minibatch",
                 "description": "Auto light enables minibatching above 50 validation rows and inserts full checkpoints at the default five-trial cadence.",
                 "payload": run("light", val_size=51, full_eval_steps=5)})
    for doc in docs:
        payload = doc["payload"]
        doc["trajectory"] = {
            "sampledTrials": len(payload["trials"]),
            "minibatch": payload["minibatch"], "valsetSize": len(payload["splits"]["val"]),
            "sampledEvaluation": "minibatch" if payload["minibatch"] else "fullValidation",
            "insertedFullEvaluations": len(payload["trialTable"]) - len(payload["trials"]) - 1,
            "baselineTrials": 1, "totalStudyRows": len(payload["trialTable"]),
            "strictThroughTrial": payload["strictThroughTrial"],
            "firstInadmissibleTie": next((gap for gap in payload["acquisitionGaps"]
                                          if gap["tie"] and gap["tie"]["classification"] != "identicalInputs"), None),
        }
    return docs
