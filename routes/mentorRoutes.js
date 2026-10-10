const express = require('express');
const router = express.Router();
const {
  inspectFieldController,
  askMentorController,
  getProfileController,
  getKnowledgeController,
  parseFormDocumentController,
  showMockPortalController,
} = require('../controllers/mentorController');

// Mentor API endpoints
router.post('/api/mentor/inspect-field', inspectFieldController);
router.post('/api/mentor/ask', askMentorController);
router.get('/api/mentor/profile', getProfileController);
router.get('/api/mentor/knowledge/:schemeId', getKnowledgeController);
router.post('/api/mentor/parse-form-document', parseFormDocumentController);

// Target MVP Scheme Sandbox Application Portal
router.get('/government-portal/pmegp-application', showMockPortalController);

module.exports = router;
