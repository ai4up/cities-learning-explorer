"""MOCK: challenge-specific similarity lenses for the funder prototype.

Reads public/cities.json and writes public/mock/lenses.json with, per lens:
peers (nearest neighbours), subtypes (k-means), 3D coordinates (PCA), the distance
of every city to the three evidence cities, and the cities that have an evidence
city among their peers.

Illustrative only: variable choices are hand-picked, and "public transport
accessibility" is a SYNTHETIC placeholder derived from density, income and
infrastructure plus noise. Do not use any of this for analysis.

Run from the repo root:  python preprocessing/mock/build_lenses.py
"""
import json
from pathlib import Path

import numpy as np

CITIES_JSON = Path("public/cities.json")
OUT = Path("public/mock/lenses.json")
EVIDENCE_CITIES = {"Copenhagen": 698, "Berlin": 5483, "Geneva": 69}
K_NEIGHBOURS = 15
K_SUBTYPES = 4
SEED = 7

LENSES = {
    "mobility": {
        "label": "Mobility and urban form",
        "question": "Which cities have a similar shape and similar travel conditions?",
        "variables": [
            ("population", "Population"),
            ("population_density", "Population density"),
            ("population_density_growth", "Population density growth"),
            ("built_up_share", "Built-up share"),
            ("impervious_share", "Impervious surface share"),
            ("impervious_unevenness", "Impervious surface unevenness"),
            ("gdp_ppp", "GDP PPP"),
            ("public_transport_access", "Public transport accessibility (illustrative)"),
        ],
        # Named by hand from the subtype centres printed below; check them after any change
        "subtypes": [
            ("Small, dense, low-income centres", "Small but dense cities with little sealed surface, low income and moderate public transport accessibility."),
            ("Wealthy, spacious, well-served cities", "Larger, high-income cities with low density, extensive sealed surface and high public transport accessibility."),
            ("Large, dense, densifying cities", "Large, dense cities that are still densifying, with unevenly distributed sealing and lower-middle income."),
            ("Small, spread-out, car-oriented towns", "Small, low-density cities with extensive sealed surface and low public transport accessibility."),
        ],
    },
    "energy": {
        "label": "Heat and energy demand",
        "question": "Which cities have a similar heating and energy task?",
        "variables": [
            ("hdd", "Heating Degree Days"),
            ("cdd", "Cooling Degree Days"),
            ("population_density", "Population density"),
            ("emissions", "GHG emissions"),
            ("gdp_ppp", "GDP PPP"),
            ("population_growth", "Population growth"),
        ],
        "subtypes": [
            ("Cold, wealthy, high-emission, stable cities", "High heating demand, high income and per-capita emissions, low density and little population growth."),
            ("Mixed-climate, wealthy, growing cities", "Both heating and cooling demand, high income and emissions, and a growing population."),
            ("Hot, dense, fast-growing, low-emission cities", "High cooling demand, dense, low income and emissions, and fast population growth."),
            ("Hot, dense, slow-growing cities", "High cooling demand, dense, lower income and emissions, and little population growth."),
        ],
    },
}


def pct_rank(x):
    """Percentile rank in [0, 1]; missing values get the median rank (0.5)."""
    x = np.asarray(x, dtype=float)
    out = np.full(len(x), 0.5)
    ok = ~np.isnan(x)
    order = x[ok].argsort().argsort()
    out[ok] = (order + 0.5) / ok.sum()
    return out


def kmeans(X, k, rng, n_init=8, n_iter=60):
    best = None
    for _ in range(n_init):
        centres = X[rng.choice(len(X), k, replace=False)]
        for _ in range(n_iter):
            labels = ((X[:, None, :] - centres[None]) ** 2).sum(-1).argmin(1)
            new = np.array([X[labels == j].mean(0) if (labels == j).any() else centres[j] for j in range(k)])
            if np.allclose(new, centres):
                break
            centres = new
        inertia = ((X - centres[labels]) ** 2).sum()
        if best is None or inertia < best[0]:
            best = (inertia, labels, centres)
    return best[1], best[2]


def main():
    cities = json.loads(CITIES_JSON.read_text())
    ids = [c["id"] for c in cities]
    idx = {cid: i for i, cid in enumerate(ids)}
    rng = np.random.default_rng(SEED)

    def col(key):
        return np.array([(c.get("characteristics") or {}).get(key, np.nan) for c in cities], dtype=float)

    ranks = {}

    def rank_of(key):
        if key not in ranks:
            ranks[key] = pct_rank(col(key))
        return ranks[key]

    # SYNTHETIC placeholder for public transport accessibility (see module docstring)
    z = (
        1.2 * (rank_of("population_density") - 0.5)
        + 1.0 * (rank_of("gdp_ppp") - 0.5)
        + 0.8 * (rank_of("critical_infrastructure") - 0.5)
        + 0.6 * (rank_of("population") - 0.5)
        + rng.normal(0, 0.25, len(cities))
    )
    ranks["public_transport_access"] = pct_rank(z)

    out = {
        "mock": True,
        "ids": ids,
        "evidence_cities": EVIDENCE_CITIES,
        "public_transport_access_pct": [int(round(v * 100)) for v in ranks["public_transport_access"]],
        "lenses": {},
    }

    for lens_key, lens in LENSES.items():
        keys = [k for k, _ in lens["variables"]]
        X = np.column_stack([rank_of(k) for k in keys])

        # Peers: Euclidean distance on percentile ranks
        neighbours, distances = [], []
        for start in range(0, len(X), 1000):
            d = np.sqrt(((X[start:start + 1000, None, :] - X[None]) ** 2).sum(-1))
            d[np.arange(len(d)), np.arange(start, start + len(d))] = np.inf
            nn = np.argpartition(d, K_NEIGHBOURS, axis=1)[:, :K_NEIGHBOURS]
            nd = np.take_along_axis(d, nn, 1)
            order = nd.argsort(1)
            neighbours.append(np.take_along_axis(nn, order, 1))
            distances.append(np.take_along_axis(nd, order, 1))
        neighbours = np.vstack(neighbours)
        distances = np.vstack(distances)

        labels, centres = kmeans(X, K_SUBTYPES, rng)

        # 3D coordinates for the embedding view
        Xc = X - X.mean(0)
        _, _, vt = np.linalg.svd(Xc, full_matrices=False)
        coords = Xc @ vt[:3].T

        # Distance and rank of every city to each evidence city
        evidence = {}
        learners = {}
        for name, cid in EVIDENCE_CITIES.items():
            d = np.sqrt(((X - X[idx[cid]]) ** 2).sum(1))
            rank = d.argsort().argsort()  # 0 = the evidence city itself
            evidence[str(cid)] = {
                "distance": [round(float(v), 3) for v in d],
                "rank": [int(v) for v in rank],
            }
            near = [i for i in d.argsort()[1:41]]
            learners[str(cid)] = [[ids[i], round(float(d[i]), 3)] for i in near]

        out["lenses"][lens_key] = {
            "label": lens["label"],
            "question": lens["question"],
            "variables": [{"key": k, "label": lab} for k, lab in lens["variables"]],
            "subtypes": [{"name": n, "description": d} for n, d in lens["subtypes"]],
            "subtype": [int(v) for v in labels],
            "subtype_centres": [[int(round(v * 100)) for v in row] for row in centres],
            "neighbors": [[ids[j] for j in row] for row in neighbours],
            "neighbor_distances": [[round(float(v), 3) for v in row] for row in distances],
            "coords": [[round(float(v), 3) for v in row] for row in coords],
            "evidence": evidence,
            "learners": learners,
        }

        print(f"\n== {lens_key}: subtype centres (percentiles) ==")
        print("   n     " + "  ".join(f"{k[:14]:>14s}" for k in keys))
        for j, row in enumerate(centres):
            print(f"{j} {int((labels == j).sum()):5d}  " + "  ".join(f"{v * 100:14.0f}" for v in row))
        for name, cid in EVIDENCE_CITIES.items():
            i = idx[cid]
            peers = ", ".join(f"{cities[j]['name']} ({cities[j]['country'][:3]})" for j in neighbours[i][:8])
            print(f"{name}: subtype {labels[i]} | peers: {peers}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"\nwrote {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
