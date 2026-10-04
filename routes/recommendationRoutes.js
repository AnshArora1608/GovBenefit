
const express = require("express");

const {
    showRecommendationForm,
    getRecommendationsController
} = require("../controllers/recommendationController");

const router = express.Router();

router.get("/", showRecommendationForm);
router.post("/", getRecommendationsController);

module.exports = router;
