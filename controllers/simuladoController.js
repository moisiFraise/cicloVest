const pool = require('../config/database');

async function atualizarEstatisticasUsuario(userId, client) {
  try {
    const simuladosStats = await client.query(`
      SELECT 
        COUNT(*) as total_simulados,
        AVG(porcentagem_acertos) as media_simulados,
        SUM(total_questoes) as total_questoes,
        SUM(questoes_acertadas) as questoes_corretas
      FROM simulados 
      WHERE user_id = $1
    `, [userId]);

    const stats = simuladosStats.rows[0];

    const existingStats = await client.query(
      'SELECT user_id FROM user_stats WHERE user_id = $1',
      [userId]
    );

    if (existingStats.rows.length === 0) {
      await client.query(`
        INSERT INTO user_stats (
          user_id, simulados_realizados, media_simulados, 
          total_questoes, questoes_corretas
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        parseInt(stats.total_simulados) || 0,
        parseFloat(stats.media_simulados) || 0,
        parseInt(stats.total_questoes) || 0,
        parseInt(stats.questoes_corretas) || 0
      ]);
    } else {
      await client.query(`
        UPDATE user_stats 
        SET 
          simulados_realizados = $2,
          media_simulados = $3,
          total_questoes = $4,
          questoes_corretas = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `, [
        userId,
        parseInt(stats.total_simulados) || 0,
        parseFloat(stats.media_simulados) || 0,
        parseInt(stats.total_questoes) || 0,
        parseInt(stats.questoes_corretas) || 0
      ]);
    }

  } catch (err) {
    console.error('Erro ao atualizar estatísticas do usuário:', err);
  }
}

const simuladoController = {
    async listarSimulados(req, res) {
        try {
            const userId = req.user.id;
            const client = await pool.connect();
            
            try {
                const result = await client.query(`
                    SELECT 
                        id,
                        nome,
                        tipo_simulado,
                        dia_prova,
                        total_questoes,
                        questoes_acertadas,
                        porcentagem_acertos,
                        data_realizacao,
                        tempo_realizacao,
                        nivel_dificuldade,
                        descricao,
                        created_at
                    FROM simulados 
                    WHERE user_id = $1 
                    ORDER BY data_realizacao DESC, created_at DESC
                `, [userId]);

                res.json({
                    success: true,
                    simulados: result.rows
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Erro ao listar simulados:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    async buscarSimulado(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const client = await pool.connect();

            try {
                const result = await client.query(`
                    SELECT 
                        id,
                        nome,
                        tipo_simulado,
                        dia_prova,
                        total_questoes,
                        questoes_acertadas,
                        porcentagem_acertos,
                        data_realizacao,
                        tempo_realizacao,
                        nivel_dificuldade,
                        descricao,
                        created_at
                    FROM simulados 
                    WHERE id = $1 AND user_id = $2
                `, [id, userId]);

                if (result.rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Simulado não encontrado'
                    });
                }

                res.json({
                    success: true,
                    simulado: result.rows[0]
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Erro ao buscar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    async criarSimulado(req, res) {
        try {
            const userId = req.user.id;
            const {
                nome,
                tipo_simulado,
                dia_prova,
                total_questoes,
                questoes_acertadas,
                data_realizacao,
                tempo_realizacao,
                nivel_dificuldade,
                descricao
            } = req.body;

            console.log('Dados recebidos para criar simulado:', req.body);

            if (!nome || !tipo_simulado || !dia_prova || !total_questoes || 
                questoes_acertadas === undefined || !data_realizacao || 
                !tempo_realizacao || !nivel_dificuldade) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos os campos obrigatórios devem ser preenchidos'
                });
            }

            const totalQuestoes = parseInt(total_questoes);
            const questoesAcertadas = parseInt(questoes_acertadas);
            const tempoRealizacao = parseInt(tempo_realizacao);

            if (isNaN(totalQuestoes) || totalQuestoes <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Total de questões deve ser um número maior que zero'
                });
            }

            if (isNaN(questoesAcertadas) || questoesAcertadas < 0 || questoesAcertadas > totalQuestoes) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de questões acertadas inválido'
                });
            }

            if (isNaN(tempoRealizacao) || tempoRealizacao <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tempo de realização deve ser um número maior que zero'
                });
            }

            const client = await pool.connect();
            
            try {
                const result = await client.query(`
                    INSERT INTO simulados (
                        user_id, nome, tipo_simulado, dia_prova, total_questoes,
                        questoes_acertadas, data_realizacao, tempo_realizacao,
                        nivel_dificuldade, descricao
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING 
                        id, nome, tipo_simulado, dia_prova, total_questoes,
                        questoes_acertadas, porcentagem_acertos, data_realizacao,
                        tempo_realizacao, nivel_dificuldade, descricao, created_at
                `, [
                    userId, nome, tipo_simulado, dia_prova, totalQuestoes,
                    questoesAcertadas, data_realizacao, tempoRealizacao,
                    nivel_dificuldade, descricao || null
                ]);

                await atualizarEstatisticasUsuario(userId, client);

                res.status(201).json({
                    success: true,
                    message: 'Simulado criado com sucesso',
                    simulado: result.rows[0]
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Erro ao criar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor: ' + error.message
            });
        }
    },

    async atualizarSimulado(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const {
                nome,
                tipo_simulado,
                dia_prova,
                total_questoes,
                questoes_acertadas,
                data_realizacao,
                tempo_realizacao,
                nivel_dificuldade,
                descricao
            } = req.body;

            console.log('Dados recebidos para atualizar simulado:', { id, ...req.body });

            if (!nome || !tipo_simulado || !dia_prova || !total_questoes || 
                questoes_acertadas === undefined || !data_realizacao || 
                !tempo_realizacao || !nivel_dificuldade) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos os campos obrigatórios devem ser preenchidos'
                });
            }

            const totalQuestoes = parseInt(total_questoes);
            const questoesAcertadas = parseInt(questoes_acertadas);
            const tempoRealizacao = parseInt(tempo_realizacao);

            if (isNaN(totalQuestoes) || totalQuestoes <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Total de questões deve ser um número maior que zero'
                });
            }

            if (isNaN(questoesAcertadas) || questoesAcertadas < 0 || questoesAcertadas > totalQuestoes) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de questões acertadas inválido'
                });
            }

            if (isNaN(tempoRealizacao) || tempoRealizacao <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Tempo de realização deve ser um número maior que zero'
                });
            }

            const client = await pool.connect();
            
            try {
                const existeSimulado = await client.query(
                    'SELECT id FROM simulados WHERE id = $1 AND user_id = $2',
                    [id, userId]
                );

                if (existeSimulado.rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Simulado não encontrado'
                    });
                }

                const result = await client.query(`
                    UPDATE simulados SET
                        nome = $1,
                        tipo_simulado = $2,
                        dia_prova = $3,
                        total_questoes = $4,
                        questoes_acertadas = $5,
                        data_realizacao = $6,
                        tempo_realizacao = $7,
                        nivel_dificuldade = $8,
                        descricao = $9,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $10 AND user_id = $11
                    RETURNING 
                        id, nome, tipo_simulado, dia_prova, total_questoes,
                        questoes_acertadas, porcentagem_acertos, data_realizacao,
                        tempo_realizacao, nivel_dificuldade, descricao, updated_at
                `, [
                    nome, tipo_simulado, dia_prova, totalQuestoes,
                    questoesAcertadas, data_realizacao, tempoRealizacao,
                    nivel_dificuldade, descricao || null, id, userId
                ]);

                await atualizarEstatisticasUsuario(userId, client);

                res.json({
                    success: true,
                    message: 'Simulado atualizado com sucesso',
                    simulado: result.rows[0]
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Erro ao atualizar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor: ' + error.message
            });
        }
    },

    async deletarSimulado(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const client = await pool.connect();

            try {
                const result = await client.query(
                    'DELETE FROM simulados WHERE id = $1 AND user_id = $2 RETURNING id',
                    [id, userId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'Simulado não encontrado'
                    });
                }

                await atualizarEstatisticasUsuario(userId, client);

                res.json({
                    success: true,
                    message: 'Simulado deletado com sucesso'
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Erro ao deletar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    async obterEstatisticas(req, res) {
        try {
            const userId = req.user.id;
            const client = await pool.connect();

            try {
                const result = await client.query(`
                    SELECT 
                        COUNT(*) as total_simulados,
                        ROUND(AVG(porcentagem_acertos), 2) as media_acertos,
                        MAX(porcentagem_acertos) as melhor_resultado,
                        MIN(porcentagem_acertos) as pior_resultado,
                        SUM(total_questoes) as total_questoes_feitas,
                        SUM(questoes_acertadas) as total_questoes_acertadas,
                        ROUND(AVG(tempo_realizacao), 0) as tempo_medio
                    FROM simulados 
                    WHERE user_id = $1
                `, [userId]);

                              const estatisticasPorTipo = await client.query(`
                    SELECT 
                        tipo_simulado,
                        COUNT(*) as quantidade,
                        ROUND(AVG(porcentagem_acertos), 2) as media_acertos
                    FROM simulados 
                    WHERE user_id = $1
                    GROUP BY tipo_simulado
                    ORDER BY media_acertos DESC
                `, [userId]);

                const estatisticasPorDia = await client.query(`
                    SELECT 
                        dia_prova,
                        COUNT(*) as quantidade,
                        ROUND(AVG(porcentagem_acertos), 2) as media_acertos
                    FROM simulados 
                    WHERE user_id = $1
                    GROUP BY dia_prova
                `, [userId]);

                const evolucaoMensal = await client.query(`
                    SELECT 
                        DATE_TRUNC('month', data_realizacao) as mes,
                        COUNT(*) as simulados_realizados,
                        ROUND(AVG(porcentagem_acertos), 2) as media_acertos
                    FROM simulados 
                    WHERE user_id = $1
                    GROUP BY DATE_TRUNC('month', data_realizacao)
                    ORDER BY mes DESC
                    LIMIT 12
                `, [userId]);

                res.json({
                    success: true,
                    estatisticas: {
                        geral: result.rows[0],
                        por_tipo: estatisticasPorTipo.rows,
                        por_dia: estatisticasPorDia.rows,
                        evolucao_mensal: evolucaoMensal.rows
                    }
                });
            } finally {
                client.release();
            }
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
};

module.exports = simuladoController;
