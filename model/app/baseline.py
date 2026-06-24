"""Baseline football forecast: a small, dependency-free Poisson scoreline model.

This is intentionally simple (Phase 0). It produces a deterministic, non-constant
P(home win) so the end-to-end pipeline has something real to commit, while the API
contract stays identical to whatever real model replaces it later.

Method:
  1. Derive an expected-goals rate (lambda) for each side. If the caller supplies
     `home_lambda` / `away_lambda` in features, use those; otherwise derive a stable
     rate from the team code (hash -> attacking strength) plus a home-field bump.
  2. Treat goals as independent Poisson. Build the joint scoreline distribution and
     sum the mass where home goals > away goals = P(home win).
"""

from __future__ import annotations

import hashlib
import math

# Tunables (league-average-ish, not fitted — this is a baseline).
_BASE_GOALS = 1.35  # league-average goals per team per match
_STRENGTH_SPREAD = 0.55  # how far team strength can swing the rate
_HOME_ADVANTAGE = 1.15  # multiplicative home bump
_MAX_GOALS = 10  # truncate the Poisson tail


def _strength(team: str) -> float:
    """Stable pseudo-strength in [-1, 1] derived from the team code."""
    digest = hashlib.sha256(team.strip().upper().encode("utf-8")).digest()
    # First 4 bytes -> [0, 1) -> [-1, 1].
    raw = int.from_bytes(digest[:4], "big") / 0xFFFFFFFF
    return raw * 2.0 - 1.0


def expected_goals(team: str, *, is_home: bool) -> float:
    rate = _BASE_GOALS * (1.0 + _STRENGTH_SPREAD * _strength(team))
    if is_home:
        rate *= _HOME_ADVANTAGE
    return max(0.05, rate)


def _poisson_pmf(k: int, lam: float) -> float:
    return math.exp(-lam) * lam**k / math.factorial(k)


def prob_home_win(
    home: str,
    away: str,
    *,
    home_lambda: float | None = None,
    away_lambda: float | None = None,
) -> float:
    """Return P(home win) for the given fixture, in [0, 1]."""
    lam_home = home_lambda if home_lambda is not None else expected_goals(home, is_home=True)
    lam_away = away_lambda if away_lambda is not None else expected_goals(away, is_home=False)

    home_pmf = [_poisson_pmf(i, lam_home) for i in range(_MAX_GOALS + 1)]
    away_pmf = [_poisson_pmf(j, lam_away) for j in range(_MAX_GOALS + 1)]

    p_home = 0.0
    for i in range(_MAX_GOALS + 1):
        for j in range(_MAX_GOALS + 1):
            if i > j:
                p_home += home_pmf[i] * away_pmf[j]

    # Clamp away from exact 0/1 to keep downstream logit/Brier math well-behaved.
    return min(0.999, max(0.001, p_home))
