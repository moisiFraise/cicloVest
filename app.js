const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Rotas
app.get('/', (req, res) => {
    res.json({ message: 'cicloVest API funcionando na Vercel!' });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Para desenvolvimento local
if (process.env.NODE_ENV !== 'production') {
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Servidor rodando em http://localhost:${port}`);
    });
}

module.exports = app;
