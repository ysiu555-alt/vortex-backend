const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/profile', authenticateToken, authController.getProfile); 

// Маршрут для авторизации десктопного приложения Kaliang
router.post('/app-login', authLimiter, authController.appLogin);

module.exports = router;
