"""Optuna product-normal density and sampling kernels, with observed RNG draws."""

import numpy as np
from optuna.samplers._tpe.probability_distributions import _BatchedTruncNormDistributions, _MixtureOfProductDistribution

from ._common import metadata, RecordingRandomState


def mixture(means, sigmas, weights):
    return _MixtureOfProductDistribution(np.asarray(weights), [
        _BatchedTruncNormDistributions(mu, sigma, -np.inf, np.inf)
        for mu, sigma in zip(np.asarray(means).T, np.asarray(sigmas).T, strict=True)
    ])


def generate(generated_at):
    densities = []
    for name, point, mean, sigmas in [
        ("standard-origin", [0., 0.], [0., 0.], [1., 1.]),
        ("unit-offset", [1., -1.], [0., 0.], [1., 1.]),
        ("asymmetric-sigma", [.25, -.5], [.5, -.75], [.2, .4]),
    ]:
        model = mixture([mean], [sigmas], [1.])
        densities.append({"id": name, "point": point, "mean": mean, "sigmas": sigmas,
                          "expectedLogDensity": float(model.log_pdf(np.asarray([point]))[0])})
    samples = []
    for name, mean, sigmas in [("kernel-a", [.5, -1.], [.2, .4]), ("kernel-b", [1.25, .75], [.35, .15])]:
        rng = RecordingRandomState(23)
        sample = mixture([mean], [sigmas], [1.]).sample(rng, 1)[0]
        samples.append({"id": name, "mean": mean, "sigmas": sigmas, "rolls": rng.value_rolls,
                        "expectedSample": sample.tolist()})
    means, sigmas, weights = [[.2, -.3], [1.1, .6]], [[.1, .2], [.3, .4]], [.75, .25]
    model = mixture(means, sigmas, weights)
    rng = RecordingRandomState(23)
    sample = model.sample(rng, 1)
    return [{"fixture": "multivariate-gaussian.parity", "file": "multivariate-gaussian/parity.json",
             "metadata": metadata(generated_at), "payload": {
                 "densityCases": densities, "samplingCases": samples, "mixtureCase": {
                     "means": means, "sigmas": sigmas, "weights": weights,
                     "componentRoll": rng.component_rolls[0], "valueRolls": rng.value_rolls,
                     "expectedSample": sample[0].tolist(), "expectedLogDensity": float(model.log_pdf(sample)[0]),
                 },
             }}]
