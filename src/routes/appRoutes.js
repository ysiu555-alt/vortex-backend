const express = require('express');
const router = express.Router();
const appController = require('../controllers/appController');
const { validateAppUserAgent } = require('../middleware/auth');
const { appLimiter } = require('../middleware/rateLimiter');

router.post('/auth', validateAppUserAgent, appLimiter, appController.appAuth);

module.exports = router;
