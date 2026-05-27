const bcrypt = require('bcryptjs');
const db = require('../../database');
require('dotenv').config();

const appAuth = async (req, res) => {
    try {
        const { email, password, hwid } = req.body;

        const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ code: 'AUTH_FAILED', message: 'Неверный логин или пароль' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ code: 'AUTH_FAILED', message: 'Неверный логин или пароль' });
        }

        // Проверка наличия активной лицензии
        const now = new Date();
        const expiresAt = user.expires_at ? new Date(user.expires_at) : null;

        if (user.subscription_type === 'NONE' || !expiresAt || expiresAt < now) {
            return res.status(403).json({ code: 'NO_SUBSCRIPTION', message: 'У вас нет активной подписки' });
        }

        // Валидация аппаратной привязки (HWID Flow)
        if (!user.hwid) {
            // Первый запуск: привязка HWID
            await db.run(
                'UPDATE users SET hwid = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [hwid, user.id]
            );
        } else {
            // Повторный запуск: строгое сравнение
            if (user.hwid !== hwid) {
                return res.status(403).json({
                    status: 'error',
                    code: 'HWID_MISMATCH',
                    message: 'Ключ/Аккаунт привязан к другой конфигурации оборудования!'
                });
            }
            await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        }

        res.status(200).json({
            status: 'success',
            message: 'Авторизация пройдена',
            subscription_type: user.subscription_type,
            expires_at: user.expires_at
        });

    } catch (error) {
        console.error('App Auth error:', error);
        res.status(500).json({ status: 'error', message: 'Ошибка сервера' });
    }
};

module.exports = {
    appAuth
};
