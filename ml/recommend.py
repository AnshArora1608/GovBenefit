"""Scheme recommender: hard filters (state/age/income/expiry) + soft boosts (marginalized group match) + TF-IDF relevance."""
import os
import pandas as pd, numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "schemes_clean.csv")
df = pd.read_csv(CSV_PATH)
df['women_only']=(df.scheme_name.str.contains(r'women only|for women|mahila|swarnima|\bwomen\b',case=False,regex=True)|df.eligibility.str.contains(r'must be a (?:woman|female)|should be a (?:woman|female)|only (?:women|female)|women only',case=False,regex=True)).astype(int)
df['text']=(df.scheme_name+' '+df.tags+' '+df.brief_description+' '+df.eligibility+' '+df.benefits).str.lower()
vec=TfidfVectorizer(ngram_range=(1,2),min_df=2,sublinear_tf=True,stop_words='english'); M=vec.fit_transform(df.text)
def recommend(state,gender,social_cat,minority=False,disability=False,bpl=False,age=30,income=200000,need='loan subsidy to start small business',top=10,entrepreneur_only=True):
    d=df.copy()
    ok=(d.level=='Central')|(d.state==state)
    ok&=d.is_expired==0
    if entrepreneur_only: ok&=d.is_entrepreneur_scheme==1
    if gender!='female': ok&=d.women_only==0
    ok&=~(d.age_min>age)&~(d.age_max<age)            # explicit age rules
    ok&=~(d.income_cap<income)                        # explicit income cap
    idx=d.index[ok]
    sim=cosine_similarity(vec.transform([need.lower()]),M[idx]).ravel()
    boost=np.zeros(len(idx)); s=d.loc[idx]
    boost+=0.10*(s.f_women.values*(gender=='female'))
    boost+=0.10*(s.f_sc.values*(social_cat=='SC'))+0.10*(s.f_st.values*(social_cat=='ST'))+0.10*(s.f_obc.values*(social_cat=='OBC'))
    boost+=0.10*(s.f_minority.values*minority)+0.10*(s.f_disability.values*disability)+0.05*(s.f_bpl.values*bpl)
    boost+=0.03*(s.dbt_scheme.values)                  # direct cash benefit
    out=s.assign(score=sim+boost,relevance=sim).sort_values('score',ascending=False).head(top)
    return out[['scheme_name','level','state','benefit_type','app_mode','score','source_url']]
if __name__=='__main__':
    pass

