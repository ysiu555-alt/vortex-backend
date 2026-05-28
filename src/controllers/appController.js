const bcrypt = require('bcryptjs');
const { User } = require('../../database');
require('dotenv').config();

const appAuth = async (req, res) => {
    try {
        // req.user заполняется middleware authenticateToken
        const { hwid, mac_address, ip_address } = req.body;
        const userId = req.user.userId;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Пользователь не найден' });
        }

        // Проверка наличия активной лицензии
        const now = new Date();
        const expiresAt = user.expires_at ? new Date(user.expires_at) : null;

        if (user.subscription_type === 'NONE' || !expiresAt || expiresAt < now) {
            return res.status(403).json({ status: 'error', message: 'У вас нет активной подписки' });
        }

        // Валидация аппаратной привязки (HWID Flow)
        if (!user.hwid) {
            // Первый запуск: привязка HWID
            await user.update({ hwid, mac_address, ip_address, last_login: new Date() });
        } else {
            // Повторный запуск: строгое сравнение
            if (user.hwid !== hwid) {
                return res.status(403).json({
                    status: 'error',
                    code: 'HWID_MISMATCH',
                    message: 'Аккаунт привязан к другому компьютеру!'
                });
            }
            await user.update({ mac_address, ip_address, last_login: new Date() });
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
