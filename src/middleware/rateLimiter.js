const rateLimit = require('express-rate-limit');

// Общий генератор ключа, использующий Cloudflare IP
const cfKeyGenerator = (req) => req.headers['cf-connecting-ip'] || req.ip;

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: cfKeyGenerator, // Используем Cloudflare IP
    message: { message: 'Слишком много попыток входа, пожалуйста, подождите 15 минут.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

const redeemLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    keyGenerator: cfKeyGenerator, // Используем Cloudflare IP
    message: { message: 'Слишком много попыток активации, подождите 1 минуту.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json(options.message);
    }
});

const appLimiter = rateLimit({
    windowMs: 5 * 1000,
    max: 5,
    keyGenerator: cfKeyGenerator, // Используем Cloudflare IP
    message: { status: 'error', message: 'Rate limit exceeded' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    authLimiter,
    redeemLimiter,
    appLimiter
};
