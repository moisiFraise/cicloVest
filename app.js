require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./config/database');
const path = require('path');

const app = express();

// Middleware de segurança - CSP
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self';"
  );
  next();
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ROTAS DA API 
app.get('/api', (req, res) => {
  res.json({ 
    message: 'cicloVest API conectada com Neon DB!',
    status: 'online',
    endpoints: [
      'POST /api/cadastro',
      'POST /api/login',
      'GET /api/perfil (protegida)',
      'GET /api/test-db',
      'POST /api/setup-db'
    ]
  });
});

// Teste de conexão com banco
app.get('/api/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT NOW()');
      res.json({ 
        message: 'Conexão com Neon DB bem-sucedida!',
        timestamp: result.rows[0].now 
      });
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro na conexão:', err);
    res.status(500).json({ error: 'Erro na conexão com banco' });
  }
});

// Criar tabelas (setup inicial)
app.post('/api/setup-db', async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
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

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)
      `);

      res.json({ message: 'Tabelas criadas com sucesso!' });
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao criar tabelas:', err);
    res.status(500).json({ error: 'Erro ao criar tabelas' });
  }
});

app.post('/api/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    if (senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres' });
    }

    const client = await pool.connect();

    try {
      const emailExists = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
      if (emailExists.rows.length > 0) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(senha, saltRounds);

      const result = await client.query(
        'INSERT INTO usuarios (nome, email, senha) VALUES ($1, $2, $3) RETURNING id, nome, email, created_at',
        [nome, email, hashedPassword]
      );

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

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        'SELECT id, nome, email, senha FROM usuarios WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Email ou senha incorretos' });
      }

      const user = result.rows[0];

      const passwordMatch = await bcrypt.compare(senha, user.senha);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Email ou senha incorretos' });
      }

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

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/perfil', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT id, nome, email, created_at FROM usuarios WHERE id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(result.rows[0]);
    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao buscar perfil:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/', (req, res) => {
  console.log('Acessando rota principal /');
  const indexPath = path.join(__dirname, 'public', 'index.html');
  console.log('Caminho do index:', indexPath);
  
  const fs = require('fs');
  if (fs.existsSync(indexPath)) {
    console.log('Arquivo index.html encontrado');
    res.sendFile(indexPath);
  } else {
    console.log('Arquivo index.html NÃO encontrado');
    res.status(404).send(`
      <h1>Erro 404</h1>
      <p>Arquivo index.html não encontrado em: ${indexPath}</p>
      <p>Estrutura esperada:</p>
      <ul>
        <li>public/index.html</li>
        <li>public/cadastroLogin.css</li>
        <li>public/cadastroLogin.js</li>
      </ul>
    `);
  }
});

app.use('*', (req, res) => {
  console.log('Rota não encontrada:', req.originalUrl);
  
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint da API não encontrado' });
  } else {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    const fs = require('fs');
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`
        <h1>cicloVest - Erro 404</h1>
        <p>Página não encontrada</p>
        <p>Arquivo index.html não existe em: ${indexPath}</p>
        <a href="/api">Ver API</a>
      `);
    }
  }
});
//localll
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor cicloVest rodando em http://localhost:${port}`);
  console.log(`📁 Servindo arquivos estáticos de: ${path.join(__dirname, 'public')}`);
  
  // Verificarrrrr se os arquivos existem
  const fs = require('fs');
  const publicDir = path.join(__dirname, 'public');
  const files = ['index.html', 'cadastroLogin.css', 'cadastroLogin.js'];
  
  console.log('\n📋 Verificando arquivos:');
  files.forEach(file => {
    const filePath = path.join(publicDir, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists ? '✅' : '❌'} ${file}: ${filePath}`);
  });
});

module.exports = app;
