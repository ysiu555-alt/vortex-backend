const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
require('./database'); // Инициализация БД

const authRoutes = require('./src/routes/authRoutes');
const billingRoutes = require('./src/routes/billingRoutes');
const appRoutes = require('./src/routes/appRoutes');
const billingController = require('./src/controllers/billingController');

const app = express();
const PORT = process.env.PORT || 3000;

// 🚀 ИСПРАВЛЕНИЕ: Доверяем прокси-серверу Render, чтобы корректно определялись IP-адреса
// Это полностью убирает ошибку ERR_ERL_UNEXPECTED_X_FORWARDED_FOR от express-rate-limit
app.set('trust proxy', 1);

// Настройка безопасности заголовков
app.use(helmet());

// Настройка CORS (Полное устранение блокировки со стороны браузера)
const allowedOrigin = process.env.FRONTEND_URL;
app.use(cors({
    origin: function (origin, callback) {
        // Разрешаем запросы без origin (например, Postman) или если origin совпадает с FRONTEND_URL
        if (!origin || origin === allowedOrigin) {
            callback(null, true);
        } else {
            // На этапе разработки автоматически одобряем текущий origin фронтенда, если он пришел
            callback(null, origin);
        }
    },
    optionsSuccessStatus: 200,
    credentials: true
}));

// Парсинг JSON
app.use(express.json());

// Маршруты API
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/app', appRoutes);

// Вебхук (вынесен отдельно для удобства и отсутствия middleware JWT)
app.post('/api/webhook/cryptobot', billingController.webhook);

// Базовый эндпоинт для проверки работы
app.get('/', (req, res) => {
    res.json({ status: 'Kaliang Server is running' });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
