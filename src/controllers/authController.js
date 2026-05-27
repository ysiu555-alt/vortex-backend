const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../database');
const { calculateNewExpiry } = require('../utils/subscription');
require('dotenv').config();

const register = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Валидация email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Невалидный Email' });
        }

        // Проверка пароля
        if (!password || password.length < 8 || password.length > 64) {
            return res.status(400).json({ message: 'Пароль должен быть от 8 до 64 символов' });
        }

        // Поиск дубликата email
        const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ message: 'Этот Email уже зарегистрирован' });
        }

        // Определение IP
        const regIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // Проверка на мультиаккаунтинг триала
        const ipDuplicate = await db.get('SELECT id FROM users WHERE reg_ip = ? AND subscription_type = "TRIAL_3DAYS" LIMIT 1', [regIp]);

        let subscriptionType = 'NONE';
        let expiresAt = null;
        let trialGranted = false;

        if (!ipDuplicate) {
            subscriptionType = 'TRIAL_3DAYS';
            expiresAt = calculateNewExpiry(null, 'TRIAL_3DAYS');
            trialGranted = true;
        }

        // Хэширование пароля
        const passwordHash = await bcrypt.hash(password, 10);

        // Вставка пользователя
        await db.run(
            'INSERT INTO users (email, password_hash, reg_ip, subscription_type, expires_at) VALUES (?, ?, ?, ?, ?)',
            [email, passwordHash, regIp, subscriptionType, expiresAt]
        );

        if (trialGranted) {
            return res.status(201).json({ success: true, message: 'Регистрация успешна', trial_granted: true });
        } else {
            return res.status(201).json({ success: true, message: 'Регистрация успешна. Пробный период недоступен для данного сетевого узла', trial_granted: false });
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ message: 'Неверный логин или пароль' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Неверный логин или пароль' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.status(200).json({
            success: true,
            token: token,
            user: {
                email: user.email,
                subscription_type: user.subscription_type,
                expires_at: user.expires_at,
                hwid_bound: !!user.hwid
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

module.exports = {
    register,
    login
};
