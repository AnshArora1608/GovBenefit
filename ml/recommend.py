
"""ML + TF-IDF government scheme recommender."""

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


df = pd.read_csv(CSV_PATH)

entrepreneur_model = joblib.load(ENTREPRENEUR_MODEL)
category_model = joblib.load(CATEGORY_MODEL)
benefit_model = joblib.load(BENEFIT_MODEL)


df["women_only"] = (
    df.scheme_name.fillna("").str.contains(
        r"women only|for women|mahila|swarnima|\bwomen\b",
        case=False,
        regex=True
    )
    |
    df.eligibility.fillna("").str.contains(
        r"must be a (?:woman|female)|should be a (?:woman|female)|only (?:women|female)|women only",
        case=False,
        regex=True
    )
).astype(int)


df["text"] = (
    df.scheme_name.fillna("")
    + " "
    + df.tags.fillna("")
    + " "
    + df.brief_description.fillna("")
    + " "
    + df.eligibility.fillna("")
    + " "
    + df.benefits.fillna("")
).str.lower()


vec = TfidfVectorizer(
    ngram_range=(1, 2),
    min_df=2,
    sublinear_tf=True,
    stop_words="english"
)

M = vec.fit_transform(df["text"])


def build_text(row):
    return (
        str(row.get("scheme_name", ""))
        + " "
        + str(row.get("tags", ""))
        + " "
        + str(row.get("brief_description", ""))
        + " "
        + str(row.get("eligibility", ""))
        + " "
        + str(row.get("benefits", ""))
    ).lower()


def entrepreneur_probability(rows):
    categorical = [
        "level",
        "benefit_type",
        "app_mode",
        "beneficiary_type"
    ]

    numeric = [
        "faq_count",
        "n_docs",
        "n_tags",
        "elig_len",
        "benefit_len",
        "age_min",
        "age_max",
        "income_cap",
        "csc",
        "has_exclusions",
        "dbt_scheme"
    ]

    flag_columns = [
        c for c in rows.columns
        if c.startswith("f_") and c != "f_msme"
    ]

    feature_columns = categorical + numeric + flag_columns

    available = [
        c for c in feature_columns
        if c in rows.columns
    ]

    X = rows[available].copy()

    try:
        probabilities = entrepreneur_model.predict_proba(X)

        if probabilities.shape[1] == 2:
            return probabilities[:, 1]

        return probabilities.max(axis=1)

    except Exception:
        predictions = entrepreneur_model.predict(X)
        return predictions.astype(float)


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
    top=10,
    entrepreneur_only=True
):

    d = df.copy()

    # -----------------------------
    # Hard eligibility filters
    # -----------------------------

    ok = (d.level == "Central") | (d.state == state)

    ok &= d.is_expired == 0

    if entrepreneur_only:
        ok &= d.is_entrepreneur_scheme == 1

    if gender != "female":
        ok &= d.women_only == 0

    ok &= ~(d.age_min > age)
    ok &= ~(d.age_max < age)
    ok &= ~(d.income_cap < income)

    idx = d.index[ok]

    if len(idx) == 0:
        return d.iloc[0:0][
            [
                "scheme_name",
                "level",
                "state",
                "benefit_type",
                "app_mode",
                "score",
                "source_url"
            ]
        ]

    s = d.loc[idx].copy()

    # -----------------------------
    # 1. TF-IDF semantic relevance
    # -----------------------------

    query_vector = vec.transform([need.lower()])

    sim = cosine_similarity(
        query_vector,
        M[idx]
    ).ravel()

    tfidf_score = np.clip(sim * 100, 0, 100)

    # -----------------------------
    # 2. Category ML prediction
    # -----------------------------

    predicted_category = category_model.predict(
        [need.lower()]
    )[0]

    category_match = (
        s["primary_category"]
        .fillna("")
        .astype(str)
        .str.lower()
        .eq(str(predicted_category).lower())
        .astype(float)
        .values
        * 100
    )

    # -----------------------------
    # 3. Benefit type ML prediction
    # -----------------------------

    predicted_benefit = benefit_model.predict(
        [need.lower()]
    )[0]

    benefit_match = (
        s["benefit_type"]
        .fillna("")
        .astype(str)
        .str.lower()
        .eq(str(predicted_benefit).lower())
        .astype(float)
        .values
        * 100
    )

    # -----------------------------
    # 4. Entrepreneur RF prediction
    # -----------------------------

    entrepreneur_score = (
        entrepreneur_probability(s) * 100
    )

    # -----------------------------
    # 5. Profile matching
    # -----------------------------

    profile_score = np.zeros(len(s))

    if social_cat == "SC" and "f_sc" in s:
        profile_score += s.f_sc.values * 100

    elif social_cat == "ST" and "f_st" in s:
        profile_score += s.f_st.values * 100

    elif social_cat == "OBC" and "f_obc" in s:
        profile_score += s.f_obc.values * 100

    if gender == "female" and "f_women" in s:
        profile_score += s.f_women.values * 100

    if minority and "f_minority" in s:
        profile_score += s.f_minority.values * 100

    if disability and "f_disability" in s:
        profile_score += s.f_disability.values * 100

    if bpl and "f_bpl" in s:
        profile_score += s.f_bpl.values * 100

    profile_score = np.clip(profile_score, 0, 100)

    # -----------------------------
    # Final ML recommendation score
    # -----------------------------

    final_score = (
        tfidf_score * 0.40
        + entrepreneur_score * 0.20
        + category_match * 0.15
        + benefit_match * 0.10
        + profile_score * 0.15
    )

    final_score = np.clip(final_score, 0, 100)

    out = s.assign(
        score=final_score,
        relevance=tfidf_score,
        predicted_category=predicted_category,
        predicted_benefit=predicted_benefit
    )

    out = (
        out
        .sort_values("score", ascending=False)
        .head(top)
    )

    out["score"] = out["score"].round(2)

    return out[
        [
            "scheme_name",
            "level",
            "state",
            "benefit_type",
            "app_mode",
            "score",
            "source_url"
        ]
    ]


if __name__ == "__main__":
    pass

