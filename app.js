require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./config/database');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));

const JWT_SECRET = process.env.JWT_SECRET || 'ciclovest_secret_key';

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Rota de cadastro
app.post('/api/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    // Validações básicas
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const client = await pool.connect();

    // Verificar se email já existe
    const emailExists = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (emailExists.rows.length > 0) {
      client.release();
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Criptografar senha
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(senha, saltRounds);

    // Inserir usuário
    const result = await client.query(
      'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email, created_at',
      [nome, email, hashedPassword]
    );

    client.release();

    // Gerar token JWT
    const token = jwt.sign(
      { id: result.rows[0].id, email: result.rows[0].email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Usuário cadastrado com sucesso!',
      user: result.rows[0],
      token
    });

  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de login
app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const client = await pool.connect();

    // Buscar usuário por email
    const result = await client.query(
      'SELECT id, nome, email, senha FROM usuarios WHERE email = $1',
      [email]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const user = result.rows[0];

    // Verificar senha
    const passwordMatch = await bcrypt.compare(senha, user.senha);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login realizado com sucesso!',
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email
      },
      token
    });

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota protegida - perfil do usuário
app.get('/api/perfil', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id, nome, email, created_at FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao buscar perfil:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

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

// Criar tabelas (setup inicial)
app.post('/api/setup-db', async (req, res) => {
  try {
    const client = await pool.connect();
    
    // Criar tabela usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        senha VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Criar índice para email
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)
    `);

    
    client.release();
    res.json({ message: 'Tabelas criadas com sucesso!' });
  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
    res.status(500).json({ error: 'Erro ao criar tabelas' });
  }
});


// Rota principal - servir index.html
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Rota da API
app.get('/api', (req, res) => {
  res.json({ 
    message: 'cicloVest API conectada com Neon DB!',
    endpoints: [
      'POST /api/cadastro',
      'POST /api/login',
      'GET /api/perfil (protegida)',
      'GET /api/test-db',
      'POST /api/setup-db'
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
