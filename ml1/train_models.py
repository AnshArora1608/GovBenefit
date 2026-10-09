"""Train and save the 3 models used by recommend.py.

Run once (and again whenever schemes_clean.csv changes):
    python train_models.py
"""
import os
import warnings

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import LinearSVC

warnings.filterwarnings("ignore")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
df = pd.read_csv(os.path.join(BASE_DIR, "schemes_clean.csv"))

# ---------------- A. is this an entrepreneur scheme? (structured) ----------------
cat = ["level", "benefit_type", "app_mode", "beneficiary_type"]
num = ["faq_count", "n_docs", "n_tags", "elig_len", "benefit_len",
       "age_min", "age_max", "income_cap", "csc", "has_exclusions", "dbt_scheme"]
flags = [c for c in df.columns if c.startswith("f_") and c != "f_msme"]

X = df[cat + num + flags].copy()
X["dbt_scheme"] = X["dbt_scheme"].astype(int)
y = df["is_entrepreneur_scheme"]

pre = ColumnTransformer([
    ("c", OneHotEncoder(handle_unknown="ignore"), cat),
    ("n", Pipeline([("i", SimpleImputer(strategy="median", add_indicator=True)),
                    ("s", StandardScaler())]), num + flags),
])
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
ent = Pipeline([("pre", pre),
                ("m", RandomForestClassifier(150, class_weight="balanced",
                                             random_state=0, n_jobs=-1))])
ent.fit(Xtr, ytr)
p = ent.predict(Xte)
print(f"[A] entrepreneur  acc={accuracy_score(yte, p):.3f}  f1={f1_score(yte, p):.3f}  "
      f"auc={roc_auc_score(yte, ent.predict_proba(Xte)[:, 1]):.3f}")
ent.fit(X, y)  # refit on all data for production
joblib.dump(ent, os.path.join(BASE_DIR, "entrepreneur_rf_model.pkl"))

# ---------------- text features (shared recipe) ----------------
df["text"] = (df.scheme_name.fillna("") + " " + df.tags.fillna("") + " "
              + df.brief_description.fillna("") + " " + df.eligibility.fillna("")
              + " " + df.benefits.fillna("")).str.lower()


def tfidf():
    return TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.9,
                           sublinear_tf=True, max_features=60000,
                           stop_words="english")


tr, te = train_test_split(df.index, test_size=0.2, stratify=df.primary_category, random_state=42)

# ---------------- B. need text -> primary_category ----------------
cat_model = Pipeline([("t", tfidf()), ("m", LinearSVC(C=0.5))])
cat_model.fit(df.text[tr], df.primary_category[tr])
p = cat_model.predict(df.text[te])
print(f"[B] category      acc={accuracy_score(df.primary_category[te], p):.3f}  "
      f"macroF1={f1_score(df.primary_category[te], p, average='macro'):.3f}")
cat_model.fit(df.text, df.primary_category)
joblib.dump(cat_model, os.path.join(BASE_DIR, "category_svm_model.pkl"))

# ---------------- C. need text -> benefit_type ----------------
ben_model = Pipeline([("t", tfidf()),
                      ("m", LogisticRegression(max_iter=1000, C=5, class_weight="balanced"))])
ben_model.fit(df.text[tr], df.benefit_type[tr])
p = ben_model.predict(df.text[te])
print(f"[C] benefit_type  acc={accuracy_score(df.benefit_type[te], p):.3f}  "
      f"macroF1={f1_score(df.benefit_type[te], p, average='macro'):.3f}")
ben_model.fit(df.text, df.benefit_type)
joblib.dump(ben_model, os.path.join(BASE_DIR, "benefit_type_model.pkl"))

print("saved 3 models")
