const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const { initDb } = require('./database'); // Инициализация БД
initDb();

const authRoutes = require('./src/routes/authRoutes');
const billingRoutes = require('./src/routes/billingRoutes');
const appRoutes = require('./src/routes/appRoutes');
const adminRoutes = require('./src/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// 🚀 ИСПРАВЛЕНИЕ: Доверяем прокси (Render + Cloudflare)
app.set('trust proxy', true);

// Настройка безопасности заголовков
app.use(helmet());

// Настройка CORS (Исправлено: расширена поддержка)
const allowedOrigin = process.env.FRONTEND_URL;
app.use(cors({
    origin: function (origin, callback) {
        // Разрешаем запросы без origin или если origin совпадает с FRONTEND_URL
        if (!origin || (allowedOrigin && origin === allowedOrigin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'crypto-pay-api-signature'],
    credentials: true
}));

// Парсинг JSON
app.use(express.json());

// Маршруты API
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/app', appRoutes);
app.use('/api/admin', adminRoutes);

// Базовый эндпоинт для проверки работы
app.get('/', (req, res) => {
    res.json({ status: 'Kaliang Server is running' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});