const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticateToken } = require('../middleware/auth');
const { redeemLimiter } = require('../middleware/rateLimiter');

router.post('/buy', authenticateToken, billingController.buy);
router.post('/redeem', authenticateToken, redeemLimiter, billingController.redeem);

// Вебхук вынесен отдельно (без middleware JWT)
router.post('/webhook/cryptobot', billingController.webhook);

module.exports = router;
