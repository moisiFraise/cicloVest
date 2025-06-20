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
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://fonts.gstatic.com; " +
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
      'GET /api/dashboard-data (protegida)',
      'GET /api/test-db',
      'POST /api/setup-db',
      'GET /api/redacoes (protegida)',
      'POST /api/redacoes (protegida)',
      'PUT /api/redacoes/:id (protegida)',
      'DELETE /api/redacoes/:id (protegida)',
      'GET /api/redacoes/stats (protegida)'
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

      // Criar tabela de estatísticas do usuário
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

      // Criar tabela de atividades
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

      // Criar tabela de redações
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

      // Criar índices para redações
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_redacoes_user_id ON redacoes(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_redacoes_created_at ON redacoes(created_at)
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

// ROTAS DE AUTENTICAÇÃO (mantidas como estavam)
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

      const userId = result.rows[0].id;

      // Criar estatísticas iniciais para o usuário
      await client.query(
        'INSERT INTO user_stats (user_id) VALUES ($1)',
        [userId]
      );

      // Adicionar atividade de cadastro
      await client.query(
        'INSERT INTO user_activities (user_id, tipo, descricao) VALUES ($1, $2, $3)',
        [userId, 'cadastro', 'Bem-vindo ao cicloVest! Conta criada com sucesso.']
      );

      const token = jwt.sign(
        { id: result.rows[0].id, email: result.rows[0].email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'Usuário cadastrado com sucesso!',
        user: result.rows[0],
        token,
        redirectTo: '/MainPage.html'
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

      // Registrar atividade de login
      await client.query(
        'INSERT INTO user_activities (user_id, tipo, descricao) VALUES ($1, $2, $3)',
        [user.id, 'login', 'Login realizado com sucesso']
      );

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
        token,
        redirectTo: '/MainPage.html'
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

// Nova rota para dados do dashboard
app.get('/api/dashboard-data', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      // Buscar estatísticas do usuário
      const statsResult = await client.query(
        'SELECT * FROM user_stats WHERE user_id = $1',
        [req.user.id]
      );

      // Buscar atividades recentes
      const activitiesResult = await client.query(
        'SELECT * FROM user_activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [req.user.id]
      );

      // Buscar última nota de redação
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

      // Usar a última nota de redação se existir
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

// ROTAS DE REDAÇÃO

// Listar redações do usuário
app.get('/api/redacoes', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, nivel, orderBy = 'created_at', order = 'DESC' } = req.query;
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    
    try {
      let query = `
        SELECT id, tema, nivel_dificuldade, competencia_1, competencia_2, 
               competencia_3, competencia_4, competencia_5, nota_final, 
               observacoes, created_at, updated_at
        FROM redacoes 
        WHERE user_id = $1
      `;
      
      const params = [req.user.id];
      
      // Filtro por nível se especificado
      if (nivel && ['facil', 'medio', 'dificil'].includes(nivel)) {
        query += ` AND nivel_dificuldade = $${params.length + 1}`;
        params.push(nivel);
      }
      
      // Ordenação
      const validOrderBy = ['created_at', 'nota_final', 'tema'];
      const validOrder = ['ASC', 'DESC'];
      
      if (validOrderBy.includes(orderBy) && validOrder.includes(order.toUpperCase())) {
        query += ` ORDER BY ${orderBy} ${order.toUpperCase()}`;
      } else {
        query += ` ORDER BY created_at DESC`;
      }
      
      // Paginação
      query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit), offset);

      const result = await client.query(query, params);

      // Contar total de registros
      let countQuery = 'SELECT COUNT(*) FROM redacoes WHERE user_id = $1';
      const countParams = [req.user.id];
      
      if (nivel && ['facil', 'medio', 'dificil'].includes(nivel)) {
        countQuery += ' AND nivel_dificuldade = $2';
        countParams.push(nivel);
      }
      
      const countResult = await client.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      res.json({
        redacoes: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao buscar redações:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar nova redação
app.post('/api/redacoes', authenticateToken, async (req, res) => {
  try {
    const {
      tema,
      nivel_dificuldade,
      competencia_1,
      competencia_2,
      competencia_3,
      competencia_4,
      competencia_5,
      observacoes
    } = req.body;

    // Validações
    if (!tema || !nivel_dificuldade) {
      return res.status(400).json({ error: 'Tema e nível de dificuldade são obrigatórios' });
    }

    if (!['facil', 'medio', 'dificil'].includes(nivel_dificuldade)) {
      return res.status(400).json({ error: 'Nível de dificuldade deve ser: facil, medio ou dificil' });
    }

    const competencias = [competencia_1, competencia_2, competencia_3, competencia_4, competencia_5];
    
    // Validar competências
    for (let i = 0; i < competencias.length; i++) {
      const comp = competencias[i];
      if (comp === undefined || comp === null || comp === '') {
        return res.status(400).json({ error: `Competência ${i + 1} é obrigatória` });
      }
      
      const compNum = parseInt(comp);
      if (isNaN(compNum) || compNum < 0 || compNum > 200) {
        return res.status(400).json({ error: `Competência ${i + 1} deve ser um número entre 0 e 200` });
      }
    }

    if (tema.length > 500) {
      return res.status(400).json({ error: 'Tema deve ter no máximo 500 caracteres' });
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO redacoes (
          user_id, tema, nivel_dificuldade, competencia_1, competencia_2, 
          competencia_3, competencia_4, competencia_5, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        req.user.id, tema, nivel_dificuldade,
        parseInt(competencia_1), parseInt(competencia_2), parseInt(competencia_3),
        parseInt(competencia_4), parseInt(competencia_5), observacoes
      ]);

      const redacao = result.rows[0];

      // Atualizar estatísticas do usuário
      await client.query(`
        UPDATE user_stats 
        SET 
          redacoes_escritas = redacoes_escritas + 1,
          nota_redacao = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [req.user.id, redacao.nota_final]);

      // Registrar atividade
      await client.query(`
        INSERT INTO user_activities (user_id, tipo, descricao, pontuacao, materia)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        req.user.id,
        'redacao',
        `Redação registrada: ${tema.substring(0, 50)}${tema.length > 50 ? '...' : ''}`,
        redacao.nota_final,
        'Redação'
      ]);

      res.status(201).json({
        message: 'Redação registrada com sucesso!',
        redacao: redacao
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao criar redação:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar redação específica
app.get('/api/redacoes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID da redação inválido' });
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM redacoes 
        WHERE id = $1 AND user_id = $2
      `, [parseInt(id), req.user.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Redação não encontrada' });
      }

      res.json(result.rows[0]);

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao buscar redação:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar redação
app.put('/api/redacoes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tema,
      nivel_dificuldade,
      competencia_1,
      competencia_2,
      competencia_3,
      competencia_4,
      competencia_5,
      observacoes
    } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID da redação inválido' });
    }

    // Validações (mesmas da criação)
    if (!tema || !nivel_dificuldade) {
      return res.status(400).json({ error: 'Tema e nível de dificuldade são obrigatórios' });
    }

    if (!['facil', 'medio', 'dificil'].includes(nivel_dificuldade)) {
      return res.status(400).json({ error: 'Nível de dificuldade deve ser: facil, medio ou dificil' });
    }

    const competencias = [competencia_1, competencia_2, competencia_3, competencia_4, competencia_5];
    
    for (let i = 0; i < competencias.length; i++) {
      const comp = competencias[i];
      if (comp === undefined || comp === null || comp === '') {
        return res.status(400).json({ error: `Competência ${i + 1} é obrigatória` });
      }
      
      const compNum = parseInt(comp);
      if (isNaN(compNum) || compNum < 0 || compNum > 200) {
        return res.status(400).json({ error: `Competência ${i + 1} deve ser um número entre 0 e 200` });
      }
    }

    const client = await pool.connect();
    
    try {
      // Verificar se a redação existe e pertence ao usuário
      const existsResult = await client.query(`
        SELECT id FROM redacoes WHERE id = $1 AND user_id = $2
      `, [parseInt(id), req.user.id]);

      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Redação não encontrada' });
      }

      const result = await client.query(`
        UPDATE redacoes 
        SET 
          tema = $1, 
          nivel_dificuldade = $2, 
          competencia_1 = $3, 
          competencia_2 = $4, 
          competencia_3 = $5, 
          competencia_4 = $6, 
          competencia_5 = $7, 
          observacoes = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND user_id = $10
        RETURNING *
      `, [
        tema, nivel_dificuldade,
        parseInt(competencia_1), parseInt(competencia_2), parseInt(competencia_3),
        parseInt(competencia_4), parseInt(competencia_5), observacoes,
        parseInt(id), req.user.id
      ]);

      const redacao = result.rows[0];

      // Atualizar a nota mais recente nas estatísticas
      await client.query(`
        UPDATE user_stats 
        SET 
          nota_redacao = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [req.user.id, redacao.nota_final]);

      // Registrar atividade de atualização
      await client.query(`
        INSERT INTO user_activities (user_id, tipo, descricao, pontuacao, materia)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        req.user.id,
        'redacao_atualizada',
        `Redação atualizada: ${tema.substring(0, 50)}${tema.length > 50 ? '...' : ''}`,
        redacao.nota_final,
        'Redação'
      ]);

      res.json({
        message: 'Redação atualizada com sucesso!',
        redacao: redacao
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao atualizar redação:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Deletar redação
app.delete('/api/redacoes/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'ID da redação inválido' });
    }

    const client = await pool.connect();
    
    try {
      // Verificar se a redação existe e pertence ao usuário
      const existsResult = await client.query(`
        SELECT tema, nota_final FROM redacoes WHERE id = $1 AND user_id = $2
      `, [parseInt(id), req.user.id]);

      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Redação não encontrada' });
      }

      const redacao = existsResult.rows[0];

      // Deletar a redação
      await client.query(`
        DELETE FROM redacoes WHERE id = $1 AND user_id = $2
      `, [parseInt(id), req.user.id]);

      // Atualizar estatísticas (decrementar contador)
      await client.query(`
        UPDATE user_stats 
        SET 
          redacoes_escritas = GREATEST(redacoes_escritas - 1, 0),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [req.user.id]);

      // Buscar a nota mais recente para atualizar
      const lastRedacaoResult = await client.query(`
        SELECT nota_final FROM redacoes 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `, [req.user.id]);

      const ultimaNota = lastRedacaoResult.rows[0]?.nota_final || 0;

      // Atualizar nota mais recente
      await client.query(`
        UPDATE user_stats 
        SET nota_redacao = $2
        WHERE user_id = $1
      `, [req.user.id, ultimaNota]);

      // Registrar atividade
      await client.query(`
        INSERT INTO user_activities (user_id, tipo, descricao, materia)
        VALUES ($1, $2, $3, $4)
      `, [
        req.user.id,
        'redacao_deletada',
        `Redação removida: ${redacao.tema.substring(0, 50)}${redacao.tema.length > 50 ? '...' : ''}`,
        'Redação'
      ]);

      res.json({
        message: 'Redação deletada com sucesso!'
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao deletar redação:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas de redações
app.get('/api/redacoes/stats', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      // Estatísticas gerais
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_redacoes,
          AVG(nota_final) as media_geral,
          MAX(nota_final) as melhor_nota,
          MIN(nota_final) as pior_nota,
          AVG(competencia_1) as media_c1,
          AVG(competencia_2) as media_c2,
          AVG(competencia_3) as media_c3,
          AVG(competencia_4) as media_c4,
          AVG(competencia_5) as media_c5
        FROM redacoes 
        WHERE user_id = $1
      `, [req.user.id]);

      // Estatísticas por nível
      const nivelResult = await client.query(`
        SELECT 
          nivel_dificuldade,
          COUNT(*) as quantidade,
          AVG(nota_final) as media_nota
        FROM redacoes 
        WHERE user_id = $1
        GROUP BY nivel_dificuldade
        ORDER BY nivel_dificuldade
      `, [req.user.id]);

      // Evolução mensal (últimos 6 meses)
      const evolucaoResult = await client.query(`
        SELECT 
          DATE_TRUNC('month', created_at) as mes,
          COUNT(*) as quantidade,
          AVG(nota_final) as media_nota
        FROM redacoes 
        WHERE user_id = $1 
          AND created_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY mes
      `, [req.user.id]);

      // Últimas 5 redações
      const ultimasResult = await client.query(`
        SELECT id, tema, nota_final, nivel_dificuldade, created_at
        FROM redacoes 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      `, [req.user.id]);

      const stats = statsResult.rows[0];

      res.json({
        geral: {
          totalRedacoes: parseInt(stats.total_redacoes) || 0,
          mediaGeral: parseFloat(stats.media_geral) || 0,
          melhorNota: parseInt(stats.melhor_nota) || 0,
          piorNota: parseInt(stats.pior_nota) || 0,
          mediaCompetencias: {
            c1: parseFloat(stats.media_c1) || 0,
            c2: parseFloat(stats.media_c2) || 0,
            c3: parseFloat(stats.media_c3) || 0,
            c4: parseFloat(stats.media_c4) || 0,
            c5: parseFloat(stats.media_c5) || 0
          }
        },
        porNivel: nivelResult.rows.map(row => ({
          nivel: row.nivel_dificuldade,
          quantidade: parseInt(row.quantidade),
          mediaNota: parseFloat(row.media_nota)
        })),
        evolucaoMensal: evolucaoResult.rows.map(row => ({
          mes: row.mes,
          quantidade: parseInt(row.quantidade),
          mediaNota: parseFloat(row.media_nota)
        })),
        ultimasRedacoes: ultimasResult.rows
      });

    } finally {
      client.release();
    }

  } catch (err) {
    console.error('Erro ao buscar estatísticas de redações:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar estatísticas do usuário
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

// Rota para adicionar nova atividade
app.post('/api/user-activities', authenticateToken, async (req, res) => {
  try {
    const { tipo, descricao, pontuacao, materia } = req.body;

    if (!tipo || !descricao) {
      return res.status(400).json({ error: 'Tipo e descrição são obrigatórios' });
    }

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

// ROTAS DE PÁGINAS

// Rota principal - Login/Cadastro
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

// Rota da tela principal (Dashboard) - PROTEGIDA
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
// Rota para logout
app.post('/api/logout', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    
    try {
      // Registrar atividade de logout
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

// Middleware para verificar se usuário está logado (para páginas protegidas)
const checkAuthPage = (req, res, next) => {
  // Para páginas HTML, não podemos verificar o token aqui
  // A verificação será feita no JavaScript do frontend
  next();
};

// Rotas futuras para outras páginas (protegidas)
app.get('/simulados.html', checkAuthPage, (req, res) => {
  const filePath = path.join(__dirname, 'public', 'simulados.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Simulados está sendo desenvolvida.</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

app.get('/redacao.html', checkAuthPage, (req, res) => {
  const filePath = path.join(__dirname, 'public', 'redacao.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Redação está sendo desenvolvida.</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

app.get('/materias.html', checkAuthPage, (req, res) => {
  const filePath = path.join(__dirname, 'public', 'materias.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Matérias está sendo desenvolvida.</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

app.get('/relatorios.html', checkAuthPage, (req, res) => {
  const filePath = path.join(__dirname, 'public', 'relatorios.html');
  const fs = require('fs');
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send(`
      <h1>cicloVest - Página em Desenvolvimento</h1>
      <p>A página de Relatórios está sendo desenvolvida.</p>
      <a href="/MainPage.html">Voltar ao Dashboard</a>
    `);
  }
});

// Rota catch-all para SPAs e páginas não encontradas
app.use('*', (req, res) => {
  console.log('Rota não encontrada:', req.originalUrl);
  
  if (req.originalUrl.startsWith('/api')) {
    res.status(404).json({ error: 'Endpoint da API não encontrado' });
  } else {
    // Para outras rotas, verificar se é uma página protegida
    const protectedPages = ['/MainPage.html', '/simulados.html', '/redacao.html', '/materias.html', '/relatorios.html'];
    const isProtectedPage = protectedPages.some(page => req.originalUrl.includes(page.replace('.html', '')));
    
    if (isProtectedPage) {
      // Redirecionar para MainPage se for uma página protegida
      const mainPagePath = path.join(__dirname, 'public', 'MainPage.html');
      const fs = require('fs');
      
      if (fs.existsSync(mainPagePath)) {
        res.sendFile(mainPagePath);
      } else {
        res.redirect('/');
      }
    } else {
      // Para outras rotas, redirecionar para login
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

// Inicialização do servidor
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Servidor cicloVest rodando em http://localhost:${port}`);
  console.log(`Servindo arquivos estáticos de: ${path.join(__dirname, 'public')}`);
  
  // Verificar se os arquivos existem
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
    'redacao.js'
  ];
  
  console.log('\n📋 Verificando arquivos:');
  files.forEach(file => {
    const filePath = path.join(publicDir, file);
    const exists = fs.existsSync(filePath);
    console.log(`${exists ? '✅' : '❌'} ${file}: ${filePath}`);
  });
});

module.exports = app;
