const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const { authenticateToken } = require('../middleware/auth');
const { appLimiter } = require('../middleware/rateLimiter');

router.post('/auth', authenticateToken, appLimiter, appController.appAuth);

module.exports = router;
