const express = require('express');
const router = express.Router();
const {
  showProfilePage,
  saveProfileController,
  showDashboardPage,
  exportProfileJson,
} = require('../controllers/profileController');

// Profile routes
router.get('/profile', showProfilePage);
router.post('/profile', saveProfileController);

// Dashboard routes
router.get('/dashboard', showDashboardPage);

// Export JSON endpoint
router.get('/api/profile/export', exportProfileJson);

module.exports = router;
