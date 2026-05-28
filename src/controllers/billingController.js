const { User, Order, FunPayKey } = require('../../database');
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
        
        const token = process.env.CRYPTO_PAY_API_TOKEN;
        const apiBase = 'https://pay.cryptobot.pay/api/createInvoice'; 
        
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

                await Order.create({
                    user_id: userId,
                    invoice_id,
                    amount,
                    plan_type: plan,
                    status: 'PENDING'
                });

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

        const coupon = await FunPayKey.findOne({ where: { coupon_code: code } });
        if (!coupon) {
            return res.status(404).json({ message: 'Указанный купон не существует' });
        }

        if (coupon.is_used) {
            return res.status(400).json({ message: 'Данный купон уже был активирован ранее' });
        }

        const user = await User.findByPk(userId);

        // Атомарная транзакция
        const t = await require('../../database').sequelize.transaction();
        try {
            await coupon.update({ 
                is_used: true, 
                used_by_user_id: userId, 
                activated_at: new Date() 
            }, { transaction: t });

            const newExpiry = calculateNewExpiry(user.expires_at, coupon.plan_type);

            await user.update({ 
                subscription_type: coupon.plan_type, 
                expires_at: newExpiry 
            }, { transaction: t });

            await t.commit();
            res.status(200).json({ success: true, message: 'Премиум успешно активирован!', plan: coupon.plan_type });
        } catch (txError) {
            await t.rollback();
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

        const order = await Order.findOne({ where: { invoice_id } });
        if (!order || order.status === 'PAID') {
            return res.send('OK');
        }

        const user = await User.findByPk(userId);

        const t = await require('../../database').sequelize.transaction();
        try {
            await order.update({ status: 'PAID' }, { transaction: t });
            
            const newExpiry = calculateNewExpiry(user.expires_at, plan);

            await user.update({ 
                subscription_type: plan, 
                expires_at: newExpiry 
            }, { transaction: t });

            await t.commit();
            res.send('OK');
        } catch (txError) {
            await t.rollback();
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
