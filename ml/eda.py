import pandas as pd, numpy as np, matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt, seaborn as sns
from scipy import stats
df=pd.read_csv('schemes_clean.csv',parse_dates=['scheme_open_date','scheme_close_date'])
sns.set_theme(style='whitegrid')
num=['faq_count','n_docs','n_categories','elig_len','benefit_len','n_tags','age_min','age_max','income_cap']
print(df[num].describe().round(1).T.to_string())
print('\nskew\n',df[num].skew().round(2).to_string())
ent=df[df.is_entrepreneur_scheme==1]
print('\nEntrepreneur schemes',len(ent))
print(ent.level.value_counts().to_string()); print(ent.state.value_counts().head(10).to_string())
print(ent.benefit_type.value_counts(normalize=True).round(3).to_string())
print(ent.app_mode.value_counts(normalize=True).round(3).to_string())
fl=[c for c in df.columns if c.startswith('f_')]
print('\nflag rate entrepreneur vs others'); print(df.groupby('is_entrepreneur_scheme')[fl].mean().T.round(3).to_string())
# chi-square
print('\nChi2 (feature vs is_entrepreneur)')
for c in ['level','benefit_type','app_mode','beneficiary_type','dbt_scheme']+fl[:12]:
    ct=pd.crosstab(df[c],df.is_entrepreneur_scheme); chi,p,_,_=stats.chi2_contingency(ct)
    v=np.sqrt(chi/(ct.values.sum()*(min(ct.shape)-1)))
    print(f'{c:20s} chi2={chi:8.1f} p={p:.2e} cramersV={v:.3f}')
print('\nMann-Whitney')
for c in ['n_docs','faq_count','elig_len','benefit_len','n_tags']:
    a=ent[c];b=df[df.is_entrepreneur_scheme==0][c];u,p=stats.mannwhitneyu(a,b);print(f'{c:12s} med_ent={a.median():.0f} med_other={b.median():.0f} p={p:.2e}')
print('\nmissing %'); print((df.isna().mean()*100).round(1)[lambda s:s>0].to_string())
print('\ncorr'); print(df[num+['is_entrepreneur_scheme']].corr().round(2).to_string())
# plots
fig,ax=plt.subplots(2,3,figsize=(19,10))
df.categories.str.split('; ').explode().value_counts().sort_values().plot.barh(ax=ax[0,0],color='#2a6f97');ax[0,0].set_title('Schemes per category')
df.state.value_counts().head(15).sort_values().plot.barh(ax=ax[0,1],color='#468faf');ax[0,1].set_title('Top 15 states/UT (by scheme count)')
df.benefit_type.value_counts().plot.pie(ax=ax[0,2],autopct='%1.0f%%');ax[0,2].set_ylabel('');ax[0,2].set_title('Benefit type')
pd.crosstab(df.primary_category,df.is_entrepreneur_scheme).drop(columns=[],errors='ignore')
df.groupby('level').is_entrepreneur_scheme.mean().plot.bar(ax=ax[1,0],color='#e07a5f');ax[1,0].set_title('Share of entrepreneur schemes by level');ax[1,0].tick_params(axis='x',rotation=0)
fm=df[[c for c in fl if c in ['f_women','f_sc','f_st','f_obc','f_minority','f_disability','f_bpl','f_transgender','f_youth','f_artisan']]].sum().sort_values()
fm.plot.barh(ax=ax[1,1],color='#81b29a');ax[1,1].set_title('Marginalized-group mentions in eligibility')
df.income_cap.dropna().clip(upper=1e6).plot.hist(bins=30,ax=ax[1,2],color='#f2cc8f');ax[1,2].set_title('Income cap (₹, clipped at 10L)')
plt.tight_layout();plt.savefig('eda1.png',dpi=110);plt.close()
fig,ax=plt.subplots(1,3,figsize=(19,5.5))
sns.heatmap(df[num+['is_entrepreneur_scheme','is_marginalized_focus']].corr(),annot=True,fmt='.2f',cmap='coolwarm',ax=ax[0],cbar=False);ax[0].set_title('Correlation')
sns.boxplot(data=df,x='is_entrepreneur_scheme',y='n_docs',ax=ax[1],showfliers=False);ax[1].set_title('Docs required: entrepreneur vs other')
pd.crosstab(ent.state,ent.benefit_type).loc[ent.state.value_counts().head(10).index].plot.bar(stacked=True,ax=ax[2]);ax[2].set_title('Entrepreneur schemes: top states by benefit');plt.xticks(rotation=60,ha='right')
plt.tight_layout();plt.savefig('eda2.png',dpi=110)
