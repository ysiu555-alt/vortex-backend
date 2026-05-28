const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Админский маршрут для генерации ключей
router.post('/generate-keys', adminController.generateKeys);

module.exports = router;
