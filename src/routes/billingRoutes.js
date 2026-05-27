const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticateToken } = require('../middleware/auth');

router.post('/buy', authenticateToken, billingController.buy);
router.post('/redeem', authenticateToken, billingController.redeem);

module.exports = router;
