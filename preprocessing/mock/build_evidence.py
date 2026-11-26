"""MOCK: hand-selected studies with solution tags for the funder prototype.

Reads the (uncommitted) study extract and writes public/mock/evidence.json.

The output is public (repository and preview deployment), so the full abstract is only
kept for studies published open access with an open licence (OpenAlex status gold,
hybrid or diamond). For all other studies only the tagged passage is kept and the app
points to the publisher for the full abstract.

Every tag below was assigned by reading the abstract. A tag is only given when
(1) a verbatim passage of the abstract satisfies the tag definition and
(2) the study is about that city (named in the title or in the passage).
The passage is located by its first words (and optionally its last words) and its
character offsets are stored, so the app highlights the abstract text itself.

Run from the repo root:  python preprocessing/mock/build_evidence.py
"""
import html
import json
import re
from pathlib import Path

import openpyxl

SOURCE = Path("preprocessing/case_study_relevant_literature_2.xlsx")
OUT = Path("public/mock/evidence.json")

DOMAINS = ["Mobility", "Energy"]
TAGS = {
    "M1": {
        "domain": "Mobility",
        "label": "Switch to cycling and walking, public transit, and shared mobility",
        "short": "Cycling, walking, transit, shared mobility",
        "definition": "The study documents walking and cycling promotion through infrastructure (bike lanes, sidewalks), incentives or behavioural change; a modal shift from private vehicles to buses, subways, trams or other public transit; or mobility services that enable shared use of vehicles, such as car-sharing, ride-hailing or micro-mobility, to reduce individual car ownership and trips.",
        "example": "Bike-sharing systems to reduce urban carbon emissions.",
    },
    "M2": {
        "domain": "Mobility",
        "label": "Uptake of battery electric vehicles and electric 2- and 3-wheelers",
        "short": "Battery electric vehicles",
        "definition": "The study documents adoption, diffusion or promotion of battery-electric cars, buses, motorcycles, scooters or other small electric vehicles, including policies, incentives, charging infrastructure or behavioural changes that increase the use of electric-powered transport instead of fossil-fuel vehicles.",
        "example": "Electric vehicle adoption programs to reduce urban transport emissions.",
    },
    "E1": {
        "domain": "Energy",
        "label": "District heating/cooling systems",
        "short": "District heating/cooling",
        "definition": "The study documents centralized systems distributing heat or cooling to multiple buildings using efficient or low-carbon energy sources (e.g. waste heat, renewables).",
        "example": "Waste heat recovery for district heating.",
    },
    "E2": {
        "domain": "Energy",
        "label": "Renewable energy generation & grid integration",
        "short": "Renewable generation & grid integration",
        "definition": "The study documents generation of electricity from renewable sources (solar, wind, hydro, geothermal, biomass) within the urban context, including rooftop PV; grid upgrades or energy storage that accommodate renewables; or integration of renewable energy systems into buildings, transport networks or urban infrastructure.",
        "example": "Rooftop solar PV deployment in cities.",
    },
}

CITIES = {"Copenhagen": 698, "Berlin": 5483, "Geneva": 69}

# OpenAlex open-access statuses for which the full abstract is reproduced
OPEN_STATUSES = {"gold", "hybrid", "diamond"}

# (city, OpenAlex id, tag, first words of the passage[, last words of the passage])
SELECTION = [
    # --- Copenhagen ---
    ("Copenhagen", "W4239510715", "M1", "This book considers the underlying political conditions that enabled cycling"),
    ("Copenhagen", "W1141250769", "M1", "This study documents the spatio-temporal development of Copenhagen"),
    ("Copenhagen", "W2596482858", "M1", "The idea of the project is to use GPS technology to provide buses with priority"),
    ("Copenhagen", "W3217714558", "M1", "Methodologically, the paper draws on insights from qualitative interviews with families using a car sharing scheme"),
    ("Copenhagen", "W2599858479", "M1", "This project examines how the implementation of light rail in Copenhagen"),
    ("Copenhagen", "W3136003627", "M1", "The chapter provides a close examination of the key design elements of the bicycle transportation system"),
    ("Copenhagen", "W4323978779", "M1", "Moreover, the micro scale investigation comprises Copenhagen"),
    ("Copenhagen", "W4405114726", "M1", "This article explores the innovative strategies implemented by leading European cities"),
    ("Copenhagen", "W2989680429", "E1", "The results show that from the socio-economic perspective, expanding district heating"),
    ("Copenhagen", "W2946332234", "E2", "Thousands of residents of Copenhagen purchased stock in the city"),
    ("Copenhagen", "W2083855283", "E2", "More ambitious projects followed and in 2001 the Middelgrunden"),
    ("Copenhagen", "W4402959157", "E2", "The aim of the study was to analyze the renewable energy adoption"),
    ("Copenhagen", "W2954874771", "E2", "With the solar power panels as integrated surface elements in new building constructions"),
    # --- Berlin ---
    ("Berlin", "W2049234165", "M1", "To evaluate whether successful schemes known from urban contexts might work in rural areas"),
    ("Berlin", "W4404142317", "M1", "Based on in-depth qualitative analysis of the participatory processes linked to a pedestrianisation scheme"),
    ("Berlin", "W2600368582", "M1", "In Berlin, an increase of multi-modal mobility is observed"),
    ("Berlin", "W587430226", "M1", "To address this issue, this article investigates the behaviour and preferences of new consumer groups in the Berlin car sharing market"),
    ("Berlin", "W4388583579", "M2", "On the other hand a lot of technical and organizational issues"),
    ("Berlin", "W3110096979", "M2", "We found for a case study dealing with the food retailing in Berlin"),
    ("Berlin", "W3036448874", "M2", "And we are able to generate a suitable planning to handle Berlin"),
    ("Berlin", "W2484328946", "M2", "A promising example of using EVs for a sustainable electric mobility"),
    ("Berlin", "W3045801317", "M2", "One potential solution to reduce these emissions is the use of battery electric vehicles"),
    ("Berlin", "W3107573134", "E1", "Although the literature has extensively covered the decarbonization of the power generation sector"),
    ("Berlin", "W4403345370", "E1", "The formulation is tested on Berlin"),
    ("Berlin", "W4392864993", "E2", "This study evaluates the solar energy potential of parking spaces in Berlin"),
    ("Berlin", "W4402614934", "E2", "Photovoltaics (PV) on building rooftops is a major contributor"),
    ("Berlin", "W3047358695", "E2", "This paper addresses the potential of urban wind energy production with small wind turbines"),
    ("Berlin", "W4364374794", "E2", "We use a linear cost minimization model for the Berlin-Brandenburg region"),
    ("Berlin", "W4353062135", "E2", "If 30% of the BEVs participate in V2G"),
    # --- Geneva ---
    ("Geneva", "W3164624409", "M1", "The municipal, regional and national authorities wanted to assess the potential of electric-assisted bicycles"),
    ("Geneva", "W4385783030", "M1", "During COVID-19, many cities built pop-up infrastructure", "institutional and societal actors."),
    ("Geneva", "W3091150101", "E1", "In this context, this study assesses how geothermal energy could be integrated into the main district heating system"),
    ("Geneva", "W3106704858", "E1", "The load curves generated by application of these two approaches are compared with the actual load"),
    ("Geneva", "W2508598657", "E1", "The findings demonstrate the importance of district heating networks"),
    ("Geneva", "W3100169744", "E1", "Geothermal energy from shallow and medium depths is identified"),
    ("Geneva", "W4392597433", "E2", "Here we use use the Weather Research and Forecast (WRF) model"),
    ("Geneva", "W2917956391", "E2", "Based on the analysis of a study case conducted in a neighbourhood in Geneva"),
    ("Geneva", "W4391445820", "E2", "To address this, the paper underscores the importance of digital tools for modeling solar energy", "(2019–2022)."),
]


def clean(text):
    text = html.unescape(html.unescape(text or ""))
    text = re.sub(r"<[^>]+>", " ", text).replace("_x000D_", " ")
    return re.sub(r"\s+", " ", text).strip()


def passage_span(abstract, first, last=None):
    start = abstract.find(first)
    if start < 0:
        raise ValueError(f"passage not found: {first!r}")
    if abstract.find(first, start + 1) >= 0:
        raise ValueError(f"passage not unique: {first!r}")
    if last:
        end = abstract.find(last, start)
        if end < 0:
            raise ValueError(f"passage end not found: {last!r}")
        return start, end + len(last)
    # end of the sentence: ., ! or ? followed by a space or a capital letter, or the end of the text
    m = re.search(r"[.!?](?=\s|[A-Z]|$)", abstract[start + len(first):])
    end = start + len(first) + (m.end() if m else len(abstract) - start - len(first))
    return start, end


def main():
    wanted = {s[1] for s in SELECTION}
    wb = openpyxl.load_workbook(SOURCE, read_only=True)
    rows = wb.worksheets[0].iter_rows(values_only=True)
    header = next(rows)
    records = {}
    for row in rows:
        r = dict(zip(header, row))
        key = (r["OpenAlex_article_id"] or "").split("/")[-1]
        if key in wanted:
            records[key] = r

    cities = {str(cid): {"name": name, "studies": []} for name, cid in CITIES.items()}
    index = {}
    for city, key, tag, first, *last in SELECTION:
        r = records[key]
        title = clean(r["title"])
        abstract = clean(r["abstract"])
        if abstract.startswith(title):
            abstract = abstract[len(title):].strip()
        abstract = re.sub(r"^(ABSTRACT|Abstract)[:\s]+", "", abstract)
        start, end = passage_span(abstract, first, last[0] if last else None)
        if city.lower() not in (title + " " + abstract[start:end]).lower():
            raise ValueError(f"{key}: {city} is neither in the title nor in the passage")
        is_open = (r["oa_status"] or "") in OPEN_STATUSES
        if not is_open:
            # keep the passage only
            abstract, start, end = abstract[start:end], 0, end - start
        study = index.get((city, key))
        if study is None:
            authors = [a.strip() for a in (r["authors"] or "").split(",") if a.strip()]
            study = {
                "id": key,
                "title": title,
                "authors": ", ".join(authors[:3]) + (" et al." if len(authors) > 3 else ""),
                "year": str(r["publication_year"] or ""),
                "doi": r["oa_doi"] or None,
                "openalex": r["OpenAlex_article_id"],
                "abstract": abstract,
                "excerpt": not is_open,
                "tags": [],
            }
            index[(city, key)] = study
            cities[str(CITIES[city])]["studies"].append(study)
        study["tags"].append({"tag": tag, "start": start, "end": end})
        print(f"{city:10s} {tag} {key:12s} {'full   ' if is_open else 'excerpt'} | {abstract[start:end][:110]}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"mock": True, "domains": DOMAINS, "tags": TAGS, "cities": cities}, ensure_ascii=False, indent=1))
    print()
    for cid, c in cities.items():
        counts = {t: sum(1 for s in c["studies"] for x in s["tags"] if x["tag"] == t) for t in TAGS}
        print(c["name"], len(c["studies"]), "studies", counts)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
