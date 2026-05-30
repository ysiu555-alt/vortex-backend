const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    // Настройки вашего SMTP-сервера. 
    // Пример для Gmail (лучше использовать App Password):
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true, 
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const sendVerificationEmail = async (email, code) => {
    try {
        await transporter.sendMail({
            from: `"Kaliang App" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Верификация аккаунта Kaliang',
            text: `Ваш код подтверждения: ${code}. Код действителен 5 минут.`,
            html: `<b>Ваш код подтверждения: ${code}</b><br>Код действителен 5 минут.`,
        });
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        return false;
    }
};

module.exports = { sendVerificationEmail };
