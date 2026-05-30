const nodemailer = require('nodemailer');
require('dotenv').config();

// Настройка SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === 'true', // true для 465, false для 587
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendVerificationEmail = async (email, code, type = 'registration') => {
    const subjects = {
        registration: 'Верификация аккаунта Kaliang',
        reset: 'Сброс пароля Kaliang'
    };

    const messages = {
        registration: `Ваш код подтверждения для регистрации: ${code}. Код действителен 5 минут.`,
        reset: `Ваш код для сброса пароля: ${code}. Код действителен 5 минут. Если вы не запрашивали сброс, проигнорируйте это письмо.`
    };

    const htmlMessages = {
        registration: `<b>Ваш код подтверждения для регистрации: ${code}</b><br>Код действителен 5 минут.`,
        reset: `<b>Ваш код для сброса пароля: ${code}</b><br>Код действителен 5 минут.<br>Если вы не запрашивали сброс, проигнорируйте это письмо.`
    };

    try {
        await transporter.sendMail({
            from: `"Kaliang App" <${process.env.SMTP_USER}>`,
            to: email,
            subject: subjects[type] || subjects.registration,
            text: messages[type] || messages.registration,
            html: htmlMessages[type] || htmlMessages.registration,
        });
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        return false;
    }
};

module.exports = { sendVerificationEmail };
