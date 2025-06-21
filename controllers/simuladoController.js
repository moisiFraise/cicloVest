const db = require('../config/database');

const simuladoController = {
    // Listar todos os simulados do usuário
    async listarSimulados(req, res) {
        try {
            const userId = req.user.id;
            const result = await db.query(`
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
        } catch (error) {
            console.error('Erro ao listar simulados:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    // Buscar simulado por ID
    async buscarSimulado(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await db.query(`
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
        } catch (error) {
            console.error('Erro ao buscar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    // Criar novo simulado
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

            // Validações
            if (!nome || !tipo_simulado || !dia_prova || !total_questoes || 
                questoes_acertadas === undefined || !data_realizacao || 
                !tempo_realizacao || !nivel_dificuldade) {
                return res.status(400).json({
                    success: false,
                    message: 'Todos os campos obrigatórios devem ser preenchidos'
                });
            }

            if (questoes_acertadas > total_questoes) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de questões acertadas não pode ser maior que o total'
                });
            }

            const result = await db.query(`
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
                userId, nome, tipo_simulado, dia_prova, total_questoes,
                questoes_acertadas, data_realizacao, tempo_realizacao,
                nivel_dificuldade, descricao
            ]);

            // Atualizar estatísticas do usuário
            await this.atualizarEstatisticas(userId);

            res.status(201).json({
                success: true,
                message: 'Simulado criado com sucesso',
                simulado: result.rows[0]
            });
        } catch (error) {
            console.error('Erro ao criar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    // Atualizar simulado
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

            // Verificar se o simulado existe e pertence ao usuário
            const existeSimulado = await db.query(
                'SELECT id FROM simulados WHERE id = $1 AND user_id = $2',
                [id, userId]
            );

            if (existeSimulado.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Simulado não encontrado'
                });
            }

            // Validações
            if (questoes_acertadas > total_questoes) {
                return res.status(400).json({
                    success: false,
                    message: 'Número de questões acertadas não pode ser maior que o total'
                });
            }

            const result = await db.query(`
                UPDATE simulados SET
                    nome = $1,
                    tipo_simulado = $2,
                    dia_prova = $3,
                    total_questoes = $4,
                    questoes_acertadas = $5,
                    data_realizacao = $6,
                    tempo_realizacao = $7,
                    nivel_dificuldade = $8,
                    descricao = $9
                WHERE id = $10 AND user_id = $11
                RETURNING 
                    id, nome, tipo_simulado, dia_prova, total_questoes,
                    questoes_acertadas, porcentagem_acertos, data_realizacao,
                    tempo_realizacao, nivel_dificuldade, descricao, updated_at
            `, [
                nome, tipo_simulado, dia_prova, total_questoes,
                questoes_acertadas, data_realizacao, tempo_realizacao,
                nivel_dificuldade, descricao, id, userId
            ]);

            // Atualizar estatísticas do usuário
            await this.atualizarEstatisticas(userId);

            res.json({
                success: true,
                message: 'Simulado atualizado com sucesso',
                simulado: result.rows[0]
            });
        } catch (error) {
            console.error('Erro ao atualizar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    // Deletar simulado
    async deletarSimulado(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const result = await db.query(
                'DELETE FROM simulados WHERE id = $1 AND user_id = $2 RETURNING id',
                [id, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Simulado não encontrado'
                });
            }

            // Atualizar estatísticas do usuário
            await this.atualizarEstatisticas(userId);

            res.json({
                success: true,
                message: 'Simulado deletado com sucesso'
            });
        } catch (error) {
            console.error('Erro ao deletar simulado:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    // Obter estatísticas dos simulados
      // Obter estatísticas dos simulados
    async obterEstatisticas(req, res) {
        try {
            const userId = req.user.id;

            const result = await db.query(`
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

            // Estatísticas por tipo de simulado
            const estatisticasPorTipo = await db.query(`
                SELECT 
                    tipo_simulado,
                    COUNT(*) as quantidade,
                    ROUND(AVG(porcentagem_acertos), 2) as media_acertos
                FROM simulados 
                WHERE user_id = $1
                GROUP BY tipo_simulado
                ORDER BY media_acertos DESC
            `, [userId]);

            // Estatísticas por dia da prova
            const estatisticasPorDia = await db.query(`
                SELECT 
                    dia_prova,
                    COUNT(*) as quantidade,
                    ROUND(AVG(porcentagem_acertos), 2) as media_acertos
                FROM simulados 
                WHERE user_id = $1
                GROUP BY dia_prova
            `, [userId]);

            // Evolução mensal
            const evolucaoMensal = await db.query(`
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
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    },

    // Atualizar estatísticas do usuário na tabela user_stats
    async atualizarEstatisticas(userId) {
        try {
            const stats = await db.query(`
                SELECT 
                    COUNT(*) as simulados_realizados,
                    ROUND(AVG(porcentagem_acertos), 2) as media_simulados,
                    SUM(total_questoes) as total_questoes,
                    SUM(questoes_acertadas) as questoes_corretas
                FROM simulados 
                WHERE user_id = $1
            `, [userId]);

            const { simulados_realizados, media_simulados, total_questoes, questoes_corretas } = stats.rows[0];

            await db.query(`
                INSERT INTO user_stats (user_id, simulados_realizados, media_simulados, total_questoes, questoes_corretas)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    simulados_realizados = $2,
                    media_simulados = $3,
                    total_questoes = EXCLUDED.total_questoes + user_stats.total_questoes - COALESCE((SELECT SUM(total_questoes) FROM simulados WHERE user_id = $1), 0) + $4,
                    questoes_corretas = EXCLUDED.questoes_corretas + user_stats.questoes_corretas - COALESCE((SELECT SUM(questoes_acertadas) FROM simulados WHERE user_id = $1), 0) + $5,
                    updated_at = CURRENT_TIMESTAMP
            `, [userId, simulados_realizados, media_simulados, total_questoes, questoes_corretas]);

        } catch (error) {
            console.error('Erro ao atualizar estatísticas do usuário:', error);
        }
    }
};

module.exports = simuladoController;
