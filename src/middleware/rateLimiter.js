const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 10, // Увеличено до 10 для запаса
    message: { message: 'Слишком много попыток входа, пожалуйста, подождите 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

const redeemLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 минута
    max: 5, // 5 попыток активации в минуту - достаточно для пользователя
    message: { message: 'Слишком много попыток активации, подождите 1 минуту.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

const appLimiter = rateLimit({
    windowMs: 5 * 1000, // 5 секунд
    max: 5, // Увеличено для стабильности
    message: { status: 'error', message: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter,
    redeemLimiter,
    appLimiter
};
