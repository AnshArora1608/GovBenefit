const {
  getSchemeKnowledge,
  inspectField,
  askMentor,
  parseFormDocument,
} = require('../services/mentorService');
const { getProfilesData } = require('../services/profileService');

const inspectFieldController = (req, res) => {
  try {
    const fieldInfo = req.body.fieldInfo || req.body;
    const schemeId = req.body.schemeId || 'pmegp';

    if (!fieldInfo) {
      return res.status(400).json({ error: 'Missing fieldInfo payload' });
    }

    const guidance = inspectField(fieldInfo, schemeId);
    return res.json(guidance);
  } catch (err) {
    console.error('Error inspecting field:', err);
    return res.status(500).json({ error: 'Failed to inspect field' });
  }
};

const askMentorController = (req, res) => {
  try {
    const question = req.body.question || '';
    const fieldContext = req.body.fieldContext || {};
    const schemeId = req.body.schemeId || 'pmegp';

    if (!question.trim()) {
      return res.status(400).json({ error: 'Please enter a question' });
    }

    const response = askMentor(question, fieldContext, schemeId);
    return res.json(response);
  } catch (err) {
    console.error('Error answering mentor question:', err);
    return res
      .status(500)
      .json({ error: 'Failed to generate mentor response' });
  }
};

const getProfileController = (req, res) => {
  try {
    const data = getProfilesData();
    return res.json({
      user: data.user,
      lastUpdated: data.lastUpdated,
    });
  } catch (err) {
    console.error('Error getting profile:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile' });
  }
};

const getKnowledgeController = (req, res) => {
  try {
    const schemeId = req.params.schemeId || 'pmegp';
    const knowledge = getSchemeKnowledge(schemeId);
    if (!knowledge) {
      return res
        .status(404)
        .json({ error: `Knowledge not found for scheme: ${schemeId}` });
    }
    return res.json(knowledge);
  } catch (err) {
    console.error('Error getting scheme knowledge:', err);
    return res.status(500).json({ error: 'Failed to retrieve knowledge' });
  }
};

const parseFormDocumentController = (req, res) => {
  try {
    const result = parseFormDocument(req.body);
    return res.json(result);
  } catch (err) {
    console.error('Error parsing form document:', err);
    return res.status(500).json({ error: 'Failed to parse document' });
  }
};

const showMockPortalController = (req, res) => {
  const data = getProfilesData();
  res.render('mock_pmegp_form', {
    user: data.user,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  inspectFieldController,
  askMentorController,
  getProfileController,
  getKnowledgeController,
  parseFormDocumentController,
  showMockPortalController,
};
