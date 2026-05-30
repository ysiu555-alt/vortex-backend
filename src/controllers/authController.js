const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, FunPayKey, VerificationCode } = require('../../database');
const { calculateNewExpiry } = require('../utils/subscription');
const { sendVerificationEmail } = require('../utils/mailer');
const { Op } = require('sequelize');
require('dotenv').config();

const sendVerificationCode = async (req, res, type = 'registration') => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: 'Email обязателен' });

        // Генерация 6-значного кода
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

        // Сохранение кода (удаляем старые коды для этого email)
        await VerificationCode.destroy({ where: { email } });
        await VerificationCode.create({ email, code, expires_at: expiresAt });

        const sent = await sendVerificationEmail(email, code, type);
        if (!sent) return res.status(500).json({ message: 'Ошибка отправки email' });

        res.status(200).json({ message: 'Код отправлен' });
    } catch (error) {
        console.error('Send code error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;
        const verification = await VerificationCode.findOne({ where: { email, code } });

        if (!verification) return res.status(400).json({ message: 'Неверный код' });
        if (new Date() > new Date(verification.expires_at)) {
            await verification.destroy();
            return res.status(400).json({ message: 'Код истек' });
        }

        // НЕ удаляем код здесь, чтобы его можно было проверить при окончательном действии (регистрация/сброс)
        res.status(200).json({ message: 'Код верен', verified: true });
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const register = async (req, res) => {
    try {
        const { email, password, code } = req.body;

        const verification = await VerificationCode.findOne({ where: { email, code } });
        if (!verification || new Date() > new Date(verification.expires_at)) {
            return res.status(400).json({ message: 'Email не верифицирован или код истек' });
        }

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

        await verification.destroy(); // Успешная регистрация - удаляем код

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
        const { email, password, hwid, mac_address, ip_address } = req.body;

        if (!email || !password || !hwid) {
            return res.status(400).json({ status: 'error', message: 'Email, пароль или HWID не переданы' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Пользователь не найден' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Неверный пароль' });
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
                    message: 'Аккаунт привязан к другому компьютеру!'
                });
            }
            await user.update({ mac_address, ip_address, last_login: new Date() });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({
            status: 'success',
            message: 'Доступ разрешен',
            token: token,
            subscription_type: user.subscription_type,
            expires_at: user.expires_at
        });

    } catch (error) {
        console.error('App Login error:', error);
        return res.status(500).json({ status: 'error', message: 'Ошибка сервера при проверке софта' });
    }
};

const getProfile = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.userId, {
            attributes: ['email', 'subscription_type', 'expires_at', 'hwid']
        });

        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Пользователь не найден' });
        }

        res.status(200).json({
            status: 'success',
            user: {
                email: user.email,
                subscription_type: user.subscription_type,
                expires_at: user.expires_at,
                hwid_bound: !!user.hwid
            }
        });
    } catch (error) {
        console.error('GetProfile error:', error);
        res.status(500).json({ status: 'error', message: 'Ошибка сервера' });
    }
};

const requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

        // Отправляем код с типом 'reset'
        return sendVerificationCode(req, res, 'reset');
    } catch (error) {
        console.error('Request password reset error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        const verification = await VerificationCode.findOne({ where: { email, code } });
        if (!verification || new Date() > new Date(verification.expires_at)) {
            return res.status(400).json({ message: 'Код недействителен или истек' });
        }

        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await user.update({ password_hash: passwordHash });

        await verification.destroy();
        res.status(200).json({ message: 'Пароль успешно изменен' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
};

module.exports = {
    register,
    login,
    appLogin,
    getProfile,
    sendVerificationCode,
    verifyCode,
    requestPasswordReset,
    resetPassword
};
