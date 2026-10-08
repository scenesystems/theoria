"""Continuous Parzen kernels, densities, and samples from Optuna."""

import numpy as np
from optuna.distributions import FloatDistribution
from optuna.samplers._tpe.parzen_estimator import _ParzenEstimator, _ParzenEstimatorParameters
from optuna.samplers._tpe.sampler import default_weights

from ._common import metadata, RecordingRandomState

CASES = [
    ("basic", [.2, .4, .7], 0., 1., [.1, .6, .9]),
    ("magic-clip", [.5001, .5002, .5003], 0., 1., [.499, .5002, .8]),
    ("prior-only", [], 0., 1., [.1, .5, .9]),
    ("recency-ramp", np.linspace(.05, .95, 30).tolist(), 0., 1., [.12, .33, .77]),
    ("boundary-low-skew", [.0005, .0007, .001, .0015], 0., 1., [0., .0006, .01, .4]),
    ("boundary-high-skew", [.9985, .999, .9994, .9998], 0., 1., [.6, .95, .999, 1.]),
    ("endpoint-observations", [0., 0., 1., 1.], 0., 1., [0., .0001, .5, .9999, 1.]),
    ("bimodal-separated", [-8.5, -7.9, 7.4, 8.1], -10., 10., [-9.5, -8., 0., 8., 9.5]),
    ("narrow-support", [9.9991, 9.9993, 10.0002, 10.0004], 9.999, 10.001, [9.999, 9.9995, 10.0005, 10.001]),
    ("wide-negative-range", [-9.5, -2.2, 0., 3.8], -12., 8., [-11., -3., 1., 7.]),
    ("single-observation", [.42], 0., 1., [.05, .42, .95]),
    ("outlier-cluster", [.001, .002, .003, .9], 0., 1., [0., .0025, .2, .9, 1.]),
    ("repeated-support-point", [.25, .25, .25, .8], 0., 1., [0., .25, .5, .8, 1.]),
    ("tiny-cross-zero-span", [-.0008, -.0002, .0003, .0007], -.001, .001, [-.001, -.0004, 0., .0004, .001]),
    ("offset-positive-range", [100.2, 100.7, 104.4, 108.8], 100., 110., [100., 100.5, 105., 109.5]),
    ("micro-positive-span", [.5000004, .5000011, .5000028, .5000032], .5, .500004,
     [.5, .5000008, .500002, .5000036, .500004]),
    ("extreme-asymmetric-range", [-49.5, -48.9, -30.2, .6], -50., 1., [-50., -49., -35., -5., 1.]),
    ("upper-boundary-cluster", [9.6, 9.8, 9.95, 10., 10.], 0., 10., [0., 5., 9.7, 9.98, 10.]),
]


def generate(generated_at):
    documents = []
    for name, observations, low, high, probes in CASES:
        estimator = _ParzenEstimator({"x": np.asarray(observations)}, {"x": FloatDistribution(low, high)},
                                     _ParzenEstimatorParameters(1., True, False, default_weights, False, {}))
        mixture = estimator._mixture_distribution
        distribution = mixture.distributions[0]
        logs = estimator.log_pdf({"x": np.asarray(probes)})
        rng = RecordingRandomState(23)
        samples = [float(estimator.sample(rng, 1)["x"][0]) for _ in range(4)]
        documents.append({"fixture": f"continuous-kde.{name}", "file": f"continuous-kde/{name}.json",
                          "metadata": metadata(generated_at), "payload": {
                              "observations": observations, "low": low, "high": high, "expected": {
                                  "kernels": [{"mean": float(mu), "sigma": float(sigma), "weight": float(weight)}
                                              for mu, sigma, weight in zip(distribution.mu, distribution.sigma, mixture.weights, strict=True)],
                                  "logDensities": [{"probe": probe, "expected": float(value)} for probe, value in zip(probes, logs, strict=True)],
                                  "candidateRolls": list(zip(rng.component_rolls, rng.value_rolls, strict=True)),
                                  "expectedSamples": samples,
                              },
                          }})
    return documents
