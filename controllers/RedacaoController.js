const pool = require('../config/database');

class RedacaoController {
  // Criar uma nova redação
  static async criarRedacao(req, res) {
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

      const userId = req.user.id;

      // Validações
      if (!tema || !nivel_dificuldade || 
          competencia_1 === undefined || competencia_2 === undefined || 
          competencia_3 === undefined || competencia_4 === undefined || 
          competencia_5 === undefined) {
        return res.status(400).json({ 
          error: 'Tema, nível de dificuldade e todas as competências são obrigatórios' 
        });
      }

      // Validar competências (0-200)
      const competencias = [competencia_1, competencia_2, competencia_3, competencia_4, competencia_5];
      for (let comp of competencias) {
        if (comp < 0 || comp > 200) {
          return res.status(400).json({ 
            error: 'Cada competência deve ter valor entre 0 e 200' 
          });
        }
      }

      const client = await pool.connect();

      try {
        // Remover nota_final da inserção - será calculada automaticamente
        const result = await client.query(`
          INSERT INTO redacoes (
            user_id, tema, nivel_dificuldade, 
            competencia_1, competencia_2, competencia_3, competencia_4, competencia_5,
            observacoes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `, [
          userId, tema, nivel_dificuldade,
          competencia_1, competencia_2, competencia_3, competencia_4, competencia_5,
          observacoes
        ]);

        const redacao = result.rows[0];

        // Registrar atividade usando a nota_final calculada
        await client.query(
          'INSERT INTO user_activities (user_id, tipo, descricao, pontuacao) VALUES ($1, $2, $3, $4)',
          [userId, 'redacao', `Nova redação: ${tema}`, redacao.nota_final]
        );

        // Atualizar estatísticas do usuário
        await client.query(`
          UPDATE user_stats 
          SET 
            redacoes_escritas = redacoes_escritas + 1,
            nota_redacao = (
              SELECT AVG(nota_final) 
              FROM redacoes 
              WHERE user_id = $1
            ),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `, [userId]);

        res.status(201).json({
          message: 'Redação criada com sucesso!',
          redacao: redacao
        });

      } finally {
        client.release();
      }

    } catch (err) {
      console.error('Erro ao criar redação:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Listar redações do usuário
  static async listarRedacoes(req, res) {
    try {
      const userId = req.user.id;
      const { 
        page = 1, 
        limit = 10, 
        nivel = '', 
        orderBy = 'created_at', 
        order = 'DESC' 
      } = req.query;

      const offset = (page - 1) * limit;

      // Construir filtros
      let whereClause = 'WHERE user_id = $1';
      let queryParams = [userId];
      let paramCount = 1;

      if (nivel) {
        paramCount++;
        whereClause += ` AND nivel_dificuldade = $${paramCount}`;
        queryParams.push(nivel);
      }

      // Validar orderBy
      const validOrderBy = ['created_at', 'nota_final', 'tema'];
      const validOrderDir = ['ASC', 'DESC'];
      
      const finalOrderBy = validOrderBy.includes(orderBy) ? orderBy : 'created_at';
      const finalOrderDir = validOrderDir.includes(order) ? order : 'DESC';

      const client = await pool.connect();

      try {
        // Contar total de redações
        const countResult = await client.query(`
          SELECT COUNT(*) as total FROM redacoes ${whereClause}
        `, queryParams);

        const total = parseInt(countResult.rows[0].total);

        // Buscar redações
        const result = await client.query(`
          SELECT * FROM redacoes 
          ${whereClause}
          ORDER BY ${finalOrderBy} ${finalOrderDir}
          LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...queryParams, limit, offset]);

        const totalPages = Math.ceil(total / limit);

        res.json({
          redacoes: result.rows,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        });

      } finally {
        client.release();
      }

    } catch (err) {
      console.error('Erro ao listar redações:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Buscar redação por ID
  static async buscarRedacao(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const client = await pool.connect();

      try {
        const result = await client.query(
          'SELECT * FROM redacoes WHERE id = $1 AND user_id = $2',
          [id, userId]
        );

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
  }

  // Atualizar redação
  static async atualizarRedacao(req, res) {
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

      const userId = req.user.id;

      // Validações
      if (!tema || !nivel_dificuldade || 
          competencia_1 === undefined || competencia_2 === undefined || 
          competencia_3 === undefined || competencia_4 === undefined || 
          competencia_5 === undefined) {
        return res.status(400).json({ 
          error: 'Tema, nível de dificuldade e todas as competências são obrigatórios' 
        });
      }

      // Validar competências (0-200)
      const competencias = [competencia_1, competencia_2, competencia_3, competencia_4, competencia_5];
      for (let comp of competencias) {
        if (comp < 0 || comp > 200) {
          return res.status(400).json({ 
            error: 'Cada competência deve ter valor entre 0 e 200' 
          });
        }
      }

      const client = await pool.connect();

      try {
        // Remover nota_final do UPDATE - será calculada automaticamente
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
          competencia_1, competencia_2, competencia_3, competencia_4, competencia_5,
          observacoes, id, userId
        ]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Redação não encontrada' });
        }

        const redacao = result.rows[0];

        // Registrar atividade usando a nota_final calculada
        await client.query(
          'INSERT INTO user_activities (user_id, tipo, descricao, pontuacao) VALUES ($1, $2, $3, $4)',
          [userId, 'redacao_editada', `Redação editada: ${tema}`, redacao.nota_final]
        );

        // Atualizar estatísticas do usuário
        await client.query(`
          UPDATE user_stats 
          SET 
            nota_redacao = (
              SELECT AVG(nota_final) 
              FROM redacoes 
              WHERE user_id = $1
            ),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `, [userId]);

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
  }

  // Excluir redação
  static async excluirRedacao(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const client = await pool.connect();

      try {
        const result = await client.query(
          'DELETE FROM redacoes WHERE id = $1 AND user_id = $2 RETURNING tema',
          [id, userId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Redação não encontrada' });
        }

        // Registrar atividade
        await client.query(
          'INSERT INTO user_activities (user_id, tipo, descricao) VALUES ($1, $2, $3)',
          [userId, 'redacao_excluida', `Redação excluída: ${result.rows[0].tema}`]
        );

        // Atualizar estatísticas do usuário
        await client.query(`
          UPDATE user_stats 
          SET 
            redacoes_escritas = GREATEST(redacoes_escritas - 1, 0),
            nota_redacao = COALESCE((
              SELECT AVG(nota_final) 
              FROM redacoes 
              WHERE user_id = $1
            ), 0),
            updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1
        `, [userId]);

        res.json({ message: 'Redação excluída com sucesso!' });

      } finally {
        client.release();
      }

    } catch (err) {
      console.error('Erro ao excluir redação:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  // Estatísticas de redações
  static async estatisticasRedacoes(req, res) {
    try {
      const userId = req.user.id;

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
        `, [userId]);

        // Estatísticas por nível
        const nivelResult = await client.query(`
          SELECT 
            nivel_dificuldade,
            COUNT(*) as quantidade,
            AVG(nota_final) as media
          FROM redacoes 
          WHERE user_id = $1
          GROUP BY nivel_dificuldade
        `, [userId]);

        // Últimas redações
        const ultimasResult = await client.query(`
          SELECT tema, nota_final, created_at
          FROM redacoes 
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 5
        `, [userId]);

        const stats = statsResult.rows[0];

        res.json({
          estatisticas: {
            total_redacoes: parseInt(stats.total_redacoes) || 0,
            media_geral: parseFloat(stats.media_geral) || 0,
            melhor_nota: parseInt(stats.melhor_nota) || 0,
            pior_nota: parseInt(stats.pior_nota) || 0,
            competencias: {
              c1: parseFloat(stats.media_c1) || 0,
              c2: parseFloat(stats.media_c2) || 0,
              c3: parseFloat(stats.media_c3) || 0,
              c4: parseFloat(stats.media_c4) || 0,
              c5: parseFloat(stats.media_c5) || 0
            }
          },
          por_nivel: nivelResult.rows,
          ultimas_redacoes: ultimasResult.rows
        });

      } finally {
        client.release();
      }

    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
}

module.exports = RedacaoController;
