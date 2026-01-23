// server.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import nodemailer from 'nodemailer';

const app = express();

// Разрешаем запросы с фронта на 3000
app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(bodyParser.json());

// Настройка транспорта для отправки почты
// ПОКА ЗАГЛУШКА — ПОТОМ ПОДСТАВИМ РЕАЛЬНЫЙ SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp.example.com',
    port: 465,
    secure: true,
    auth: {
        user: 'user@example.com',
        pass: 'PASSWORD'
    }
});

// Маршрут для отправки письма
app.post('/send-mail', async (req, res) => {
    try {
        const { subject, text } = req.body;

        if (!subject || !text) {
            return res.status(400).json({ ok: false, error: 'Не переданы subject или text' });
        }

        const mailOptions = {
            from: '"Калькулятор водоснабжения" <user@example.com>',
            to: 'recipient@example.com',
            subject,
            text
        };

        await transporter.sendMail(mailOptions);

        res.json({ ok: true });
    } catch (err) {
        console.error('Mail error:', err);
        res.status(500).json({ ok: false, error: 'Ошибка отправки письма' });
    }
});

// Запускаем сервер на 3000
const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
setInterval(() => {
    console.log('server alive');
}, 5000);