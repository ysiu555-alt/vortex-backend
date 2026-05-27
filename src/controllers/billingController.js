const db = require('../../database');
const { calculateNewExpiry, PLAN_PRICES } = require('../utils/subscription');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const buy = async (req, res) => {
    try {
        const { plan } = req.body;
        const userId = req.user.userId;

        if (!PLAN_PRICES[plan]) {
            return res.status(400).json({ message: 'Неверный тарифный план' });
        }

        const amount = PLAN_PRICES[plan];
        
        // В ТЗ указано: "Выполнение запроса к API Telegram Crypto Bot"
        // Ссылка в ТЗ: https://pay.cryptomus.com/api/v1/payment или Crypto Bot (/createInvoice)
        // Будем использовать Crypto Bot API (т.к. далее упоминается crypto-pay-api-signature)
        
        const token = process.env.CRYPTO_PAY_API_TOKEN;
        const apiBase = 'https://pay.cryptobot.pay/api/createInvoice'; // Уточненный эндпоинт Crypto Bot

        try {
            const response = await axios.post(apiBase, {
                asset: 'USDT',
                amount: amount.toString(),
                payload: `${userId}_${plan}`
            }, {
                headers: { 'Crypto-Pay-API-Token': token }
            });

            if (response.data && response.data.ok) {
                const { invoice_id, pay_url } = response.data.result;

                await db.run(
                    'INSERT INTO orders (user_id, invoice_id, amount, plan_type, status) VALUES (?, ?, ?, ?, ?)',
                    [userId, invoice_id, amount, plan, 'PENDING']
                );

                return res.status(200).json({ success: true, pay_url: pay_url });
            } else {
                throw new Error('Crypto Bot API error');
            }
        } catch (apiError) {
            console.error('Crypto Bot API Error:', apiError.response ? apiError.response.data : apiError.message);
            return res.status(502).json({ message: 'Ошибка платежного шлюза' });
        }

    } catch (error) {
        console.error('Buy error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const redeem = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.userId;

        const coupon = await db.get('SELECT * FROM funpay_keys WHERE coupon_code = ?', [code]);
        if (!coupon) {
            return res.status(404).json({ message: 'Указанный купон не существует' });
        }

        if (coupon.is_used === 1) {
            return res.status(400).json({ message: 'Данный купон уже был активирован ранее' });
        }

        // Атомарная транзакция
        await db.run('BEGIN TRANSACTION');
        try {
            await db.run(
                'UPDATE funpay_keys SET is_used = 1, used_by_user_id = ?, activated_at = CURRENT_TIMESTAMP WHERE coupon_code = ?',
                [userId, code]
            );

            const user = await db.get('SELECT expires_at FROM users WHERE id = ?', [userId]);
            const newExpiry = calculateNewExpiry(user.expires_at, coupon.plan_type);

            await db.run(
                'UPDATE users SET subscription_type = ?, expires_at = ? WHERE id = ?',
                [coupon.plan_type, newExpiry, userId]
            );

            await db.run('COMMIT');
            res.status(200).json({ success: true, message: 'Премиум успешно активирован!', plan: coupon.plan_type });
        } catch (txError) {
            await db.run('ROLLBACK');
            throw txError;
        }

    } catch (error) {
        console.error('Redeem error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const webhook = async (req, res) => {
    try {
        const signature = req.headers['crypto-pay-api-signature'];
        const body = JSON.stringify(req.body);
        const secret = process.env.CRYPTO_PAY_API_TOKEN;

        // Проверка подписи HMAC-SHA256
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(body);
        const hash = hmac.digest('hex');

        if (hash !== signature) {
            return res.status(403).send('Forbidden');
        }

        const { status, payload, invoice_id } = req.body;
        
        if (status !== 'paid') {
            return res.send('OK');
        }

        const [userId, plan] = payload.split('_');

        const order = await db.get('SELECT status FROM orders WHERE invoice_id = ?', [invoice_id]);
        if (!order || order.status === 'PAID') {
            return res.send('OK');
        }

        // Атомарное обновление
        await db.run('BEGIN TRANSACTION');
        try {
            await db.run('UPDATE orders SET status = "PAID" WHERE invoice_id = ?', [invoice_id]);
            
            const user = await db.get('SELECT expires_at FROM users WHERE id = ?', [userId]);
            const newExpiry = calculateNewExpiry(user.expires_at, plan);

            await db.run(
                'UPDATE users SET subscription_type = ?, expires_at = ? WHERE id = ?',
                [plan, newExpiry, userId]
            );

            await db.run('COMMIT');
            res.send('OK');
        } catch (txError) {
            await db.run('ROLLBACK');
            throw txError;
        }

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
};

module.exports = {
    buy,
    redeem,
    webhook
};
