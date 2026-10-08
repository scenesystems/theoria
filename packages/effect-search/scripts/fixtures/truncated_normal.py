"""Optuna truncated-normal quantiles and log densities, without a second CDF implementation."""

import numpy as np
from optuna.samplers._tpe import _truncnorm

from ._common import metadata

CASES = [
    ("centered", .5, .25, 0., 1., [.0, .1, .5, .9, 1.], [.25, .5, .75]),
    ("narrow-interval", 0., 1., -.001, .001, [0., .1, .5, .9, 1.], [-.0005, 0., .0005]),
    ("left-tail", 0., 1., -8., -5., [0., .1, .5, .9, 1.], [-7., -6., -5.5]),
    ("right-tail", 0., 1., 5., 8., [0., .1, .5, .9, 1.], [5.5, 6., 7.]),
    ("ultra-left-tail", 0., 1., -12., -9., [0., 1e-6, .2, .8, 1.], [-11.5, -10.5, -9.5]),
    ("ultra-right-tail", 0., 1., 9., 12., [0., 1e-6, .2, .8, 1.], [9.5, 10.5, 11.5]),
    ("skewed-support", 2., .3, 1.9, 3.4, [0., .1, .5, .9, 1.], [1.95, 2.1, 2.6, 3.2]),
    ("tiny-sigma", 1., .001, .9985, 1.002, [0., .25, .5, .75, 1.], [.999, 1., 1.001]),
    ("mean-outside-support", -2., .4, .1, .6, [0., .05, .5, .95, 1.], [.15, .3, .45, .55]),
    ("mean-far-right-support-left", 4., .8, -1., -.3, [0., .1, .5, .9, 1.], [-.95, -.75, -.55, -.35]),
    ("mean-far-left-support-right", -4., .8, .3, 1., [0., .1, .5, .9, 1.], [.35, .55, .75, .95]),
    ("ultra-tight-support-far-right-mean", 25., 2., -.02, .03, [0., .1, .5, .9, 1.], [-.015, 0., .015, .028]),
    ("ultra-tight-support-far-left-mean", -25., 2., -.03, .02, [0., .1, .5, .9, 1.], [-.028, -.015, 0., .015]),
    ("micro-support-far-right-mean", 40., 1.5, -.005, .004, [0., 1e-6, .5, .999999, 1.], [-.0045, -.001, .002, .0038]),
    ("micro-support-far-left-mean", -40., 1.5, -.004, .005, [0., 1e-6, .5, .999999, 1.], [-.0038, -.002, .001, .0045]),
    ("mean-near-low-bound-tiny-window", 2.00005, .0002, 2., 2.0005, [0., .01, .5, .99, 1.], [2.00001, 2.0001, 2.0003, 2.00045]),
    ("mean-near-high-bound-tiny-window", -1.00005, .0002, -1.0005, -1., [0., .01, .5, .99, 1.], [-1.00045, -1.0003, -1.0001, -1.00001]),
    ("wide-support", 3., 2.5, -4., 9., [0., 1e-6, .25, .75, 1.], [-2.5, 0., 3., 7.]),
    ("off-center-narrow", 1.2, .05, 1.05, 1.18, [0., .1, .5, .9, 1.], [1.06, 1.1, 1.15, 1.17]),
]


def generate(generated_at):
    cases = []
    for name, mean, sigma, low, high, quantiles, probes in CASES:
        a, b = (low - mean) / sigma, (high - mean) / sigma

        class ScriptedQuantiles(np.random.RandomState):
            def uniform(self, low=0., high=1., size=None):
                return np.asarray(quantiles)

        samples = _truncnorm.rvs(np.full(len(quantiles), a), np.full(len(quantiles), b),
                                 loc=mean, scale=sigma, random_state=ScriptedQuantiles(0))
        cases.append({"id": name, "params": {"mean": mean, "sigma": sigma, "low": low, "high": high},
                      "sampleQuantiles": quantiles, "sampleExpected": samples.tolist(),
                      "logPdfProbes": probes,
                      "logPdfExpected": _truncnorm.logpdf(np.asarray(probes), a, b, loc=mean, scale=sigma).tolist()})
    return [{"fixture": "truncated-normal.edge-cases", "file": "truncated-normal/edge-cases.json",
             "metadata": metadata(generated_at), "payload": {"cases": cases}}]
