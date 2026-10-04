
const { getRecommendations } = require("../services/python_services");

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

        const recommendations = await getRecommendations(data);

        console.log("Python Result:", recommendations);

        if (recommendations.error) {
            return res.status(500).send(recommendations.error);
        }

        return res.render("recommendations", {
            recommendations: recommendations
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

