const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ message: 'Невалидный или просроченный токен' });
        }
        req.user = user;
        next();
    });
};

const validateAppUserAgent = (req, res, next) => {
    const userAgent = req.headers['user-agent'];
    const requiredUA = process.env.C_PLUS_PLUS_USER_AGENT || 'VortexHardwareAeroLink/2.0';

    if (userAgent !== requiredUA) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
};

module.exports = {
    authenticateToken,
    validateAppUserAgent
};
