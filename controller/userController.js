const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'ciclovest_secret_key';

class UserController {
  // Cadastro de usuário
  static async register(req, res) {
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
  }

  // Login de usuário
  static async login(req, res) {
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
  }

  // Obter perfil do usuário
  static async getProfile(req, res) {
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
  }
}

module.exports = UserController;
