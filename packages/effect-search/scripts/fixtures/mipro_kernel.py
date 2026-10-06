"""Only calls Optuna; no TPE density or selection code is duplicated here."""

from collections import Counter
import itertools
import warnings

import numpy as np
import optuna
from optuna.distributions import CategoricalDistribution
from optuna.trial import TrialState

SPACE = {f"{i}_predictor_{kind}": list(range(n))
         for i in range(2) for kind, n in [("instruction", 3), ("demos", 2)]}
OPTIONS = {"n_startup_trials": 4, "multivariate": True, "consider_prior": True,
           "prior_weight": 1.0, "n_ei_candidates": 24}


class ObservedTPE(optuna.samplers.TPESampler):
    """Observe upstream scores, never alter candidates, scores, RNG or selection."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.acquisition_gaps = []

    def _sample(self, study, trial, search_space):
        self.current_trial = trial.number
        return super()._sample(study, trial, search_space)

    def _compute_acquisition_func(self, samples, below, above):
        scores = super()._compute_acquisition_func(samples, below, above)
        winner = int(np.argmax(scores))
        distinct = np.any(np.array(list(samples.values())) !=
                          np.array([values[winner] for values in samples.values()])[:, None], axis=0)
        gap = float(scores[winner] - np.max(scores[distinct])) if np.any(distinct) else None
        evidence = {"trial": self.current_trial, "dimensions": list(samples),
                    "gap": round(gap, 12) if gap is not None else None, "tie": None}
        if gap is not None and gap < 1e-9:
            def config(index):
                return {name: below._search_space[name].to_external_repr(values[index])
                        for name, values in samples.items()}

            def rows(model, index):
                mixture = model._mixture_distribution
                return [d.weights[:, int(samples[name][index])].tobytes()
                        for name, d in zip(samples, mixture.distributions)] + [mixture.weights.tobytes()]

            competitors = np.flatnonzero(distinct & (scores >= scores[winner] - 1e-9))
            different = [index for index in competitors if any(
                rows(model, winner) != rows(model, index) for model in (below, above))]
            classification = ("subUlp" if gap > 0 else
                              "coincidentalCancellation" if different else "identicalInputs")
            evidence["tie"] = {"classification": classification, "winner": config(winner),
                               "other": config(int((different or list(competitors))[0]))}
        self.acquisition_gaps.append(evidence)
        return scores

    def first_inadmissible(self):
        return next((entry for entry in self.acquisition_gaps
                     if entry["tie"] and entry["tie"]["classification"] != "identicalInputs"), None)

    def strict_through(self, last_trial):
        first = self.first_inadmissible()
        return first["trial"] - 1 if first else last_trial


def study(seed, multivariate=True, startup=4):
    return optuna.create_study(direction="maximize", sampler=ObservedTPE(
        seed=seed, **{**OPTIONS, "multivariate": multivariate, "n_startup_trials": startup}))


def ask(s, space=SPACE):
    trial = s.ask()
    params = {name: trial.suggest_categorical(name, values) for name, values in space.items()}
    return trial, params


def categorical_sequence(seed, multivariate, startup=4):
    # Deliberately unsorted names and a singleton distinguish independent order,
    # sorted relative sampling, and distributions that consume no randomness.
    space = {"z": [0, 1, 2], "fixed": [7], "a": [0, 1, 2, 3], "m": [0, 1]}
    s = study(seed, multivariate, startup)
    s.enqueue_trial({name: values[0] for name, values in space.items()})
    sequence = []
    for _ in range(16):
        trial, parameters = ask(s, space)
        value = (parameters["z"] * 2 + parameters["a"] * 3 + parameters["m"] * 5) / 18
        s.tell(trial, value)
        sequence.append({"number": trial.number, "params": parameters, "state": "COMPLETE", "value": value})
    return {"seed": seed, "multivariate": multivariate, "space": space, "sequence": sequence,
            "nStartupTrials": startup, "strictThroughTrial": s.sampler.strict_through(15),
            "acquisitionGaps": s.sampler.acquisition_gaps}


def coupled_sequence(kind, multivariate=False, seed=211):
    space = {"instruction": [f"i{i}" for i in range(6)],
             "demo": [f"d{i}" for i in range(6)], "temperature": ["cool", "warm", "hot"]}
    sampler = (optuna.samplers.RandomSampler(seed=seed) if kind == "random" else
               ObservedTPE(seed=seed, multivariate=multivariate,
                                         n_startup_trials=8, n_ei_candidates=80))
    s = optuna.create_study(direction="minimize", sampler=sampler)
    sequence = []
    for _ in range(24):
        trial, parameters = ask(s, space)
        index = space["instruction"].index(parameters["instruction"])
        coupling = 0 if parameters["demo"] == ["d3", "d5", "d1", "d4", "d0", "d2"][index] else 4.5
        value = coupling + {"cool": 0, "warm": 0.15, "hot": 0.35}[parameters["temperature"]] + 0.01 * index
        s.tell(trial, value)
        sequence.append({"number": trial.number, "params": parameters, "value": value})
    return {"sampler": kind, "seed": seed, "multivariate": multivariate, "sequence": sequence,
            "strictThroughTrial": sampler.strict_through(23) if kind == "tpe" else 23,
            "acquisitionGaps": sampler.acquisition_gaps if kind == "tpe" else [],
            "best": {"number": s.best_trial.number, "params": s.best_params, "value": s.best_value}}


def scan_independent(rejected):
    best = None
    for seed in range(100):
        candidate = categorical_sequence(seed, False, startup=8)
        if best is None or candidate["strictThroughTrial"] > best["strictThroughTrial"]:
            best = candidate
        if candidate["strictThroughTrial"] == 15:
            return candidate
        first = next(entry for entry in candidate["acquisitionGaps"]
                     if entry["tie"] and entry["tie"]["classification"] != "identicalInputs")
        rejected.append({"family": "unsorted", "seed": seed, "multivariate": False,
                         "nStartupTrials": 8, **first})
    return best


def generate():
    optuna.logging.set_verbosity(optuna.logging.ERROR)
    warnings.filterwarnings("ignore", category=optuna.exceptions.ExperimentalWarning)
    warnings.filterwarnings("ignore", category=FutureWarning)
    s = study(9)
    distributions = {k: CategoricalDistribution(v) for k, v in SPACE.items()}
    s.add_trial(optuna.trial.create_trial(params={k: 0 for k in SPACE}, distributions=distributions, value=0.4))
    sequence = [{"number": 0, "params": {k: 0 for k in SPACE}, "state": "COMPLETE", "value": 0.4}]
    for _ in range(15):
        trial, params = ask(s)
        value = sum((i + 1) * params[k] for i, k in enumerate(SPACE)) / 14
        failed = trial.number == 3
        s.tell(trial, state=TrialState.FAIL) if failed else s.tell(trial, value)
        sequence.append({"number": trial.number, "params": params,
                         "state": "FAIL" if failed else "COMPLETE", "value": None if failed else value})
    # Independent fixed-history draws, now required to match seed for seed.
    counts, samples, gaps = Counter(), [], []
    for seed in range(512):
        replay = study(seed)
        replay.add_trials(s.trials)
        _, params = ask(replay)
        assert replay.sampler.first_inadmissible() is None
        samples.append(params)
        gaps.extend(replay.sampler.acquisition_gaps)
        counts[tuple(params.values())] += 1
    assert s.sampler.first_inadmissible() is None
    rejected = []
    categorical = [categorical_sequence(seed, multivariate)
                   for seed in [0, 1, 2**32 - 1] for multivariate in [False, True]]
    categorical.extend([categorical_sequence(9, True), scan_independent(rejected)])
    coupled = [coupled_sequence("tpe", False), coupled_sequence("tpe", True), coupled_sequence("random")]
    for family, trajectories in [("unsorted", categorical), ("coupled", coupled)]:
        for entry in trajectories:
            first = next((gap for gap in entry["acquisitionGaps"]
                          if gap["tie"] and gap["tie"]["classification"] != "identicalInputs"), None)
            if first:
                rejected.append({"family": family, "seed": entry["seed"], "multivariate": entry["multivariate"],
                                 "nStartupTrials": entry.get("nStartupTrials", 8), **first})
    return {"seed": 9, "space": SPACE, "options": OPTIONS, "sequence": sequence,
            "strictThroughTrial": s.sampler.strict_through(15),
            "acquisitionGaps": s.sampler.acquisition_gaps,
            "categoricalSequences": categorical,
            "coupledSequences": coupled,
            "trajectorySelection": {"rule": "Retain recorded trajectories, but assert only through the trial before the first subUlp or coincidentalCancellation tie. Extra independent trajectory: startup=8, scan seeds 0..99 in order; select first fully strict 16-trial run, else earliest seed with longest strict prefix. Record diagnostic gaps rounded to 12 decimals; classify untouched upstream scores and bit-identical ordered kernel inputs.",
                                    "rejected": rejected},
            "distribution": {"draws": 512, "maxTotalVariation": 0.15,
                             "samples": samples, "acquisitionGaps": gaps,
                             "joint": [{"choices": list(t), "count": counts[t]}
                                       for t in itertools.product(*SPACE.values())]}}
