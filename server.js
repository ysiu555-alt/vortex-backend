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

// 🚀 ИСПРАВЛЕНИЕ: Безопасная настройка прокси
app.set('trust proxy', 'loopback');

// Настройка безопасности заголовков (установим после CORS, чтобы разрешить preflight)
app.use(helmet());

// Настройка CORS
app.use(cors({
    origin: function (origin, callback) {
        // Разрешаем запросы без origin (например, мобильные приложения или curl)
        if (!origin) {
            return callback(null, true);
        }
        
        const isAllowed = origin.startsWith('http://localhost') || 
                          origin === 'https://landing2-5kk.pages.dev' || 
                          origin.endsWith('.landing2-5kk.pages.dev') ||
                          origin === 'https://kaliang-2.pl' ||
                          origin === 'https://www.kaliang-2.pl';
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, false);
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