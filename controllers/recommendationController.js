const { getRecommendations } = require("../services/python_services");

const {
    loadDocsLookup,
    attachDocuments
} = require("../services/documentService");

// Load CSV once when server starts
const lookup = loadDocsLookup("./ml/schemes_clean.csv");

const showRecommendationForm = (req, res) => {
    res.render("recommendation");
};

const getRecommendationsController = async (req, res) => {
    try {
        const data = {
            state: req.body.state,
            gender: req.body.gender,
            social_cat: req.body.social_cat,
            minority: req.body.minority === "true",
            disability: req.body.disability === "true",
            bpl: req.body.bpl === "true",
            age: Number(req.body.age),
            income: Number(req.body.income),
            need: req.body.need,
            top: 10,
            entrepreneur_only: true
        };

        console.log("Form Data:", data);

        // Get recommendations from Python
        const recommendations = await getRecommendations(data);

        console.log("Python Result:", recommendations);

        if (recommendations.error) {
            return res.status(500).send(recommendations.error);
        }

        // Attach document information
        const { schemes, master } = attachDocuments(
            recommendations,
            req.body,
            lookup
        );

        console.log("Documents attached successfully");

        return res.render("recommendations", {
            recommendations: schemes,
            master_docs: master,
            profile: req.body
        });

    } catch (error) {
        console.error("Recommendation Error:", error);

        return res.status(500).send(
            "Recommendation failed: " + error.message
        );
    }
};

module.exports = {
    showRecommendationForm,
    getRecommendationsController
};