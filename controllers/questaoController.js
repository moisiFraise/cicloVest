const pool = require('../config/database');

const questaoController = {
  // Criar nova sessão de questões
  async criarQuestao(req, res) {
    const client = await pool.connect();
    
    try {
      const { 
        materia, 
        total_questoes, 
        questoes_acertadas, 
        tempo_total_minutos,
        data_realizacao,
        observacoes 
      } = req.body;
      
      const userId = req.user.id;

      // Validações
      if (!materia || !total_questoes || questoes_acertadas === undefined) {
        return res.status(400).json({ 
          error: 'Matéria, total de questões e questões acertadas são obrigatórios' 
        });
      }

      if (questoes_acertadas > total_questoes) {
        return res.status(400).json({ 
          error: 'Questões acertadas não pode ser maior que o total de questões' 
        });
      }

      if (total_questoes <= 0 || questoes_acertadas < 0) {
        return res.status(400).json({ 
          error: 'Valores inválidos para questões' 
        });
      }

      // Calcular tempo médio por questão se tempo total foi fornecido
      const tempo_medio_por_questao = tempo_total_minutos ? 
        parseFloat((tempo_total_minutos / total_questoes).toFixed(2)) : null;

      await client.query('BEGIN');

      // Inserir questão (sem incluir colunas geradas)
      const questaoQuery = `
        INSERT INTO questoes (
          user_id, materia, total_questoes, questoes_acertadas,
          tempo_total_minutos, tempo_medio_por_questao,
          data_realizacao, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const questaoResult = await client.query(questaoQuery, [
        userId, 
        materia, 
        total_questoes, 
        questoes_acertadas,
        tempo_total_minutos || null, 
        tempo_medio_por_questao,
        data_realizacao || new Date().toISOString().split('T')[0], 
        observacoes || null
      ]);

      // Registrar atividade
      const atividadeQuery = `
        INSERT INTO user_activities (user_id, tipo, descricao, pontuacao, materia)
        VALUES ($1, $2, $3, $4, $5)
      `;

      const descricaoAtividade = `Resolveu ${total_questoes} questões de ${materia} (${questoes_acertadas} acertos)`;
      const pontuacao = questoes_acertadas * 2; // 2 pontos por acerto

      await client.query(atividadeQuery, [
        userId, 'questoes', descricaoAtividade, pontuacao, materia
      ]);

      // Atualizar estatísticas do usuário - LINHA CORRIGIDA
      await questaoController.atualizarEstatisticas(client, userId);

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Questões registradas com sucesso!',
        questao: questaoResult.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao criar questão:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  },

  // Listar questões do usuário
  async listarQuestoes(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, materia, data_inicio, data_fim } = req.query;
      
      let whereConditions = ['user_id = $1'];
      let queryParams = [userId];
      let paramCount = 1;

      if (materia) {
        paramCount++;
        whereConditions.push(`materia = $${paramCount}`);
        queryParams.push(materia);
      }

      if (data_inicio) {
        paramCount++;
        whereConditions.push(`data_realizacao >= $${paramCount}`);
        queryParams.push(data_inicio);
      }

      if (data_fim) {
        paramCount++;
        whereConditions.push(`data_realizacao <= $${paramCount}`);
        queryParams.push(data_fim);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      queryParams.push(limit);
      paramCount++;
      queryParams.push(offset);

      const query = `
        SELECT 
          id, materia, total_questoes, questoes_acertadas, questoes_erradas,
          porcentagem_acertos, tempo_total_minutos, tempo_medio_por_questao,
          data_realizacao, observacoes, created_at
        FROM questoes 
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY data_realizacao DESC, created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await pool.query(query, queryParams);

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM questoes 
        WHERE ${whereConditions.join(' AND ')}
      `;
      
      const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
      const total = parseInt(countResult.rows[0].total);

      res.json({
        questoes: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      console.error('Erro ao listar questões:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async obterQuestao(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const query = `
        SELECT 
          id, materia, total_questoes, questoes_acertadas, questoes_erradas,
          porcentagem_acertos, tempo_total_minutos, tempo_medio_por_questao,
          data_realizacao, observacoes, created_at
        FROM questoes 
        WHERE id = $1 AND user_id = $2
      `;

      const result = await pool.query(query, [id, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Questão não encontrada' });
      }

      const questao = result.rows[0];
      
      questao.data_realizacao = questao.data_realizacao.toISOString().split('T')[0];

      res.json(questao);
    } catch (error) {
      console.error('Erro ao obter questão:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async atualizarQuestao(req, res) {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const { 
        materia, 
        total_questoes, 
        questoes_acertadas, 
        tempo_total_minutos,
        data_realizacao,
        observacoes 
      } = req.body;
      
      const userId = req.user.id;

      const checkQuery = 'SELECT id FROM questoes WHERE id = $1 AND user_id = $2';
      const checkResult = await client.query(checkQuery, [id, userId]);

      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Questão não encontrada' });
      }

      if (questoes_acertadas > total_questoes) {
        return res.status(400).json({ 
          error: 'Questões acertadas não pode ser maior que o total de questões' 
        });
      }

      const tempo_medio_por_questao = tempo_total_minutos ? 
        parseFloat((tempo_total_minutos / total_questoes).toFixed(2)) : null;

      await client.query('BEGIN');

      const updateQuery = `
        UPDATE questoes 
        SET materia = $1, total_questoes = $2, questoes_acertadas = $3,
            tempo_total_minutos = $4, tempo_medio_por_questao = $5,
            data_realizacao = $6, observacoes = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND user_id = $9
        RETURNING *
      `;

      const result = await client.query(updateQuery, [
        materia, 
        total_questoes, 
        questoes_acertadas,
        tempo_total_minutos || null, 
        tempo_medio_por_questao,
        data_realizacao, 
        observacoes || null, 
        id, 
        userId
      ]);

      await questaoController.atualizarEstatisticas(client, userId);

      await client.query('COMMIT');

      res.json({
        message: 'Questão atualizada com sucesso!',
        questao: result.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao atualizar questão:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  },

  async deletarQuestao(req, res) {
    const client = await pool.connect();
    
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await client.query('BEGIN');

      const deleteQuery = 'DELETE FROM questoes WHERE id = $1 AND user_id = $2 RETURNING *';
      const result = await client.query(deleteQuery, [id, userId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Questão não encontrada' });
      }

      await questaoController.atualizarEstatisticas(client, userId);

      await client.query('COMMIT');

      res.json({ message: 'Questão deletada com sucesso!' });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Erro ao deletar questão:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      client.release();
    }
  },

  async obterEstatisticas(req, res) {
    try {
      const userId = req.user.id;
      const { periodo = '30' } = req.query; // últimos 30 dias por padrão

      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - parseInt(periodo));

      const statsQuery = `
        SELECT 
          COUNT(*) as total_sessoes,
          COALESCE(SUM(total_questoes), 0) as total_questoes,
          COALESCE(SUM(questoes_acertadas), 0) as total_acertos,
          COALESCE(SUM(questoes_erradas), 0) as total_erros,
          COALESCE(ROUND(AVG(porcentagem_acertos), 2), 0) as media_acertos,
          COALESCE(ROUND(AVG(tempo_medio_por_questao), 2), 0) as tempo_medio_geral
        FROM questoes 
        WHERE user_id = $1 AND data_realizacao >= $2
      `;

      const statsResult = await pool.query(statsQuery, [userId, dataLimite.toISOString().split('T')[0]]);

      const materiaQuery = `
        SELECT 
          materia,
          COUNT(*) as sessoes,
          SUM(total_questoes) as questoes,
          SUM(questoes_acertadas) as acertos,
          ROUND(AVG(porcentagem_acertos), 2) as media_acertos
        FROM questoes 
        WHERE user_id = $1 AND data_realizacao >= $2
        GROUP BY materia
        ORDER BY questoes DESC
      `;

      const materiaResult = await pool.query(materiaQuery, [userId, dataLimite.toISOString().split('T')[0]]);

      const evolucaoQuery = `
        SELECT 
          data_realizacao,
          SUM(total_questoes) as questoes_dia,
          SUM(questoes_acertadas) as acertos_dia,
          ROUND(AVG(porcentagem_acertos), 2) as media_dia
        FROM questoes 
        WHERE user_id = $1 AND data_realizacao >= $2
        GROUP BY data_realizacao
        ORDER BY data_realizacao DESC
        LIMIT 7
      `;

      const dataLimite7 = new Date();
      dataLimite7.setDate(dataLimite7.getDate() - 7);
      
      const evolucaoResult = await pool.query(evolucaoQuery, [userId, dataLimite7.toISOString().split('T')[0]]);

      res.json({
        estatisticas_gerais: statsResult.rows[0],
        por_materia: materiaResult.rows,
        evolucao_diaria: evolucaoResult.rows
      });

    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async atualizarEstatisticas(client, userId) {
    const statsQuery = `
      SELECT 
        COALESCE(SUM(total_questoes), 0) as total_questoes,
        COALESCE(SUM(questoes_acertadas), 0) as questoes_corretas
      FROM questoes 
      WHERE user_id = $1
    `;

    const statsResult = await client.query(statsQuery, [userId]);
    const { total_questoes, questoes_corretas } = statsResult.rows[0];

    const updateStatsQuery = `
      INSERT INTO user_stats (user_id, total_questoes, questoes_corretas)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        total_questoes = EXCLUDED.total_questoes,
        questoes_corretas = EXCLUDED.questoes_corretas,
        updated_at = CURRENT_TIMESTAMP
    `;

    await client.query(updateStatsQuery, [userId, total_questoes, questoes_corretas]);
  }
};

module.exports = questaoController;

