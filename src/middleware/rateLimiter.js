const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 5, // максимум 5 запросов
    message: { message: 'Слишком много попыток входа, пожалуйста, подождите 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

const appLimiter = rateLimit({
    windowMs: 5 * 1000, // 5 секунд
    max: 2, // максимум 2 запроса
    message: { status: 'error', message: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter,
    appLimiter
};
