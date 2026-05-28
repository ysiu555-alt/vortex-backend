const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, FunPayKey } = require('../../database');
const { calculateNewExpiry } = require('../utils/subscription');
const { Op } = require('sequelize');
require('dotenv').config();

const register = async (req, res) => {
    try {
        const { email, password } = req.body;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Невалидный Email' });
        }

        if (!password || password.length < 8 || password.length > 64) {
            return res.status(400).json({ message: 'Пароль должен быть от 8 до 64 символов' });
        }

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'Этот Email уже зарегистрирован' });
        }

        const regIp = req.ip;

        const ipDuplicate = await User.findOne({ 
            where: { 
                reg_ip: regIp, 
                subscription_type: { [Op.ne]: 'NONE' } 
            } 
        });

        let subscriptionType = 'NONE';
        let expiresAt = null;
        let trialGranted = false;

        if (!ipDuplicate) {
            subscriptionType = 'TRIAL_3DAYS';
            expiresAt = calculateNewExpiry(null, 'TRIAL_3DAYS');
            trialGranted = true;
        }

        const passwordHash = await bcrypt.hash(password, 10);

        await User.create({
            email,
            password_hash: passwordHash,
            reg_ip: regIp,
            subscription_type: subscriptionType,
            expires_at: expiresAt
        });

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

        const user = await User.findOne({ where: { email } });
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

        const keyData = await FunPayKey.findOne({ where: { coupon_code: token } });
        if (!keyData) {
            return res.status(404).json({ status: 'error', message: 'Указанный ключ не существует' });
        }

        if (!keyData.is_used || !keyData.used_by_user_id) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Этот ключ еще не был активирован в личном кабинете на сайте!' 
            });
        }

        const user = await User.findByPk(keyData.used_by_user_id);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Пользователь не найден' });
        }

        const now = new Date();
        const expiresAt = user.expires_at ? new Date(user.expires_at) : null;

        if (user.subscription_type === 'NONE' || !expiresAt || expiresAt < now) {
            return res.status(403).json({ 
                status: 'error', 
                message: 'Срок действия вашей подписки истек или она не активна' 
            });
        }

        if (!user.hwid) {
            await user.update({ hwid, mac_address, ip_address, last_login: new Date() });
        } else {
            if (user.hwid !== hwid) {
                return res.status(403).json({
                    status: 'error',
                    code: 'HWID_MISMATCH',
                    message: 'Этот ключ уже привязан к другому компьютеру!'
                });
            }
            await user.update({ mac_address, ip_address, last_login: new Date() });
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
