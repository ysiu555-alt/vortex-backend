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

        // Определение IP (Используем req.ip благодаря trust proxy)
        const regIp = req.ip;

        // Проверка на мультиаккаунтинг триала
        const ipDuplicate = await db.get('SELECT id FROM users WHERE reg_ip = ? AND subscription_type != "NONE" LIMIT 1', [regIp]);

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

const appLogin = async (req, res) => {
    try {
        const { token, hwid, mac_address, ip_address } = req.body;

        if (!token || !hwid) {
            return res.status(400).json({ status: 'error', message: 'Ключ или HWID не переданы' });
        }

        // 1. Поиск ключа в таблице купонов
        const keyData = await db.get('SELECT * FROM funpay_keys WHERE coupon_code = ?', [token]);
        if (!keyData) {
            return res.status(404).json({ status: 'error', message: 'Указанный ключ не существует' });
        }

        // 2. Проверка, активирован ли ключ на сайте
        if (keyData.is_used === 0 || !keyData.used_by_user_id) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Этот ключ еще не был активирован в личном кабинете на сайте!' 
            });
        }

        // 3. Поиск пользователя, активировавшего ключ
        const user = await db.get('SELECT * FROM users WHERE id = ?', [keyData.used_by_user_id]);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Пользователь не найден' });
        }

        // 4. Проверка срока действия подписки
        const now = new Date();
        const expiresAt = user.expires_at ? new Date(user.expires_at) : null;

        if (user.subscription_type === 'NONE' || !expiresAt || expiresAt < now) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Срок действия вашей подписки истек или она не активна' 
            });
        }

        // 5. Валидация аппаратной привязки (HWID Flow)
        if (!user.hwid) {
            // Первая привязка устройства
            await db.run(
                'UPDATE users SET hwid = ?, mac_address = ?, ip_address = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [hwid, mac_address, ip_address, user.id]
            );
        } else {
            // Проверка на совпадение HWID
            if (user.hwid !== hwid) {
                return res.status(403).json({
                    status: 'error',
                    code: 'HWID_MISMATCH',
                    message: 'Этот ключ уже привязан к другому компьютеру!'
                });
            }
            // Обновление данных последнего входа
            await db.run(
                'UPDATE users SET mac_address = ?, ip_address = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [mac_address, ip_address, user.id]
            );
        }

        return res.status(200).json({
            status: 'success',
            message: 'Доступ разрешен',
            subscription_type: user.subscription_type,
            expires_at: user.expires_at
        });

    } catch (error) {
        console.error('App Login error:', error);
        return res.status(500).json({ status: 'error', message: 'Ошибка сервера при проверке софта' });
    }
};

module.exports = {
    register,
    login,
    appLogin
};
