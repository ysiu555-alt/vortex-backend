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

// Безопасность
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://kaliang.work.gd',
    optionsSuccessStatus: 200
}));

// Парсинг JSON
app.use(express.json());

// Маршруты
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
