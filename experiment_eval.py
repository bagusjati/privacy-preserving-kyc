"""Evaluation script for the PeerJ Computer Science manuscript
"Privacy-preserving know your customer process for decentralized finance
on permissioned blockchain".

Dataset: Farrugia et al., Expert Systems with Applications 150 (2020) 113318.
Source : https://github.com/sfarrugia15/Ethereum_Fraud_Detection
         (Account_Stats/Complete.csv, 4,681 records)

Reported results were produced with scikit-learn 1.8.0 and XGBoost 3.2.0.
Small differences in the holdout confusion matrix can occur under other
library versions.

Protocol (seed 42):
  1. Deduplicate by Address (5 duplicates) -> 4,676 accounts
     (2,179 illicit / 2,497 licit).
  2. Drop Index, Address, FLAG, and the two categorical token type
     attributes -> 45 numeric features. Fill NaN (no token activity) with 0.
  3. Repeated stratified 5-fold CV x 10 repetitions (50 folds):
     accuracy, macro F1, ROC AUC, PR AUC as mean +/- SD.
  4. Nested check: grid search embedded in each training fold
     (outer 5-fold x 3 repetitions, inner 3-fold).
  5. Stratified 86/14 holdout for the confusion matrix and per-class
     metrics of the selected XGBoost model.
"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import (RepeatedStratifiedKFold, GridSearchCV,
                                     cross_validate, train_test_split)
from sklearn.metrics import (accuracy_score, roc_auc_score,
                             average_precision_score, confusion_matrix,
                             classification_report)
from xgboost import XGBClassifier

SEED = 42
CSV = "Ethereum_Fraud_Detection/Account_Stats/Complete.csv"

df = pd.read_csv(CSV).drop_duplicates(subset="Address").reset_index(drop=True)
y = df["FLAG"].values
X = df.drop(columns=["Index", "Address", "FLAG",
                     "ERC20_most_sent_token_type",
                     "ERC20_most_rec_token_type"]).fillna(0)
print(f"accounts={len(y)} illicit={y.sum()} licit={(y==0).sum()} "
      f"features={X.shape[1]}")

rf = RandomForestClassifier(n_estimators=500, max_depth=20,
                            min_samples_split=5, min_samples_leaf=1,
                            bootstrap=False, random_state=SEED, n_jobs=-1)
xgb = XGBClassifier(n_estimators=500, max_depth=3, learning_rate=0.1,
                    min_child_weight=5, colsample_bytree=0.7, gamma=0,
                    reg_alpha=0, reg_lambda=1, eval_metric="logloss",
                    random_state=SEED, n_jobs=-1, tree_method="hist")

# --- 1) Repeated stratified CV with fixed hyperparameters ---
cv = RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=SEED)
scoring = {"acc": "accuracy", "f1m": "f1_macro",
           "roc": "roc_auc", "pr": "average_precision"}
for name, model in [("Random forest", rf), ("XGBoost", xgb)]:
    r = cross_validate(model, X, y, cv=cv, scoring=scoring, n_jobs=-1)
    print(name, {k: f"{r['test_'+k].mean():.4f}+/-{r['test_'+k].std():.4f}"
                 for k in scoring})

# --- 2) Nested CV (selection leakage check) ---
outer = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=SEED)
xgb_gs = GridSearchCV(
    XGBClassifier(learning_rate=0.1, min_child_weight=5, colsample_bytree=0.7,
                  eval_metric="logloss", random_state=SEED, n_jobs=-1,
                  tree_method="hist"),
    {"max_depth": [3, 5, 7], "n_estimators": [300, 500]},
    cv=3, scoring="accuracy", n_jobs=1)
r = cross_validate(xgb_gs, X, y, cv=outer, scoring="accuracy", n_jobs=1)
print(f"XGB nested: acc {r['test_score'].mean():.4f}"
      f"+/-{r['test_score'].std():.4f}")
rf_gs = GridSearchCV(
    RandomForestClassifier(min_samples_split=5, min_samples_leaf=1,
                           bootstrap=False, random_state=SEED, n_jobs=-1),
    {"max_depth": [10, 20, None], "n_estimators": [300]},
    cv=3, scoring="accuracy", n_jobs=1)
r = cross_validate(rf_gs, X, y, cv=outer, scoring="accuracy", n_jobs=1)
print(f"RF nested:  acc {r['test_score'].mean():.4f}"
      f"+/-{r['test_score'].std():.4f}")

# --- 3) Holdout for confusion matrix and per-class metrics ---
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.14,
                                      stratify=y, random_state=SEED)
xgb.fit(Xtr, ytr)
proba = xgb.predict_proba(Xte)[:, 1]
pred = (proba >= 0.5).astype(int)
print(f"holdout n={len(yte)} acc={accuracy_score(yte, pred):.4f} "
      f"roc={roc_auc_score(yte, proba):.4f} "
      f"pr={average_precision_score(yte, proba):.4f}")
print(confusion_matrix(yte, pred))
print(classification_report(yte, pred, target_names=["Normal", "Illicit"],
                            digits=2))

# --- 4) Performance figures of the manuscript (Figs. 4-7) ---
# Per-fold scores for the metric distributions, the holdout ROC/PR/confusion
# matrix, the threshold sweep, and the gain-based attribute importances.
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
from sklearn.metrics import precision_recall_curve, roc_curve

BLUE, ORANGE = "#1f77b4", "#ff7f0e"
plt.rcParams.update({"font.size": 11, "axes.grid": True, "grid.alpha": 0.3})

folds = {}
for name, model in [("rf", rf), ("xgb", xgb)]:
    r = cross_validate(model, X, y, cv=cv, scoring=scoring, n_jobs=-1)
    folds[name] = {k: r["test_" + k] for k in scoring}

metrics = [("acc", "Accuracy"), ("f1m", "Macro F1 score"),
           ("roc", "ROC AUC"), ("pr", "PR AUC")]
fig, ax = plt.subplots(figsize=(8, 4.2))
data, pos, colors = [], [], []
for i, (k, _) in enumerate(metrics):
    data += [folds["rf"][k], folds["xgb"][k]]
    pos += [i * 3 + 1, i * 3 + 1.9]
    colors += [ORANGE, BLUE]
bp = ax.boxplot(data, positions=pos, widths=0.7, patch_artist=True,
                medianprops=dict(color="black"))
for patch, c in zip(bp["boxes"], colors):
    patch.set_facecolor(c); patch.set_alpha(0.75)
ax.set_xticks([i * 3 + 1.45 for i in range(4)])
ax.set_xticklabels([lab for _, lab in metrics])
ax.set_ylabel("Score over fifty folds"); ax.set_ylim(0.93, 1.002)
ax.legend(handles=[Patch(facecolor=ORANGE, alpha=0.75, label="Random forest"),
                   Patch(facecolor=BLUE, alpha=0.75, label="XGBoost")],
          loc="lower right")
fig.tight_layout(); fig.savefig("fig6.png", dpi=300); plt.close(fig)

fpr, tpr, _ = roc_curve(yte, proba)
prec, rec, _ = precision_recall_curve(yte, proba)
ap = average_precision_score(yte, proba)
cm = confusion_matrix(yte, pred)
fig, axes = plt.subplots(1, 3, figsize=(15, 4.4))
axA, axB, axC = axes
axA.plot(fpr, tpr, color=BLUE, lw=2, label="XGBoost (AUC = 0.994)")
axA.plot([0, 1], [0, 1], ls="--", color="gray", lw=1)
axA.set_xlabel("False positive rate"); axA.set_ylabel("True positive rate")
axA.legend(loc="lower right")
axB.plot(rec, prec, color=BLUE, lw=2, label=f"XGBoost (AP = {ap:.3f})")
axB.set_xlabel("Recall"); axB.set_ylabel("Precision"); axB.set_ylim(0.5, 1.02)
axB.legend(loc="lower left")
im = axC.imshow(cm, cmap="Blues"); axC.grid(False)
for (i, j), v in np.ndenumerate(cm):
    axC.text(j, i, str(v), ha="center", va="center", fontsize=14,
             color="white" if v > cm.max() / 2 else "black")
axC.set_xticks([0, 1]); axC.set_xticklabels(["Normal", "Illicit"])
axC.set_yticks([0, 1]); axC.set_yticklabels(["Normal", "Illicit"])
axC.set_xlabel("Predicted label"); axC.set_ylabel("True label")
fig.colorbar(im, ax=axC, fraction=0.046, pad=0.04)
for axx, lab in zip(axes, ["A", "B", "C"]):
    axx.text(-0.12, 1.06, lab, transform=axx.transAxes,
             fontsize=16, fontweight="bold")
fig.tight_layout(); fig.savefig("fig3.png", dpi=300); plt.close(fig)

ts = np.linspace(0.02, 0.98, 97)
fps = [((proba >= t) & (yte == 0)).sum() for t in ts]
fns = [((proba < t) & (yte == 1)).sum() for t in ts]
fig, ax = plt.subplots(figsize=(6.4, 4.2))
ax.plot(ts, fps, color=ORANGE, lw=2, label="False positives")
ax.plot(ts, fns, color=BLUE, lw=2, label="False negatives")
ax.axvline(0.5, ls="--", color="gray", lw=1)
ax.text(0.505, max(fps) * 0.9, "default threshold", rotation=90,
        va="top", fontsize=9, color="gray")
ax.set_xlabel("Decision threshold")
ax.set_ylabel("Errors on the holdout split")
ax.legend(loc="upper center")
fig.tight_layout(); fig.savefig("fig7.png", dpi=300); plt.close(fig)

gain = xgb.get_booster().get_score(importance_type="gain")
feat_names = list(X.columns)
gain_named = {feat_names[int(k[1:])]: v for k, v in gain.items()}
top = sorted(gain_named.items(), key=lambda kv: -kv[1])[:15][::-1]
names = [n.replace("_", " ")
          .replace("(including tnx to create contract)",
                   "(incl. contract creation)").strip() for n, _ in top]
vals = [v for _, v in top]
fig, ax = plt.subplots(figsize=(7.5, 5))
ax.barh(range(len(vals)), vals, color=BLUE, alpha=0.85, height=0.65)
ax.set_yticks(range(len(vals))); ax.set_yticklabels(names, fontsize=9)
ax.set_xlabel("Average gain"); ax.grid(axis="y", alpha=0)
fig.tight_layout(); fig.savefig("fig8.png", dpi=300); plt.close(fig)
print("figures written: fig3.png fig6.png fig7.png fig8.png")
