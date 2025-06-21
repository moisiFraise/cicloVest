require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// Middleware de segurança - CSP
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self';"
  );
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Importa controllers
const UserController = require('./controllers/userController');
const RedacaoController = require('./controllers/RedacaoController');
const simuladoController = require('./controllers/simuladoController');

// Importa middleware de autenticação
const authenticateToken = require('./middleware/auth');

// ROTAS DA API 
app.get('/api', (req, res) => {
  res.json({ 
    message: 'cicloVest API conectada com Neon DB!',
    status: 'online',
    endpoints: [
      'POST /api/cadastro',
      'POST /api/login',
      'GET /api/perfil (protegida)',
      'GET /api/dashboard-data (protegida)',
      'GET /api/test-db',
      'POST /api/setup-db',
      'GET /api/redacoes (protegida)',
      'POST /api/redacoes (protegida)',
      'PUT /api/redacoes/:id (protegida)',
      'DELETE /api/redacoes/:id (protegida)',
      'GET /api/redacoes/stats (protegida)',
      'GET /api/simulados (protegida)',
      'POST /api/simulados (protegida)',
      'GET /api/simulados/estatisticas (protegida)',
      'GET /api/simulados/:id (protegida)',
      'PUT /api/simulados/:id (protegida)',
      'DELETE /api/simulados/:id (protegida)'
    ]
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const pool = require('./config/database');
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

app.post('/api/setup-db', async (req, res) => {
  try {
    const pool = require('./config/database');
    const client = await pool.connect();
    
    try {
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

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_stats (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          media_geral DECIMAL(5,2) DEFAULT 0,
          media_simulados DECIMAL(5,2) DEFAULT 0,
          nota_redacao INTEGER DEFAULT 0,
          total_questoes INTEGER DEFAULT 0,
          questoes_corretas INTEGER DEFAULT 0,
          simulados_realizados INTEGER DEFAULT 0,
          redacoes_escritas INTEGER DEFAULT 0,
          horas_estudo INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_activities (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          tipo VARCHAR(50) NOT NULL,
          descricao TEXT NOT NULL,
          pontuacao INTEGER,
          materia VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

       await client.query(`
        CREATE TABLE IF NOT EXISTS simulados (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          nome VARCHAR(255) NOT NULL,
          tipo_simulado VARCHAR(50) NOT NULL CHECK (tipo_simulado IN ('Prova Antiga', 'SAS', 'Bernoulli', 'Poliedro', 'Hexag', 'Outro')),
          dia_prova VARCHAR(20) NOT NULL CHECK (dia_prova IN ('Primeiro Dia', 'Segundo Dia')),
          total_questoes INTEGER NOT NULL CHECK (total_questoes > 0),
          questoes_acertadas INTEGER NOT NULL CHECK (questoes_acertadas >= 0),
          porcentagem_acertos DECIMAL(5,2) GENERATED ALWAYS AS (ROUND((questoes_acertadas::DECIMAL / total_questoes::DECIMAL) * 100, 2)) STORED,
          data_realizacao DATE NOT NULL,
          tempo_realizacao INTEGER NOT NULL,
          nivel_dificuldade VARCHAR(20) NOT NULL CHECK (nivel_dificuldade IN ('facil', 'medio', 'dificil')),
          descricao TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_simulados_user_id ON simulados(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_simulados_data ON simulados(data_realizacao)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_simulados_tipo ON simulados(tipo_simulado)
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS redacoes (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
          tema VARCHAR(500) NOT NULL,
          nivel_dificuldade VARCHAR(20) NOT NULL CHECK (nivel_dificuldade IN ('facil', 'medio', 'dificil')),
          competencia_1 INTEGER NOT NULL CHECK (competencia_1 >= 0 AND competencia_1 <= 200),
          competencia_2 INTEGER NOT NULL CHECK (competencia_2 >= 0 AND competencia_2 <= 200),
          competencia_3 INTEGER NOT NULL CHECK (competencia_3 >= 0 AND competencia_3 <= 200),
          competencia_4 INTEGER NOT NULL CHECK (competencia_4 >= 0 AND competencia_4 <= 200),
          competencia_5 INTEGER NOT NULL CHECK (competencia_5 >= 0 AND competencia_5 <= 200),
          nota_final INTEGER GENERATED ALWAYS AS (competencia_1 + competencia_2 + competencia_3 + competencia_4 + competencia_5) STORED,
          observacoes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_redacoes_user_id ON redacoes(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_redacoes_created_at ON redacoes(created_at)
      `);

      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $ language 'plpgsql'
      `);

      await client.query(`
        DROP TRIGGER IF EXISTS update_simulados_updated_at ON simulados
      `);
      
      await client.query(`
        CREATE TRIGGER update_simulados_updated_at BEFORE UPDATE ON simulados
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
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

app.post('/api/cadastro', UserController.register);
app.post('/api/login', UserController.login);
app.get('/api/perfil', authenticateToken, UserController.getProfile);

app.get('/api/dashboard-data', authenticateToken, async (req, res) => {
  try {
    const pool = require('./config/database');
    const client = await pool.connect();
    
    try {
      const statsResult = await client.query(
        'SELECT * FROM user_stats WHERE user_id = $1',
        [req.user.id]
      );

      const activitiesResult = await client.query(
        'SELECT * FROM user_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [req.user.id]
      );

      const lastRedacaoResult = await client.query(
        'SELECT nota_final FROM redacoes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [req.user.id]
      );

      const stats = statsResult.rows[0] || {
        media_geral: 0,
        media_simulados: 0,
        nota_redacao: 0,
        total_questoes: 0,
        questoes_corretas: 0,
        simulados_realizados: 0,
        redacoes_escritas: 0,
        horas_estudo: 0
      };

      const ultimaNotaRedacao = lastRedacaoResult.rows[0]?.nota_final || parseInt(stats.nota_redacao) || 850;

      // Dados simulados para demonstração
      const dashboardData = {
        stats: {
          mediaGeral: parseFloat(stats.media_geral) || 78.5,
          mediaSimulados: parseFloat(stats.media_simulados) || 82.1,
          notaRedacao: ultimaNotaRedacao,
          metaMensal: 75,
          totalQuestoes: parseInt(stats.total_questoes) || 1250,
          questoesCorretas: parseInt(stats.questoes_corretas) || 982,
          simuladosRealizados: parseInt(stats.simulados_realizados) || 15,
          redacoesEscritas: parseInt(stats.redacoes_escritas) || 8,
          horasEstudo: parseInt(stats.horas_estudo) || 45
        },
        chartData: {
          progressWeek: [65, 72, 68, 78, 82, 75, 85],
          progressMonth: [70, 75, 78, 82],
          progressQuarter: [68, 75, 82],
          subjects: {
            labels: ['Matemática', 'Português', 'Física', 'Química', 'História', 'Geografia'],
            data: [92, 78, 87, 84, 65, 68]
          }
        },
        activities: activitiesResult.rows.map(activity => ({
          id: activity.id,
          tipo: activity.tipo,
          descricao: activity.descricao,
          pontuacao: activity.pontuacao,
          materia: activity.materia,
          created_at: activity.created_at
        })),
        subjects: {
          destaque: [
            { nome: 'Matemática', score: 92 },
            { nome: 'Física', score: 87 },
            { nome: 'Química', score: 84 }
          ],
          melhorar: [
            { nome: 'História', score: 65, status: 'warning' },
            { nome: 'Geografia', score: 68, status: 'warning' },
            { nome: 'Literatura', score: 58, status: 'critical' }
          ]
        }
      };

      res.json(dashboardData);

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao buscar dados do dashboard:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/user-stats', authenticateToken, async (req, res) => {
  try {
    const {
      media_geral,
      media_simulados,
      nota_redacao,
      total_questoes,
      questoes_corretas,
      simulados_realizados,
      redacoes_escritas,
      horas_estudo
    } = req.body;

    const pool = require('./config/database');
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        UPDATE user_stats 
        SET 
          media_geral = COALESCE($1, media_geral),
          media_simulados = COALESCE($2, media_simulados),
          nota_redacao = COALESCE($3, nota_redacao),
          total_questoes = COALESCE($4, total_questoes),
          questoes_corretas = COALESCE($5, questoes_corretas),
          simulados_realizados = COALESCE($6, simulados_realizados),
          redacoes_escritas = COALESCE($7, redacoes_escritas),
          horas_estudo = COALESCE($8, horas_estudo),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $9
        RETURNING *
      `, [
        media_geral, media_simulados, nota_redacao, total_questoes,
        questoes_corretas, simulados_realizados, redacoes_escritas,
        horas_estudo, req.user.id
      ]);

         res.json({
        message: 'Estatísticas atualizadas com sucesso!',
        stats: result.rows[0]
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao atualizar estatísticas:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/redacoes', authenticateToken, RedacaoController.listarRedacoes);
app.post('/api/redacoes', authenticateToken, RedacaoController.criarRedacao);
app.get('/api/redacoes/stats', authenticateToken, RedacaoController.estatisticasRedacoes);
app.get('/api/redacoes/:id', authenticateToken, RedacaoController.buscarRedacao);
app.put('/api/redacoes/:id', authenticateToken, RedacaoController.atualizarRedacao);
app.delete('/api/redacoes/:id', authenticateToken, RedacaoController.excluirRedacao);

app.get('/api/simulados', authenticateToken, simuladoController.listarSimulados);
app.post('/api/simulados', authenticateToken, simuladoController.criarSimulado);
app.get('/api/simulados/estatisticas', authenticateToken, simuladoController.obterEstatisticas);
app.get('/api/simulados/:id', authenticateToken, simuladoController.buscarSimulado);
app.put('/api/simulados/:id', authenticateToken, simuladoController.atualizarSimulado);
app.delete('/api/simulados/:id', authenticateToken, simuladoController.deletarSimulado);

app.post('/api/user-activities', authenticateToken, async (req, res) => {
  try {
    const { tipo, descricao, pontuacao, materia } = req.body;

    if (!tipo || !descricao) {
      return res.status(400).json({ error: 'Tipo e descrição são obrigatórios' });
    }

    const pool = require('./config/database');
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO user_activities (user_id, tipo, descricao, pontuacao, materia)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [req.user.id, tipo, descricao, pontuacao, materia]);

      res.status(201).json({
        message: 'Atividade registrada com sucesso!',
        activity: result.rows[0]
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao registrar atividade:', err);
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

app.get('/MainPage.html', (req, res) => {
  console.log('Acessando MainPage.html');
  const mainPagePath = path.join(__dirname, 'public', 'MainPage.html');
  
  const fs = require('fs');
  if (fs.existsSync(mainPagePath)) {
    console.log('Arquivo MainPage.html encontrado');
    res.sendFile(mainPagePath);
  } else {
    console.log('Arquivo MainPage.html NÃO encontrado');
    res.status(404).send(`
      <h1>cicloVest - Erro 404</h1>
      <p>Arquivo MainPage.html não encontrado em: ${mainPagePath}</p>
      <p>Estrutura esperada:</p>
      <ul>
        <li>public/MainPage.html</li>
        <li>public/MainPage.css</li>
        <li>public/MainPage.js</li>
        <li>public/menu.css</li>
        <li>public/menu.js</li>
      </ul>
      <a href="/">Voltar ao Login</a>
    `);
  }
});

app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    const pool = require('./config/database');
    const client = await pool.connect();
    
    try {
      await client.query(
        'INSERT INTO user_activities (user_id, tipo, descricao) VALUES ($1, $2, $3)',
        [req.user.id, 'logout', 'Logout realizado']
      );

      res.json({
        message: 'Logout realizado com sucesso!',
        redirectTo: '/'
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro no logout:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/simulado.html', (req, res) => {
  console.log('Acessando simulado.html');
  const filePath = path.join(__dirname, 'public', 'simulado.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    console.log('Arquivo simulado.html encontrado, servindo arquivo');
    res.sendFile(filePath);
  } else {
    console.log('Arquivo simulado.html NÃO encontrado');
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Simulados está sendo desenvolvida.</p>
      <p>Arquivo não encontrado: ${filePath}</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

app.get('/redacao.html', (req, res) => {
  console.log('Acessando redacao.html');
  const filePath = path.join(__dirname, 'public', 'redacao.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    console.log('Arquivo redacao.html encontrado, servindo arquivo');
    res.sendFile(filePath);
  } else {
    console.log('Arquivo redacao.html NÃO encontrado');
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Redação está sendo desenvolvida.</p>
      <p>Arquivo não encontrado: ${filePath}</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

app.get('/materias.html', (req, res) => {
  console.log('Acessando materias.html');
  const filePath = path.join(__dirname, 'public', 'materias.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    console.log('Arquivo materias.html encontrado, servindo arquivo');
    res.sendFile(filePath);
  } else {
    console.log('Arquivo materias.html NÃO encontrado');
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Matérias está sendo desenvolvida.</p>
      <p>Arquivo não encontrado: ${filePath}</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

app.get('/relatorios.html', (req, res) => {
  console.log('Acessando relatorios.html');
  const filePath = path.join(__dirname, 'public', 'relatorios.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    console.log('Arquivo relatorios.html encontrado, servindo arquivo');
    res.sendFile(filePath);
  } else {
    console.log('Arquivo relatorios.html NÃO encontrado');
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Relatórios está sendo desenvolvida.</p>
      <p>Arquivo não encontrado: ${filePath}</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

app.use('*', (req, res) => {
  console.log('Rota não encontrada:', req.originalUrl);
  
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint da API não encontrado' });
  } else {
    const protectedPages = ['/MainPage.html', '/simulado.html', '/redacao.html', '/materias.html', '/relatorios.html'];
    const isProtectedPage = protectedPages.some(page => req.originalUrl.includes(page.replace('.html', '')));
    
    if (isProtectedPage) {
      const mainPagePath = path.join(__dirname, 'public', 'MainPage.html');
      const fs = require('fs');
      
      if (fs.existsSync(mainPagePath)) {
        res.sendFile(mainPagePath);
      } else {
        res.redirect('/');
      }
    } else {
      const indexPath = path.join(__dirname, 'public', 'index.html');
      const fs = require('fs');
      
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send(`
          <h1>cicloVest - Erro 404</h1>
          <p>Página não encontrada: ${req.originalUrl}</p>
          <p>Arquivo index.html não existe em: ${indexPath}</p>
          <a href="/api">Ver API</a>
        `);
      }
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor cicloVest rodando em http://localhost:${port}`);
  console.log(`Servindo arquivos estáticos de: ${path.join(__dirname, 'public')}`);
  
  const fs = require('fs');
  const publicDir = path.join(__dirname, 'public');
  const files = [
    'index.html', 
    'cadastroLogin.css', 
    'cadastroLogin.js',
    'MainPage.html',
    'MainPage.css',
    'MainPage.js',
    'menu.css',
    'menu.js',
    'redacao.html',
    'redacao.css',
    'redacao.js',
    'simulado.html',
    'simulado.css',
    'simulado.js'
  ];
  
  console.log('\n📋 Verificando arquivos:');
  files.forEach(file => {
    const filePath = path.join(publicDir, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists ? '✅' : '❌'} ${file}: ${filePath}`);
  });
});

module.exports = app;
