require('dotenv').config();
const express = require('express');
const pool = require('./config/database');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Teste de conexão com banco
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    res.json({ 
      message: 'Conexão com Neon DB bem-sucedida!',
      timestamp: result.rows[0].now 
    });
  } catch (err) {
    console.error('Erro na conexão:', err);
    res.status(500).json({ error: 'Erro na conexão com banco' });
  }
});

// Rota para cicloVest - exemplo de produtos
app.get('/api/produtos', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM produtos LIMIT 10');
    client.release();
    
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao buscar produtos:', err);
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// Criar tabela de exemplo (apenas para teste)
app.post('/api/setup-db', async (req, res) => {
  try {
    const client = await pool.connect();
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS produtos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        categoria VARCHAR(100),
        preco DECIMAL(10,2),
        estoque INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    client.release();
    res.json({ message: 'Tabela produtos criada com sucesso!' });
  } catch (err) {
    console.error('Erro ao criar tabela:', err);
    res.status(500).json({ error: 'Erro ao criar tabela' });
  }
});

// Rota principal
app.get('/', (req, res) => {
  res.json({ 
    message: 'cicloVest API conectada com Neon DB!',
    endpoints: [
      '/api/test-db',
      '/api/produtos',
      '/api/setup-db'
    ]
  });
});

// Para desenvolvimento local
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
  });
}

module.exports = app;
