# GovBenefit 🇮🇳

> **AI-Powered Government Schemes Discovery & Eligibility Platform**  
> Helping citizens navigate, discover, and track government schemes personalized to their profile, needs, and language.

---

## 📌 Overview

**GovBenefit** is a full-stack platform that matches Indian citizens with relevant central and state government schemes. By combining demographic criteria, income ceilings, natural language understanding (supporting **English**, **Hindi**, and **Hinglish**), and machine learning, GovBenefit removes bureaucratic friction and makes public welfare programs easily accessible.

---

## ✨ Key Features

- **🎯 Personalized Eligibility Matching**  
  Considers user demographics including State/UT, age, annual household income, gender, social category (General, OBC, SC, ST), minority status, disability/Divyang status, and BPL cardholder status.

- **🎙️ Voice & Multilingual Need Querying**
  - Voice-to-text dictation via the Web Speech API in both English and Hindi.
  - Native bilingual keyword expansion mapping colloquial Hindi/Hinglish terms (e.g., _loan_, _karz_, _dhandha_, _kisan_, _awas_, _chhatravriti_) into domain terms used by the recommender.

- **🤖 Hybrid Machine Learning Engine**
  - **TF-IDF + Cosine Similarity**: Ranks scheme descriptions, eligibility criteria, and benefits against citizen requirements.
  - **Pre-trained ML Classifiers**: Classifies entrepreneurship schemes (Random Forest), primary scheme categories (Linear SVM), and benefit types (Logistic Regression).
  - Scaled relevance scoring displayed transparently for each matched scheme.

- **📋 Master Document Aggregator**  
  Extracts and normalizes document requirements across schemes into canonical categories (Aadhaar Card, PAN Card, Income Certificate, Caste Certificate, Domicile, Bank Account Details, etc.) and provides a consolidated **Master Documents Checklist**.

- **⏳ Deadlines & Timeline Tracking**  
  Analyzes application windows to highlight **Closing Soon** warnings (within 15 days), active application dates, and year-round/perpetual schemes.

- **🔔 Wishlist & Live Portal Watcher**
  - Save and bookmark schemes to a local wishlist.
  - Automated background crawler monitors official government scheme pages for new circulars, guidelines, amendments, and notifications using Cheerio.
  - Email notification subscription powered by Nodemailer.

- **🛡️ GovBenefit Form Mentor (Browser Extension & Service)**
  - Injected assistant that explains complex government application form fields, required formats, and reasons in plain language.
  - Plain-language breakdown of confusing dropdown options (e.g. _KVIC vs KVIB vs DIC_ agency selection, legal constitution, special subsidy categories).
  - Matches the citizen's saved profile and provides safe, user-confirmed `[Use this]` autofilling.
  - **Strict Human-Action Guardrails**: Explicitly prevents automated interception of sensitive steps (CAPTCHA, OTP, legal declarations, final submission).
  - Includes a full high-fidelity PMEGP Application Form Sandbox (`/government-portal/pmegp-application`).

---

## 🏗️ Architecture & Project Structure

```text
GovBenefit/
├── controllers/
│   ├── mentorController.js          # Form Mentor inspection, contextual Q&A, and mock portal
│   ├── profileController.js         # Handles profile collection, JSON persistence, and dashboard
│   └── recommendationController.js  # Orchestrates form parsing, ML scoring, and views
├── data/
│   ├── knowledge/
│   │   └── pmegp_form.json          # Form rules, option meanings & guidance for PMEGP
│   ├── profiles.json                # Stored citizen profiles and scheme applications (JSON)
│   └── watch.json                   # Monitored scheme URLs, content hashes, and subscribers
├── extension/                       # Chrome Extension (Manifest V3)
│   ├── background.js                # Extension service worker
│   ├── content.js                   # DOM form inspector & injected assistant script
│   ├── manifest.json                # Manifest V3 extension configuration
│   ├── mentor.css                   # Floating assistant styling & highlight classes
│   ├── popup.html                   # Extension toolbar popup
│   └── popup.js                     # Popup script displaying connection & profile info
├── routes/
│   ├── mentorRoutes.js              # Routes for Mentor inspection APIs and Sandbox portal
│   ├── profileRoutes.js             # Routes for profile data collection and dashboard
│   ├── recommendationRoutes.js      # Routes for recommendation form and submission
│   └── wishlist.js                  # Routes for wishlist and portal watcher API
├── services/
│   ├── dateservice.js               # Application date normalization and deadline alerts
│   ├── documentService.js           # Required documents parser and master checklist builder
│   ├── mentorService.js             # Form Mentor engine, boundary checks & contextual Q&A
│   ├── needTranslator.js            # Hindi / Hinglish colloquial lexicon translator
│   ├── profileMapper.js             # DOM form inputs to GovBenefit profile mapping engine
│   ├── profileService.js            # JSON persistence service for citizen profiles
│   ├── python_services.js           # Subprocess wrapper executing Python ML scripts
│   └── watcher.js                   # Web change watcher and notification service
├── views/
│   ├── dashboard.ejs                # Citizen dashboard showing saved profile and applied schemes
│   ├── mock_pmegp_form.ejs          # Official PMEGP application form sandbox for Form Mentor
│   ├── profile.ejs                  # Multi-fieldset profile collection form with Save Details
│   ├── recommendation.ejs           # Main eligibility input form with voice search
│   ├── recommendations.ejs          # Ranked recommendations results page (with View & apply)
│   └── wishlist.ejs                 # Saved schemes, portal updates, and email alerts
├── .gitignore                       # Git ignored files and directories
├── index.js                         # Express application entrypoint
├── package.json                     # Node.js project manifest and dependencies
└── requirements.txt                 # Python dependencies for the ML recommender
```

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js** (v18.x or later) & **npm**
- **Python** (v3.10 to v3.13) with `pip`
- Git

### 2. Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/GovBenefit.git
   cd GovBenefit
   ```

2. **Install Node.js dependencies:**

   ```bash
   npm install
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

### 3. Environment Variables (Optional)

Create a `.env` file in the project root if you wish to configure the server port or email notifications:

```env
PORT=8000

# Optional: Email credentials for scheme watcher notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
```

### 4. Running the Application

- **Development Mode (with auto-reload):**

  ```bash
  npm run dev
  ```

- **Production Mode:**
  ```bash
  npm start
  ```

Once started, open your browser and navigate to:  
👉 **`http://localhost:8000`**

---

## 📡 Routes & API Endpoints

| Method | Endpoint                               | Description                                                         |
| :----- | :------------------------------------- | :------------------------------------------------------------------ |
| `GET`  | `/`                                    | Renders the citizen recommendation form                             |
| `GET`  | `/recommend`                           | Displays the recommendation form                                    |
| `POST` | `/recommend`                           | Processes citizen input and returns matched schemes                 |
| `GET`  | `/profile`                             | Profile data collection form (structured in multi-fieldsets)        |
| `POST` | `/profile`                             | Saves profile details to JSON file and redirects to `/dashboard`    |
| `GET`  | `/dashboard`                           | Citizen dashboard displaying saved profile & applied scheme records |
| `GET`  | `/api/profile/export`                  | Download/export saved citizen profile in JSON format                |
| `POST` | `/api/mentor/inspect-field`            | Inspects form field, returns plain explanation & profile autofill   |
| `POST` | `/api/mentor/ask`                      | Contextual AI Q&A answering citizen questions on form fields        |
| `GET`  | `/api/mentor/profile`                  | Retrieves active citizen profile for browser extension              |
| `GET`  | `/api/mentor/knowledge/:id`            | Returns structured knowledge & option dictionary for scheme form    |
| `GET`  | `/government-portal/pmegp-application` | High-fidelity PMEGP Application Form Sandbox with live Mentor       |
| `GET`  | `/wishlist`                            | View bookmarked schemes and official portal updates                 |
| `POST` | `/api/wishlist/status`                 | Fetches live change/circular status for watched scheme URLs         |
| `POST` | `/api/wishlist/subscribe`              | Subscribes an email to receive circular updates for saved schemes   |

---

## 🧠 How the Recommendation Engine Works

1. **Profile Normalization**: Citizen inputs (age, income, state, caste category, minority, disability, BPL) are validated and formatted.
2. **Bilingual Need Translation**: If the citizen expresses their need in Hindi or Hinglish (typed or voice-transcribed), `needTranslator.js` identifies key domain intents and enriches the search text.
3. **Hard Eligibility Filtering**: Schemes strictly requiring other states, outside age bounds, or exceeding income caps are filtered out.
4. **Content Vectorization & Similarity**: Scheme benefits, criteria, and tags are vectorized via TF-IDF (unigrams and bigrams). Cosine similarity measures closeness to the citizen's need.
5. **Classifiers & Prioritization**: Pre-trained Random Forest and SVM models tag schemes with probability indicators (e.g., MSME/entrepreneurship focus) to adjust ranking.
6. **Enrichment**: Matching schemes receive canonical document checklists from `documentService.js` and active deadline statuses from `dateservice.js`.

---

## 🛡️ License & Disclaimer

- **Disclaimer**: Scheme details, eligibility criteria, and application links are gathered from public domain sources. Citizens should always verify information on official government portals before applying.
- **License**: Released under the ISC License.
