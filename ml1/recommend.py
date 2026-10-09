"""ML + TF-IDF government scheme recommender (eligibility-first, best-only)."""

import os
import joblib
import pandas as pd
import numpy as np

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

CSV_PATH = os.path.join(BASE_DIR, "schemes_clean.csv")
ENTREPRENEUR_MODEL = os.path.join(BASE_DIR, "entrepreneur_rf_model.pkl")
CATEGORY_MODEL = os.path.join(BASE_DIR, "category_svm_model.pkl")
BENEFIT_MODEL = os.path.join(BASE_DIR, "benefit_type_model.pkl")

# ---- Tunable quality gates (calibrate on a few real test profiles) ----
MIN_RELEVANCE = 3.0      # TF-IDF cosine*100; below this a scheme isn't about the need
MIN_SCORE = 25.0         # absolute floor on the final (0-100) score
RELATIVE_CUTOFF = 0.65   # keep only schemes within 65% of the best score
MAX_RESULTS = 5          # never show more than this
SENIOR_AGE = 60          # applicant counts as "senior citizen" from this age

OUTPUT_COLS = [
    "scheme_name", "level", "state", "benefit_type",
    "app_mode", "score", "why", "source_url",
]

df = pd.read_csv(CSV_PATH)

# --- data hygiene on load -------------------------------------------------
# 4 rows have age_min > age_max (scrape errors) -> ignore their age limits
_bad_age = df.age_min > df.age_max
df.loc[_bad_age, ["age_min", "age_max"]] = np.nan
df["dbt_scheme"] = df["dbt_scheme"].astype(int)

# A few tribal / SC schemes were not flagged in the CSV; recover from the NAME
# only (conservative) so they are not shown to applicants outside those groups.
_name = df.scheme_name.fillna("")
df.loc[_name.str.contains(r"\btribal\b|scheduled tribe|adivasi", case=False, regex=True), "f_st"] = 1
df.loc[_name.str.contains(r"scheduled caste|\bdalit\b", case=False, regex=True), "f_sc"] = 1

VALID_STATES = sorted(df.loc[df.level == "State", "state"].unique())

entrepreneur_model = joblib.load(ENTREPRENEUR_MODEL)
category_model = joblib.load(CATEGORY_MODEL)
benefit_model = joblib.load(BENEFIT_MODEL)


df["women_only"] = (
    df.scheme_name.fillna("").str.contains(
        r"women only|only for women|exclusively for women|for women entrepreneurs only",
        case=False, regex=True,
    )
    | df.eligibility.fillna("").str.contains(
        r"must be a (?:woman|female)|should be a (?:woman|female)"
        r"|only (?:women|female)|women only|exclusively (?:for )?women",
        case=False, regex=True,
    )
).astype(int)


df["text"] = (
    df.scheme_name.fillna("") + " "
    + df.tags.fillna("") + " "
    + df.brief_description.fillna("") + " "
    + df.eligibility.fillna("") + " "
    + df.benefits.fillna("")
).str.lower()

vec = TfidfVectorizer(
    ngram_range=(1, 2),
    min_df=2,
    sublinear_tf=True,
    stop_words="english",
)
M = vec.fit_transform(df["text"])

GROUP_FLAGS = {
    "f_sc": "SC",
    "f_st": "ST",
    "f_obc": "OBC",
    "f_women": "Women",
    "f_minority": "Minority",
    "f_disability": "Disability",
    "f_bpl": "BPL",
    "f_transgender": "Transgender",
    "f_ex_serviceman": "ExServiceman",
    "f_senior": "Senior",
}


def entrepreneur_probability(rows):
    categorical = ["level", "benefit_type", "app_mode", "beneficiary_type"]
    numeric = [
        "faq_count", "n_docs", "n_tags", "elig_len", "benefit_len",
        "age_min", "age_max", "income_cap", "csc",
        "has_exclusions", "dbt_scheme",
    ]
    flag_columns = [
        c for c in rows.columns if c.startswith("f_") and c != "f_msme"
    ]
    available = [
        c for c in categorical + numeric + flag_columns if c in rows.columns
    ]
    X = rows[available].copy()
    if "dbt_scheme" in X:
        X["dbt_scheme"] = X["dbt_scheme"].astype(int)

    try:
        proba = entrepreneur_model.predict_proba(X)
        return proba[:, 1] if proba.shape[1] == 2 else proba.max(axis=1)
    except Exception:
        return entrepreneur_model.predict(X).astype(float)


def user_groups(social_cat, gender, minority, disability, bpl,
                age=30, ex_serviceman=False):
    """Groups the applicant actually belongs to."""
    groups = set()
    if social_cat in ("SC", "ST", "OBC"):
        groups.add(social_cat)
    g = str(gender).lower()
    if g == "female":
        groups.add("Women")
    if g in ("transgender", "third gender"):
        groups.add("Transgender")
    if minority:
        groups.add("Minority")
    if disability:
        groups.add("Disability")
    if bpl:
        groups.add("BPL")
    if ex_serviceman:
        groups.add("ExServiceman")
    if age >= SENIOR_AGE:
        groups.add("Senior")
    return groups


def recommend(
    state,
    gender,
    social_cat,
    minority=False,
    disability=False,
    bpl=False,
    age=30,
    income=200000,
    need="loan subsidy to start small business",
    top=MAX_RESULTS,
    entrepreneur_only=False,
    ex_serviceman=False,
):
    gender = str(gender).lower()
    groups = user_groups(social_cat, gender, minority, disability, bpl,
                         age=age, ex_serviceman=ex_serviceman)

    # case-insensitive state match; reject unknown states loudly
    _lookup = {v.lower(): v for v in VALID_STATES}
    state_key = str(state).strip().lower()
    if state_key not in _lookup:
        raise ValueError(f"Unknown state '{state}'. Valid: {', '.join(VALID_STATES)}")
    state = _lookup[state_key]

    ok = (df.level == "Central") | (df.state == state)
    ok &= df.is_expired == 0

    if entrepreneur_only:
        ok &= df.is_entrepreneur_scheme == 1

    if gender != "female":
        ok &= df.women_only == 0

    ok &= ~(df.age_min > age)
    ok &= ~(df.age_max < age)
    ok &= ~(df.income_cap < income)

    flag_cols = [c for c in GROUP_FLAGS if c in df.columns]
    if flag_cols:
        targeted = df[flag_cols].fillna(0).astype(int)

        def _dimension_ok(cols):
            """Untargeted in this dimension -> open; else applicant must match one."""
            cols = [c for c in cols if c in targeted.columns]
            if not cols:
                return pd.Series(True, index=df.index)
            has_target = targeted[cols].sum(axis=1) > 0
            mine = [c for c in cols if GROUP_FLAGS[c] in groups]
            matches = (targeted[mine].sum(axis=1) > 0 if mine
                       else pd.Series(False, index=df.index))
            return ~has_target | matches

        # Caste category is checked on its own: a "Tribal Girls" scheme
        # (ST + Women) needs the applicant to be ST, not merely a woman.
        social_cols = ["f_sc", "f_st", "f_obc"]
        other_cols = [c for c in flag_cols if c not in social_cols]
        ok &= _dimension_ok(social_cols)
        ok &= _dimension_ok(other_cols)

    s = df[ok].copy()
    if s.empty:
        return pd.DataFrame(columns=OUTPUT_COLS)

    idx = np.flatnonzero(ok.values)

    q = need.lower()

    tfidf_score = np.clip(
        cosine_similarity(vec.transform([q]), M[idx]).ravel() * 100, 0, 100
    )
    # raw cosine on short queries is tiny (a great match is ~10-30), so scale
    # to the best eligible match for the weighted score; the raw value is
    # still used for the MIN_RELEVANCE "is it even about the need" gate.
    top_rel = tfidf_score.max()
    rel_scaled = tfidf_score / top_rel * 100 if top_rel > 0 else tfidf_score

    predicted_category = category_model.predict([q])[0]
    category_match = (
        s["primary_category"].fillna("").astype(str).str.lower()
        .eq(str(predicted_category).lower()).astype(float).values * 100
    )

    predicted_benefit = benefit_model.predict([q])[0]
    benefit_match = (
        s["benefit_type"].fillna("").astype(str).str.lower()
        .eq(str(predicted_benefit).lower()).astype(float).values * 100
    )

    entrepreneur_score = (
        entrepreneur_probability(s) * 100 if entrepreneur_only else np.zeros(len(s))
    )

    profile_score = np.zeros(len(s))
    if groups:
        hits = np.zeros(len(s))
        for col in flag_cols:
            if GROUP_FLAGS[col] in groups:
                hits += s[col].fillna(0).astype(float).values
        profile_score = np.clip(hits / len(groups), 0, 1) * 100

    # When not restricted to entrepreneur schemes the "entrepreneur-ness" term
    # is meaningless (it would punish farm/education/health schemes), so its
    # weight moves to relevance.
    w_ent = 0.10 if entrepreneur_only else 0.0
    final = (
        rel_scaled * (0.60 + (0.10 - w_ent))   # relevance to the need dominates
        + entrepreneur_score * w_ent
        + category_match * 0.10
        + benefit_match * 0.10
        + profile_score * 0.10
    )
    s["score"] = np.clip(final, 0, 100)
    s["relevance"] = tfidf_score

    reasons = []
    for i in range(len(s)):
        r = []
        if tfidf_score[i] >= 10:
            r.append("matches your need")
        if category_match[i]:
            r.append(f"category: {predicted_category}")
        if benefit_match[i]:
            r.append(f"benefit: {predicted_benefit}")
        if profile_score[i] > 0:
            r.append("supports your profile")
        reasons.append("; ".join(r) or "general fit")
    s["why"] = reasons

    s = s[s.relevance >= MIN_RELEVANCE]
    s = s[s.score >= MIN_SCORE]
    if s.empty:
        return pd.DataFrame(columns=OUTPUT_COLS)

    s = s.sort_values("score", ascending=False)
    s = s.drop_duplicates(subset="scheme_name")
    s = s[s.score >= s.score.iloc[0] * RELATIVE_CUTOFF]
    s = s.head(min(top, MAX_RESULTS))

    s["score"] = s["score"].round(2)
    return s[OUTPUT_COLS].reset_index(drop=True)


if __name__ == "__main__":
    pass
