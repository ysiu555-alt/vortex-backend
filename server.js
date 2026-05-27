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

// Настройка безопасности заголовков
app.use(helmet());

// Настройка CORS (Решение проблемы с ошибкой подключения)
// Если в переменных Render задан FRONTEND_URL, сервер будет слушать его.
// Если переменной нет — он автоматически разрешит запросы со всех доменов, включая тестовые деплои Cloudflare.
const allowedOrigin = process.env.FRONTEND_URL;
app.use(cors({
    origin: allowedOrigin ? allowedOrigin : true, 
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