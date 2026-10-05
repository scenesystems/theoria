"""Only calls Optuna; no TPE density or selection code is duplicated here."""

from collections import Counter
import itertools
import warnings

import optuna
from optuna.distributions import CategoricalDistribution
from optuna.trial import TrialState

SPACE = {f"{i}_predictor_{kind}": list(range(n))
         for i in range(2) for kind, n in [("instruction", 3), ("demos", 2)]}
OPTIONS = {"n_startup_trials": 4, "multivariate": True, "consider_prior": True,
           "prior_weight": 1.0, "n_ei_candidates": 24}


def study(seed):
    return optuna.create_study(direction="maximize", sampler=optuna.samplers.TPESampler(seed=seed, **OPTIONS))


def ask(s):
    trial = s.ask()
    params = {name: trial.suggest_categorical(name, values) for name, values in SPACE.items()}
    return trial, params


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
    # Independent fixed-history draws. Test the joint law, not Python's RNG stream.
    counts = Counter()
    for seed in range(512):
        replay = study(seed)
        replay.add_trials(s.trials)
        _, params = ask(replay)
        counts[tuple(params.values())] += 1
    return {"seed": 9, "space": SPACE, "options": OPTIONS, "sequence": sequence,
            "distribution": {"draws": 512, "maxTotalVariation": 0.15,
                             "joint": [{"choices": list(t), "count": counts[t]}
                                       for t in itertools.product(*SPACE.values())]}}
