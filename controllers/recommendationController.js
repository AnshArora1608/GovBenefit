
const fs = require("fs");
const path = require("path");

const { getRecommendations } = require("../services/python_services");
const {
    loadDocsLookup,
    attachDocuments
} = require("../services/documentService");
const {
    loadDatesLookup,
    attachDates
} = require("../services/dateService");
const { expandNeed } = require("../services/needTranslator");

const DATA_PATHS = [
    path.resolve(__dirname, "..", "ml1", "schemes_clean.csv"),
    path.resolve(__dirname, "..", "ml", "schemes_clean.csv")
];

const CSV_PATH = DATA_PATHS.find(file => fs.existsSync(file));

const ENTREPRENEUR_MODE = "auto";

const BUSINESS_WORDS =
    /business|startup|start-up|entrepreneur|self.?employ|msme|enterprise|shop|udyam|loan|व्यापार|कारोबार|स्वरोजगार|उद्यम|दुकान/i;

function safeLoad(loader, label) {
    if (!CSV_PATH) {
        console.error(
            `[${label}] schemes_clean.csv not found in ml1 or ml.`
        );
        return new Map();
    }

    try {
        return loader(CSV_PATH) || new Map();
    } catch (error) {
        console.error(
            `[${label}] Failed to load CSV: ${error.message}`
        );
        return new Map();
    }
}

const docsLookup = safeLoad(loadDocsLookup, "Documents");
const datesLookup = safeLoad(loadDatesLookup, "Dates");

function parseBoolean(value) {
    if (typeof value === "boolean") return value;

    return ["true", "1", "yes", "on"].includes(
        String(value ?? "").trim().toLowerCase()
    );
}

function parseForm(body) {
    const state = String(body.state || "").trim();
    const gender = String(body.gender || "").trim();
    const need = String(body.need || "").trim();

    const age = Number(body.age);
    const income = Number(body.income);

    if (!state || !gender || !need) {
        return {
            error: "Please fill in all required fields."
        };
    }

    if (!Number.isFinite(age) || age < 1 || age > 100) {
        return {
            error: "Please enter a valid age between 1 and 100."
        };
    }

    if (
        body.income === undefined ||
        String(body.income).trim() === "" ||
        !Number.isFinite(income) ||
        income < 0
    ) {
        return {
            error: "Please enter a valid annual family income."
        };
    }

    let expanded;

    try {
        expanded = expandNeed(need);
    } catch (error) {
        console.error("Need translation error:", error.message);

        return {
            error: "Unable to process your requirement. Please try again."
        };
    }

    if (!expanded || typeof expanded.text !== "string") {
        return {
            error: "Unable to understand your requirement. Please rephrase it."
        };
    }

    const entrepreneurOnly =
        ENTREPRENEUR_MODE === "always" ||
        (
            ENTREPRENEUR_MODE === "auto" &&
            BUSINESS_WORDS.test(need)
        );

    return {
        keywords: expanded.keywords || [],

        data: {
            state,
            gender,
            social_cat: String(body.social_cat || "General").trim(),
            minority: parseBoolean(body.minority),
            disability: parseBoolean(body.disability),
            bpl: parseBoolean(body.bpl),
            age,
            income,
            need: expanded.text,
            top: 10,
            entrepreneur_only: entrepreneurOnly
        }
    };
}

function toList(result) {
    if (Array.isArray(result)) {
        return result;
    }

    if (result && Array.isArray(result.recommendations)) {
        return result.recommendations;
    }

    if (result && Array.isArray(result.results)) {
        return result.results;
    }

    return [];
}

function normaliseScores(list) {
    const scores = list.map(item => Number(item.score) || 0);

    const max = scores.length ? Math.max(...scores) : 0;

    if (max > 0 && max <= 1) {
        return list.map(item => ({
            ...item,
            score: (Number(item.score) || 0) * 100
        }));
    }

    return list;
}

const showRecommendationForm = (req, res) => {
    return res.render("recommendation", {
        error: null
    });
};

const getRecommendationsController = async (req, res) => {
    const body = req.body || {};
    const parsed = parseForm(body);

    if (parsed.error) {
        return res.status(400).render("recommendation", {
            error: parsed.error
        });
    }

    try {
        if (!CSV_PATH) {
            throw new Error(
                "schemes_clean.csv was not found in ml1 or ml."
            );
        }

        console.log("Recommendation request received:", {
            state: parsed.data.state,
            age: parsed.data.age,
            entrepreneur_only: parsed.data.entrepreneur_only
        });

        const result = await getRecommendations(parsed.data);
        const recommendations = toList(result);

        const scoredRecommendations = normaliseScores(
            recommendations
        );

        const withDocs = attachDocuments(
            scoredRecommendations,
            body,
            docsLookup
        );

        if (!withDocs || !Array.isArray(withDocs.schemes)) {
            throw new Error(
                "Document service returned an invalid response."
            );
        }

        const schemes = attachDates(
            withDocs.schemes,
            datesLookup
        );

        console.log(
            `Recommendations: ${schemes.length} | ` +
            `Documents attached: ${
                schemes.filter(s => !s.docs_fallback).length
            } | ` +
            `Schemes with end dates: ${
                schemes.filter(s => s.end_date).length
            }`
        );

        return res.render("recommendations", {
            recommendations: schemes,
            master_docs: withDocs.master || [],
            need_keywords: parsed.keywords,
            profile: body
        });

    } catch (error) {
        console.error(
            "Recommendation controller error:",
            error.stack || error.message
        );

        return res.status(500).render("recommendation", {
            error:
                "Something went wrong while finding schemes. Please try again."
        });
    }
};

module.exports = {
    showRecommendationForm,
    getRecommendationsController
};

