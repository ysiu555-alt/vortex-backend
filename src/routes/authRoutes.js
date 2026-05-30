const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticateToken } = require('../middleware/auth');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/profile', authenticateToken, authController.getProfile); 

// Маршруты верификации
router.post('/send-code', authLimiter, authController.sendVerificationCode);
router.post('/verify-code', authLimiter, authController.verifyCode);

// Маршруты сброса пароля
router.post('/request-password-reset', authLimiter, authController.requestPasswordReset);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Маршрут для авторизации десктопного приложения Kaliang
router.post('/app-login', authLimiter, authController.appLogin);

module.exports = router;
