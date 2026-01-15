const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors({
    origin: 'http://localhost:3000'
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const transporter = nodemailer.createTransport({
    host: 'smtp.mail.ru',
    port: 465,
    secure: true,
    auth: {
        user: 'Erokhovd@mail.ru',
        pass: 'FaF66RNhu7oR6iTOHgCk'
    }
});

app.post('/send-mail', async (req, res) => {
    const { subject, text } = req.body;

    try {
        await transporter.sendMail({
            from: {
                name: 'ООО "СУ-10"',
                address: 'Erokhovd@mail.ru'
            },
            to: 'Erokhovd@mail.ru',
            subject: subject || 'Запрос коммерческого предложения',
            text: text || 'Это тестовое письмо с Node.js сервера'
        });

        res.json({ ok: true });
    } catch (error) {
        console.error('Mail error:', error);       // уже есть
        res.status(500).json({
            ok: false,
            error: error.message || 'Send mail error'
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
