const path = require("path");
const { getRecommendations } = require("../services/python_services");
const { loadDocsLookup, attachDocuments } = require("../services/documentService");
const { loadDatesLookup, attachDates } = require("../services/dateService");

// Absolute path, so it works no matter which folder the server is started from
const CSV_PATH = path.join(__dirname, "..", "ml", "schemes_clean.csv");

// "always": only entrepreneur schemes for every user (your current behaviour)
// "auto"  : only when the user's need talks about business, loan, startup, etc.
const ENTREPRENEUR_MODE = "always";
const BUSINESS_WORDS = /business|startup|start-up|entrepreneur|self.?employ|msme|enterprise|shop|udyam|loan|व्यापार|कारोबार|स्वरोजगार|उद्यम|दुकान/i;

// Load CSV data once. If the file is missing, the app still starts (documents / dates will be empty)
function safeLoad(loader, label) {
    try {
        return loader(CSV_PATH);
    } catch (e) {
        console.error(`[${label}] Could not load ${CSV_PATH}: ${e.message}`);
        return new Map();
    }
}
const docsLookup = safeLoad(loadDocsLookup, "documents");
const datesLookup = safeLoad(loadDatesLookup, "dates");

function parseForm(body) {
    const need = String(body.need || "").trim();
    const age = Number(body.age);
    const income = Number(body.income);

    if (!body.state || !body.gender || !need) {
        return { error: "Please fill in all the required fields." };
    }
    if (!Number.isFinite(age) || age < 1 || age > 100) {
        return { error: "Please enter a valid age between 1 and 100." };
    }
    if (body.income === "" || !Number.isFinite(income) || income < 0) {
        return { error: "Please enter a valid annual family income." };
    }

    return {
        data: {
            state: body.state,
            gender: body.gender,
            social_cat: body.social_cat,
            minority: body.minority === "true",
            disability: body.disability === "true",
            bpl: body.bpl === "true",
            age,
            income,
            need,
            top: 10,
            entrepreneur_only: ENTREPRENEUR_MODE === "always" ? true : BUSINESS_WORDS.test(need)
        }
    };
}

// Python may return an array or an object like { recommendations: [...] }
function toList(result) {
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.recommendations)) return result.recommendations;
    if (result && Array.isArray(result.results)) return result.results;
    return [];
}

// The page expects score as 0 to 100. If Python sends 0 to 1, convert it.
function normaliseScores(list) {
    const max = Math.max(0, ...list.map(s => Number(s.score) || 0));
    if (max > 0 && max <= 1) {
        return list.map(s => Object.assign({}, s, { score: (Number(s.score) || 0) * 100 }));
    }
    return list;
}

const showRecommendationForm = (req, res) => {
    res.render("recommendation", { error: null });
};

const getRecommendationsController = async (req, res) => {
    const parsed = parseForm(req.body || {});
    if (parsed.error) {
        return res.status(400).render("recommendation", { error: parsed.error });
    }

    try {
        console.log("Form Data:", parsed.data);

        // 1. Recommendations from Python
        const result = await getRecommendations(parsed.data);
        if (result && result.error) {
            console.error("Python error:", result.error);
            return res.status(502).render("recommendation", {
                error: "The recommendation engine is not responding right now. Please try again."
            });
        }
        const list = normaliseScores(toList(result));

        // 2. Documents (from dataset + user's profile), then start / end dates
        const withDocs = attachDocuments(list, req.body, docsLookup);
        const schemes = attachDates(withDocs.schemes, datesLookup);

        console.log(
            `Schemes: ${schemes.length} | with documents: ${schemes.filter(s => !s.docs_fallback).length}` +
            ` | with end date: ${schemes.filter(s => s.end_date).length}`
        );

        return res.render("recommendations", {
            recommendations: schemes,
            master_docs: withDocs.master,
            profile: req.body
        });

    } catch (error) {
        console.error("Recommendation Error:", error);
        return res.status(500).render("recommendation", {
            error: "Something went wrong while finding schemes. Please try again."
        });
    }
};

module.exports = {
    showRecommendationForm,
    getRecommendationsController
};