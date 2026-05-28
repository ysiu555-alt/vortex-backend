const { FunPayKey } = require('../../database');
require('dotenv').config();

/**
 * Генератор случайных ключей формата KLIANG-XXXX-XXXX
 */
function generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `KLIANG-${segment()}-${segment()}`;
}

const generateKeys = async (req, res) => {
    try {
        const { secret, type, count } = req.body;

        // 1. Проверка секретного ключа
        if (secret !== process.env.ADMIN_SECRET_KEY) {
            return res.status(403).json({ status: 'error', message: 'Forbidden' });
        }

        const planType = type || 'TRIAL_3DAYS';
        const numKeys = parseInt(count) || 5;

        const generatedKeys = [];

        // 2. Генерация и вставка
        for (let i = 0; i < numKeys; i++) {
            const code = generateKey();
            try {
                await FunPayKey.create({
                    coupon_code: code,
                    plan_type: planType,
                    is_used: false
                });
                generatedKeys.push(code);
            } catch (err) {
                // Если дубликат — пропускаем эту итерацию (генерируем новый)
                if (err.name === 'SequelizeUniqueConstraintError') {
                    i--;
                    continue;
                }
                throw err;
            }
        }

        return res.status(200).json({
            status: 'success',
            message: `Успешно создано ${generatedKeys.length} ключей для тарифа ${planType}`,
            keys: generatedKeys
        });

    } catch (error) {
        console.error('Admin generate keys error:', error);
        return res.status(500).json({ status: 'error', message: 'Ошибка сервера' });
    }
};

module.exports = {
    generateKeys
};
