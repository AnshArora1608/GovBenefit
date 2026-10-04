import pandas as pd, numpy as np, re
df=pd.read_csv('/mnt/user-data/uploads/schemes.csv')
TODAY=pd.Timestamp('2026-10-04')
log=[]
n0=len(df)
# 1 strip whitespace
for c in df.select_dtypes('object').columns.tolist()+[c for c in df.columns if str(df[c].dtype)=='str']:
    df[c]=df[c].astype('string').str.strip().replace('',pd.NA)
# 2 duplicates
d=df.duplicated(['scheme_name','state'],keep='first'); log.append(('duplicate name+state removed',int(d.sum()))); df=df[~d]
# 3 level / state
df['level']=df['level'].replace({'State/ UT':'State'})
df['state']=df['state'].fillna('All India (Central)')
# 4 beneficiary
df['beneficiary_type']=df['beneficiary_type'].fillna('Unknown')
df['target_beneficiaries']=df['target_beneficiaries'].fillna('Unknown')
# 5 application mode
def mode(s):
    s=str(s); on='Online' in s; off='Offline' in s
    return 'Both' if on and off else 'Online' if on else 'Offline'
df['app_mode']=df.application_mode.map(mode)
df['csc']=df.application_mode.str.contains('CSC',na=False).astype(int)
# 6 dates
for c in ['scheme_open_date','scheme_close_date']: df[c]=pd.to_datetime(df[c],errors='coerce')
log.append(('close_date==2020-01-01 placeholder-like',int((df.scheme_close_date=='2020-01-01').sum())))
df['is_expired']=(df.scheme_close_date<TODAY).astype(int)
df['has_close_date']=df.scheme_close_date.notna().astype(int)
# 7 text fills
for c in ['benefits','application_process','documents_required','exclusions','sub_categories','department','ministry','references']:
    df[c]=df[c].fillna('Not specified')
df['n_docs']=df.documents_required.map(lambda s:0 if s=='Not specified' else len(s.split(';')))
df['has_exclusions']=(df.exclusions!='Not specified').astype(int)
df['n_categories']=df.categories.str.count(';')+1
df['elig_len']=df.eligibility.str.len()
df['benefit_len']=df.benefits.str.len()
df['n_tags']=df.tags.str.count(';')+1
# 8 eligibility feature extraction (regex on eligibility + target text)
E=(df.eligibility.fillna('')+' '+df.tags.fillna('')+' '+df.brief_description.fillna(''))
def has(p,flags=0): return E.str.contains(p,flags=flags,regex=True).astype(int)
df['f_women']=has(r'\b(women|woman|female|girl|widow|mahila)\b',re.I)
df['f_sc']=has(r'\bSC\b|Scheduled Castes?|\bSC/ST\b|\bSCs\b')
df['f_st']=has(r'\bST\b|Scheduled Tribes?|\bSTs\b|tribal')
df['f_obc']=has(r'\bOBC\b|Backward Class|\bBC\b|\bEBC\b|\bMBC\b')
df['f_minority']=has(r'minorit|Muslim|Christian|Sikh|Buddhist|Jain|Parsi',re.I)
df['f_disability']=has(r'disab|divyang|handicap|blind|differently abled',re.I)
df['f_bpl']=has(r'\bBPL\b|below poverty|poverty line|\bEWS\b|economically weaker',re.I)
df['f_transgender']=has(r'transgender',re.I)
df['f_youth']=has(r'\byouth|young\b|unemployed',re.I)
df['f_farmer']=has(r'farmer|agricultur|cultivat',re.I)
df['f_artisan']=has(r'artisan|weaver|handloom|handicraft|craft',re.I)
df['f_student']=has(r'\bstudent|scholarship',re.I)
df['f_msme']=has(r'\bMSME|micro|small enterprise|startup|start-up|entrepreneur|self.employ|enterprise',re.I)
df['f_ex_serviceman']=has(r'ex-?servicem|veteran|defence',re.I)
df['f_senior']=has(r'senior citizen|old age|elderly',re.I)
df['f_resident']=has(r'resident of|domicile',re.I)
df['f_aadhaar']=df.documents_required.str.contains('Aadhaar',case=False).astype(int)
df['f_caste_cert']=df.documents_required.str.contains('caste|community certificate',case=False).astype(int)
df['f_income_cert']=df.documents_required.str.contains('income certificate',case=False).astype(int)
df['f_bank']=df.documents_required.str.contains('bank',case=False).astype(int)
# age
def age(t):
    t=str(t); mn=mx=np.nan
    m=re.search(r'(?:between|aged?)\s*(\d{2})\s*(?:and|to|-|–)\s*(\d{2})',t,re.I)
    if m: mn,mx=int(m[1]),int(m[2])
    else:
        m=re.search(r'(?:above|minimum age of|at least|not less than|over|atleast)\s*(\d{2})\s*years',t,re.I)
        if m: mn=int(m[1])
        m=re.search(r'(?:below|under|not exceed(?:ing)?|maximum age of|up to|not more than|less than)\s*(\d{2})\s*years',t,re.I)
        if m: mx=int(m[1])
    return pd.Series([mn,mx])
df[['age_min','age_max']]=df.eligibility.apply(age)
# income cap (annual, rupees)
def income(t):
    t=str(t).replace(',','')
    m=re.search(r'income[^.]{0,120}?(?:not exceed|below|less than|up to|under|within|does not exceed|not more than|should not be more than)[^0-9₹Rs]{0,30}(?:₹|Rs\.?|INR)?\s*(\d+(?:\.\d+)?)\s*(lakh|lakhs|crore)?',t,re.I)
    if not m: return np.nan
    v=float(m[1]); u=(m[2] or '').lower()
    v = v*1e5 if u.startswith('lakh') else v*1e7 if u=='crore' else v
    return v if 1000<=v<=5e7 else np.nan
df['income_cap']=df.eligibility.apply(income)
# entrepreneur flag
ent=df.categories.str.contains('Business & Entrepreneurship',na=False)|df.target_beneficiaries.str.contains('Business Entity|Industries|Startup|Self Help',case=False,na=False)
df['is_entrepreneur_scheme']=ent.astype(int)
df['is_marginalized_focus']=((df[['f_women','f_sc','f_st','f_obc','f_minority','f_disability','f_bpl','f_transgender']].sum(axis=1))>0).astype(int)
df['primary_category']=df.categories.str.split('; ').str[0]
log.append(('rows before',n0)); log.append(('rows after',len(df)))
df.to_csv('schemes_clean.csv',index=False)
print(log)
print(df[['age_min','age_max','income_cap']].notna().sum())
print(df[[c for c in df.columns if c.startswith('f_')]+['is_entrepreneur_scheme','is_marginalized_focus','is_expired']].mean().round(3))
print(df.income_cap.describe()); print(df.age_min.value_counts().head()); print(df.age_max.value_counts().head())
print(df.groupby('is_entrepreneur_scheme').size())
print(pd.crosstab(df.is_entrepreneur_scheme,df.is_marginalized_focus))
