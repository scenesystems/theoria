"""Additive evidence captures: copied-teacher calls and a default-grounded MIPRO compile.

Existing payloads are never rewritten. New entries record the interpreter environment that
actually produced them; legacy entries carry no per-entry environment claim.
"""

import importlib.metadata
import os
import platform
import re
from unittest.mock import patch

import dspy
import optuna
from dspy.teleprompt import mipro_optimizer_v2 as upstream
from dspy.utils import DummyLM

from ._common import examples, history, lm, splits, state
from .bootstrap_family import TwoStage, lettered
from .mipro_proposer import QuestionAnswering
from .mipro_v2 import ObservedMIPRO, ObservedTPE

# Keys the generator itself fixes before importing NumPy-backed code; read, never assumed.
ENVIRONMENT_KEYS = ("PYTHONHASHSEED", "NPY_DISABLE_CPU_FEATURES")


def environment():
    return {key: os.environ[key] for key in ENVIRONMENT_KEYS}


def runtime():
    return {"python": platform.python_version(), "dspy": dspy.__version__,
            "numpy": importlib.metadata.version("numpy"), "optuna": optuna.__version__, **environment()}


def labelled_calls(calls, clients):
    """Attach which LM object served each recorded call; copies are neither original."""
    return [{**call, "client": next((name for name, client in clients if client is call["client"]), "copy")}
            for call in calls]


def every_lm_call_with_client():
    """every_lm_call plus the serving client identity, so copies made by deepcopy/copy() are visible."""
    from dspy.clients import base_lm
    original = base_lm.record_history

    class Capture:
        def __enter__(self):
            self.calls = []

            def record(client, entry):
                kwargs = {**client.kwargs, **entry["kwargs"]}
                self.calls.append({"client": client, "messages": entry["messages"],
                                   "kwargs": {**{k: kwargs.get(k) for k in ("temperature", "max_tokens", "rollout_id")},
                                              "model": entry["model"]},
                                   "response": entry["outputs"]})
                return original(client, entry)

            base_lm.record_history = record
            return self.calls

        def __exit__(self, *exc):
            base_lm.record_history = original
            return False

    return Capture()


def teacher_trace_calls():
    """Re-execute bootstrap-teacher-trace-001's configuration with every LM call captured.

    The original payload records history(model) of the LM bound to the caller's teacher; compile
    deep-copies that teacher (and its LM), so the original history is empty. This capture records
    the deep-copied teacher LM's actual calls without changing the original payload.
    """
    train = examples("train", 4)
    model, student_model = lm(), lm("student")
    program, teacher_program = TwoStage(), TwoStage()
    teacher_program.set_lm(model)
    metric_calls = []

    def metric(e, p, trace=None):
        metric_calls.append({"id": e.id})
        return 0.4 if e.id == "train-0" else 0.8

    with every_lm_call_with_client() as calls, dspy.context(lm=student_model):
        compiled = dspy.BootstrapFewShot(metric=metric, max_bootstrapped_demos=2, max_labeled_demos=0,
                                         max_rounds=1, max_errors=1,
                                         ).compile(program, teacher=teacher_program, trainset=train)
    recorded = labelled_calls(calls, [("teacher-original", model), ("student", student_model)])
    assert recorded and all(call["client"] == "copy" for call in recorded)
    assert history(model) == [] and history(student_model) == []
    return {"id": "bootstrap-teacher-trace-calls-001", "environment": environment(),
            "description": "Deep-copied teacher LM calls for bootstrap-teacher-trace-001's configuration; "
                           "original teacher and student histories stay empty.",
            "payload": {"runtime": runtime(), "captures": "bootstrap-teacher-trace-001",
                        "splits": splits(train), "metricCalls": metric_calls,
                        "history": recorded,
                        "originalTeacherHistory": history(model), "studentHistory": history(student_model),
                        "state": state(compiled)}}


def teacher_settings():
    """BootstrapFewShot(teacher_settings={"lm": ...}) with a deep-copied explicit teacher program.

    Round 0 calls the teacher-settings LM itself; round 1 calls its copy(rollout_id=1, temperature=1.0).
    The caller's task LM (the student context) is never called.
    """
    train = lettered("a", "b", "c")
    student_model = lm("student")
    teacher_model = lm("teacher", temperature=0.83, max_tokens=211)
    program, teacher_program = TwoStage(), TwoStage()
    attempts, metric_calls = {}, []

    def reject_a_once(e, p, trace=None):
        attempts[e.id] = attempts.get(e.id, 0) + 1
        metric_calls.append({"id": e.id, "attempt": attempts[e.id], "prediction": p.toDict()})
        return not (e.id == "a" and attempts[e.id] == 1)

    with every_lm_call_with_client() as calls, dspy.context(lm=student_model):
        compiled = dspy.BootstrapFewShot(metric=reject_a_once, teacher_settings={"lm": teacher_model},
                                         max_bootstrapped_demos=2, max_labeled_demos=0, max_rounds=2,
                                         ).compile(program, teacher=teacher_program, trainset=train)
    recorded = labelled_calls(calls, [("teacher-settings", teacher_model), ("student", student_model)])
    assert history(student_model) == []
    assert {call["client"] for call in recorded} == {"teacher-settings", "copy"}
    assert all(p.lm is None for p in teacher_program.predictors())
    return {"id": "bootstrapfewshot-teacher-settings-001", "environment": environment(),
            "description": "teacher_settings LM serves the deep-copied teacher; retry rounds use its rollout copy "
                           "at temperature 1.0 and the student LM records no calls.",
            "payload": {"runtime": runtime(), "splits": splits(train),
                        "teacherSettings": {"temperature": teacher_model.kwargs["temperature"],
                                            "max_tokens": teacher_model.kwargs["max_tokens"]},
                        "studentSettings": {"temperature": student_model.kwargs["temperature"],
                                            "max_tokens": student_model.kwargs["max_tokens"]},
                        "maxBootstrappedDemos": 2, "maxLabeledDemos": 0, "maxRounds": 2,
                        "metricCalls": metric_calls,
                        "history": recorded,
                        "studentHistory": history(student_model), "state": state(compiled)}}


FIELD = re.compile(r"starting with the field `\[\[ ## (\w+) ## \]\]`")


def default_grounded():
    """One MIPROv2.compile with every constructor and compile default except num_threads=1.

    num_threads=1 fixes evaluation order only (DSPy settings default 8 threads); Theoria's default
    evaluator concurrency is also one. Proposer answers are a pure function of the requested field
    and call count; the task LM answers "best" exactly when a proposed instruction is in its prompt.
    """
    train, val = examples("train", 4), examples("val", 6)
    proposer_calls = []

    class Proposer(DummyLM):
        def __call__(self, prompt=None, messages=None, **kwargs):
            field = FIELD.search(messages[-1]["content"])[1]
            rollout = self.kwargs.get("rollout_id")
            response = f"instruction-{rollout}" if field == "proposed_instruction" else f"{field}-{len(proposer_calls)}"
            self.answers = iter([{field: response}])
            result = super().__call__(prompt=prompt, messages=messages, **kwargs)
            user = messages[-1]["content"]
            task_demos = re.search(r"\[\[ ## task_demos ## \]\]\n(.*?)\n\n\[\[", user, re.S)
            tip = re.search(r"\[\[ ## tip ## \]\]\n(.*?)\n\n", user, re.S)
            entry = history(self)[-1]
            proposer_calls.append({"field": field, "role": "proposer", "rolloutId": rollout,
                                   "temperature": entry["kwargs"]["temperature"], "response": response,
                                   "demoQuestions": re.findall(r"Question: (\S+)", task_demos[1]) if task_demos else [],
                                   "dataIds": re.findall(r"'question': '(train-\d+)'", user),
                                   "tip": tip[1] if tip else None})
            return result

    class Task(DummyLM):
        def __call__(self, prompt=None, messages=None, **kwargs):
            proposed = "instruction-" in messages[0]["content"]
            self.answers = iter([{"answer": "best" if proposed else "teacher"}])
            return super().__call__(prompt=prompt, messages=messages, **kwargs)

    task = Task([])
    task.kwargs.update(temperature=0.17, max_tokens=73)
    proposer = Proposer([])
    program = QuestionAnswering()

    def metric(e, p, trace=None):
        return 1.0 if p.answer == "best" else 0.5

    optimizer = ObservedMIPRO(metric=metric, prompt_model=proposer, task_model=task, num_threads=1)
    optimizer.params, optimizer.current_trial = [], None
    evaluations, studies = [], []
    real_create_study, real_evaluate = optuna.create_study, upstream.eval_candidate_program

    def observed_study(*args, **kwargs):
        studies.append(real_create_study(*args, **kwargs))
        return studies[-1]

    def observed_evaluate(batch_size, dataset, candidate, evaluate, rng=None):
        def evaluate_batch(p, devset, **kwargs):
            result = evaluate(p, devset=devset, **kwargs)
            evaluations.append({"trial": optimizer.current_trial, "ids": [e.id for e in devset],
                                "fullValidation": len(devset) == len(dataset),
                                "instruction": p.predictors()[0].signature.instructions,
                                "score": result.score / 100, "state": state(p)})
            return result
        return real_evaluate(batch_size, dataset, candidate, evaluate_batch, rng)

    with (dspy.context(lm=task), patch.object(upstream, "eval_candidate_program", observed_evaluate),
          patch.object(optuna.samplers, "TPESampler", ObservedTPE),
          patch.object(optuna, "create_study", observed_study)):
        compiled = optimizer.compile(program, trainset=train, valset=val)
    study = studies[0]
    assert {call["field"] for call in proposer_calls} >= {"observations", "summary", "program_description",
                                                         "module_description", "proposed_instruction"}
    assert any(call["tip"] for call in proposer_calls) and any(call["demoQuestions"] for call in proposer_calls)
    assert compiled.score / 100 == 1.0
    payload = {
        "runtime": runtime(), "seed": optimizer.seed, "auto": optimizer.auto,
        "nonDefaultOptions": {"num_threads": 1},
        "defaults": {"maxBootstrappedDemos": optimizer.max_bootstrapped_demos,
                     "maxLabeledDemos": optimizer.max_labeled_demos, "initTemperature": optimizer.init_temperature,
                     "minibatchSize": 35, "minibatchFullEvalSteps": 5, "viewDataBatchSize": 10,
                     "programAwareProposer": True, "dataAwareProposer": True, "tipAwareProposer": True,
                     "fewshotAwareProposer": True},
        "splits": splits(train, val), "taskSettings": {"temperature": 0.17, "max_tokens": 73},
        "numCandidates": len(optimizer.demo_sets[0]), "numInstructions": len(optimizer.instructions[0]),
        "numTrials": len(optimizer.params), "minibatch": False,
        "bootstrapCalls": optimizer.bootstrap_calls, "demoSets": optimizer.demo_sets,
        "instructions": optimizer.instructions, "proposerCalls": proposer_calls,
        "strictThroughTrial": study.sampler.strict_through(study.trials[-1].number),
        "acquisitionGaps": study.sampler.acquisition_gaps,
        "trialTable": [{"number": trial.number, "params": trial.params, "value": trial.value / 100,
                        "state": trial.state.name, "fullValidation": evaluations[trial.number]["fullValidation"]}
                       for trial in study.trials],
        "evaluations": evaluations, "bestFullValidationScore": compiled.score / 100, "state": state(compiled),
    }
    return {"id": "miprov2-default-grounded-001", "environment": environment(),
            "description": "Full MIPROv2.compile with all grounding, auto and budget defaults joining bootstrap, "
                           "grounded proposals and TPE trials (num_threads=1 for evaluation order).",
            "payload": payload,
            "trajectory": {
                "sampledTrials": len(optimizer.params), "minibatch": False, "valsetSize": len(val),
                "sampledEvaluation": "fullValidation",
                "insertedFullEvaluations": len(study.trials) - len(optimizer.params) - 1,
                "baselineTrials": 1, "totalStudyRows": len(study.trials),
                "strictThroughTrial": payload["strictThroughTrial"],
                "firstInadmissibleTie": study.sampler.first_inadmissible()}}


def generate():
    return [teacher_trace_calls(), teacher_settings(), default_grounded()]
