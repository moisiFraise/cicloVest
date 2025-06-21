const pool = require('../config/database');

const estudoController = {
  async list(req, res) {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          SELECT * FROM estudos 
          WHERE user_id = $1 
          ORDER BY data_estudo DESC, created_at DESC
        `, [req.user.id]);

        res.json(result.rows);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao listar estudos:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async create(req, res) {
    try {
      const {
        materia,
        atividade,
        tempo,
        quantidade_questoes,
        descricao,
        data_estudo
      } = req.body;

      if (!materia || !tempo) {
        return res.status(400).json({ 
          error: 'Matéria e tempo são obrigatórios' 
        });
      }

      if (tempo <= 0) {
        return res.status(400).json({ 
          error: 'Tempo deve ser maior que zero' 
        });
      }

      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          INSERT INTO estudos (
            user_id, materia, atividade, tempo_minutos, 
            quantidade_questoes, descricao, data_estudo
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `, [
          req.user.id,
          materia,
          atividade || null,
          parseInt(tempo),
          quantidade_questoes ? parseInt(quantidade_questoes) : null,
          descricao || null,
          data_estudo || new Date().toISOString().split('T')[0]
        ]);

        res.status(201).json({
          message: 'Estudo registrado com sucesso!',
          estudo: result.rows[0]
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao criar estudo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async getStats(req, res) {
    try {
      const { period = 'daily' } = req.query;
      const client = await pool.connect();
      
      try {
        let dateFilter = '';
        let groupBy = '';
        let dateFormat = '';

        switch (period) {
          case 'weekly':
            dateFilter = "AND data_estudo >= CURRENT_DATE - INTERVAL '7 days'";
            groupBy = 'data_estudo';
            dateFormat = "TO_CHAR(data_estudo, 'DD/MM')";
            break;
          case 'monthly':
            dateFilter = "AND data_estudo >= CURRENT_DATE - INTERVAL '30 days'";
            groupBy = 'data_estudo';
            dateFormat = "TO_CHAR(data_estudo, 'DD/MM')";
            break;
          case 'quarterly':
            dateFilter = "AND data_estudo >= CURRENT_DATE - INTERVAL '90 days'";
            groupBy = "DATE_TRUNC('week', data_estudo)";
            dateFormat = "TO_CHAR(DATE_TRUNC('week', data_estudo), 'DD/MM')";
            break;
          default: // daily
            dateFilter = "AND data_estudo >= CURRENT_DATE - INTERVAL '7 days'";
            groupBy = 'data_estudo';
            dateFormat = "TO_CHAR(data_estudo, 'DD/MM')";
        }

        const tempoQuery = `
          SELECT 
            ${dateFormat} as label,
            SUM(tempo_minutos) as total_tempo
          FROM estudos 
          WHERE user_id = $1 ${dateFilter}
          GROUP BY ${groupBy}
          ORDER BY ${groupBy}
        `;

        const tempoResult = await client.query(tempoQuery, [req.user.id]);

        const materiaQuery = `
          SELECT 
            materia,
            SUM(tempo_minutos) as total_tempo
          FROM estudos 
          WHERE user_id = $1 ${dateFilter}
          GROUP BY materia
          ORDER BY total_tempo DESC
        `;

        const materiaResult = await client.query(materiaQuery, [req.user.id]);

        const stats = {
          tempo: {
            labels: tempoResult.rows.map(row => row.label),
            data: tempoResult.rows.map(row => parseInt(row.total_tempo))
          },
          materias: {
            labels: materiaResult.rows.map(row => row.materia),
            data: materiaResult.rows.map(row => parseInt(row.total_tempo))
          }
        };

        res.json(stats);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async getSummary(req, res) {
    try {
      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          SELECT 
            COUNT(*) as total_estudos,
            SUM(tempo_minutos) as total_minutos,
            SUM(quantidade_questoes) as total_questoes,
            COUNT(DISTINCT data_estudo) as dias_estudados,
            COUNT(DISTINCT materia) as materias_estudadas
          FROM estudos 
          WHERE user_id = $1
        `, [req.user.id]);

        const summary = result.rows[0];
        const totalHoras = Math.floor(summary.total_minutos / 60);
        const minutosRestantes = summary.total_minutos % 60;

        res.json({
          totalEstudos: parseInt(summary.total_estudos),
          totalTempo: `${totalHoras}h ${minutosRestantes}min`,
          totalMinutos: parseInt(summary.total_minutos || 0),
          totalQuestoes: parseInt(summary.total_questoes || 0),
          diasEstudados: parseInt(summary.dias_estudados),
          materiasEstudadas: parseInt(summary.materias_estudadas)
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao obter resumo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          SELECT * FROM estudos 
          WHERE id = $1 AND user_id = $2
        `, [id, req.user.id]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Estudo não encontrado' });
        }

        res.json(result.rows[0]);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao buscar estudo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const {
        materia,
        atividade,
        tempo,
        quantidade_questoes,
        descricao,
        data_estudo
      } = req.body;

      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          UPDATE estudos SET
            materia = COALESCE($1, materia),
            atividade = COALESCE($2, atividade),
            tempo_minutos = COALESCE($3, tempo_minutos),
            quantidade_questoes = COALESCE($4, quantidade_questoes),
            descricao = COALESCE($5, descricao),
            data_estudo = COALESCE($6, data_estudo),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7 AND user_id = $8
          RETURNING *
        `, [
          materia,
          atividade,
          tempo ? parseInt(tempo) : null,
          quantidade_questoes ? parseInt(quantidade_questoes) : null,
          descricao,
          data_estudo,
          id,
          req.user.id
        ]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Estudo não encontrado' });
        }

        res.json({
          message: 'Estudo atualizado com sucesso!',
          estudo: result.rows[0]
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao atualizar estudo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          DELETE FROM estudos 
          WHERE id = $1 AND user_id = $2
          RETURNING *
        `, [id, req.user.id]);

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Estudo não encontrado' });
        }

        res.json({ message: 'Estudo deletado com sucesso!' });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao deletar estudo:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async getByDate(req, res) {
    try {
      const { date } = req.params;
      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          SELECT * FROM estudos 
          WHERE user_id = $1 AND data_estudo = $2
          ORDER BY created_at DESC
        `, [req.user.id, date]);

        res.json(result.rows);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao buscar estudos por data:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  },

  async getByMateria(req, res) {
    try {
      const { materia } = req.params;
      const client = await pool.connect();
      
      try {
        const result = await client.query(`
          SELECT * FROM estudos 
          WHERE user_id = $1 AND materia = $2
          ORDER BY data_estudo DESC, created_at DESC
        `, [req.user.id, materia]);

        res.json(result.rows);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Erro ao buscar estudos por matéria:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
};

module.exports = estudoController;
