import pandas as pd, numpy as np, warnings, json; warnings.filterwarnings('ignore')
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import MultinomialNB, ComplementNB
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score,f1_score,roc_auc_score,classification_report
df=pd.read_csv('schemes_clean.csv')
res={}
# ---------- TASK A: structured -> is_entrepreneur_scheme ----------
cat=['level','benefit_type','app_mode','beneficiary_type']
numc=['faq_count','n_docs','n_tags','elig_len','benefit_len','age_min','age_max','income_cap','csc','has_exclusions','dbt_scheme']
fl=[c for c in df.columns if c.startswith('f_') and c!='f_msme']
X=df[cat+numc+fl].copy(); X['dbt_scheme']=X.dbt_scheme.astype(int); y=df.is_entrepreneur_scheme
Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=.2,stratify=y,random_state=42)
pre=ColumnTransformer([('c',OneHotEncoder(handle_unknown='ignore'),cat),('n',Pipeline([('i',SimpleImputer(strategy='median',add_indicator=True)),('s',StandardScaler())]),numc+fl)])
models={'Logistic Regression':LogisticRegression(max_iter=2000,class_weight='balanced'),
'Decision Tree':DecisionTreeClassifier(max_depth=8,class_weight='balanced',random_state=0),
'KNN':KNeighborsClassifier(15),
'Random Forest':RandomForestClassifier(400,class_weight='balanced',random_state=0,n_jobs=-1),
'Gradient Boosting':GradientBoostingClassifier(random_state=0),
'HistGradientBoosting':HistGradientBoostingClassifier(random_state=0)}
rowsA=[]; skf=StratifiedKFold(5,shuffle=True,random_state=1)
for n,m in models.items():
    p=Pipeline([('pre',pre),('m',m)]); p.fit(Xtr,ytr); pr=p.predict(Xte)
    pb=p.predict_proba(Xte)[:,1]
    cv=cross_val_score(p,X,y,cv=skf,scoring='f1').mean()
    rowsA.append(dict(model=n,accuracy=accuracy_score(yte,pr),f1=f1_score(yte,pr),roc_auc=roc_auc_score(yte,pb),cv_f1=cv))
A=pd.DataFrame(rowsA).round(3).sort_values('f1',ascending=False); print('TASK A baseline acc (majority)=',round(1-y.mean(),3)); print(A.to_string(index=False))
# feature importance (RF)
p=Pipeline([('pre',pre),('m',RandomForestClassifier(400,class_weight='balanced',random_state=0,n_jobs=-1))]).fit(Xtr,ytr)
names=list(p['pre'].get_feature_names_out()); imp=pd.Series(p['m'].feature_importances_,index=names).sort_values(ascending=False).head(12); print(imp.round(3).to_string())
# ---------- TASK B: text -> primary_category ----------
df['text']=(df.scheme_name+' '+df.tags+' '+df.brief_description+' '+df.eligibility+' '+df.benefits).str.lower()
top=df.primary_category.value_counts(); print(top.to_string())
yb=df.primary_category
tr,te=train_test_split(df.index,test_size=.2,stratify=yb,random_state=42)
tf=lambda: TfidfVectorizer(ngram_range=(1,2),min_df=3,max_df=.9,sublinear_tf=True,max_features=60000,stop_words='english')
mb={'Logistic Regression':LogisticRegression(max_iter=1000,C=10),
'Linear SVM':LinearSVC(C=0.5),
'Complement NB':ComplementNB(alpha=.3),
'Random Forest':RandomForestClassifier(300,random_state=0,n_jobs=-1)}
rowsB=[];best=None
for n,m in mb.items():
    p=Pipeline([('t',tf()),('m',m)]).fit(df.text[tr],yb[tr]); pr=p.predict(df.text[te])
    rowsB.append(dict(model=n,accuracy=accuracy_score(yb[te],pr),macro_f1=f1_score(yb[te],pr,average='macro'),weighted_f1=f1_score(yb[te],pr,average='weighted')))
    if n=='Linear SVM': print(classification_report(yb[te],pr,zero_division=0))
B=pd.DataFrame(rowsB).round(3).sort_values('accuracy',ascending=False); print('TASK B majority baseline=',round(top.iloc[0]/len(df),3)); print(B.to_string(index=False))
# ---------- TASK C: benefit_type from text+structured? (quick) ----------
yc=df.benefit_type
p=Pipeline([('t',tf()),('m',LogisticRegression(max_iter=1000,C=5,class_weight='balanced'))]).fit(df.text[tr],yc[tr]); pr=p.predict(df.text[te])
print('\nTASK C benefit_type acc',round(accuracy_score(yc[te],pr),3),'macroF1',round(f1_score(yc[te],pr,average='macro'),3),'baseline',round(yc.value_counts(normalize=True).iloc[0],3))
A.to_csv('ml_taskA.csv',index=False);B.to_csv('ml_taskB.csv',index=False)
