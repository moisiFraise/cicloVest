-- Criar tabela de usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para busca por email
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- Criar tabela de estatísticas do usuário
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
);

-- Criar tabela de atividades
CREATE TABLE IF NOT EXISTS user_activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    pontuacao INTEGER,
    materia VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de estudos
CREATE TABLE IF NOT EXISTS estudos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    materia VARCHAR(100) NOT NULL CHECK (materia IN (
        'Linguagens', 'História', 'Geografia', 'Filosofia', 'Sociologia', 
        'Redação', 'Matemática', 'Física', 'Química', 'Biologia', 
        'Inglês', 'Espanhol', 'Gramática', 'Outra'
    )),
    atividade VARCHAR(100) CHECK (atividade IN (
        'Escrever redação', 'Assistir videoaulas', 'Responder questões', 
        'Anki', 'Leitura', 'Resumos', 'Exercícios', 'Revisão', 'Outra'
    )),
    tempo_minutos INTEGER NOT NULL CHECK (tempo_minutos > 0),
    quantidade_questoes INTEGER DEFAULT NULL,
    descricao TEXT,
    data_estudo DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para estudos
CREATE INDEX IF NOT EXISTS idx_estudos_user_id ON estudos(user_id);
CREATE INDEX IF NOT EXISTS idx_estudos_data ON estudos(data_estudo);
CREATE INDEX IF NOT EXISTS idx_estudos_materia ON estudos(materia);
CREATE INDEX IF NOT EXISTS idx_estudos_atividade ON estudos(atividade);

-- Criar tabela de simulados
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
    tempo_realizacao INTEGER NOT NULL, -- em minutos
    nivel_dificuldade VARCHAR(20) NOT NULL CHECK (nivel_dificuldade IN ('facil', 'medio', 'dificil')),
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para simulados
CREATE INDEX IF NOT EXISTS idx_simulados_user_id ON simulados(user_id);
CREATE INDEX IF NOT EXISTS idx_simulados_data ON simulados(data_realizacao);
CREATE INDEX IF NOT EXISTS idx_simulados_tipo ON simulados(tipo_simulado);
CREATE INDEX IF NOT EXISTS idx_simulados_porcentagem ON simulados(porcentagem_acertos);

-- Criar tabela de redações
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
);

-- Índices para otimização
CREATE INDEX IF NOT EXISTS idx_redacoes_user_id ON redacoes(user_id);
CREATE INDEX IF NOT EXISTS idx_redacoes_created_at ON redacoes(created_at);
CREATE INDEX IF NOT EXISTS idx_redacoes_nota_final ON redacoes(nota_final);
CREATE INDEX IF NOT EXISTS idx_redacoes_nivel ON redacoes(nivel_dificuldade);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$ language 'plpgsql';

CREATE TRIGGER update_estudos_updated_at BEFORE UPDATE ON estudos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_simulados_updated_at BEFORE UPDATE ON simulados
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_redacoes_updated_at BEFORE UPDATE ON redacoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS questoes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    materia VARCHAR(100) NOT NULL CHECK (materia IN (
        'Linguagens', 'História', 'Geografia', 'Filosofia', 'Sociologia', 
        'Redação', 'Matemática', 'Física', 'Química', 'Biologia', 
        'Inglês', 'Espanhol', 'Gramática', 'Outra'
    )),
    total_questoes INTEGER NOT NULL CHECK (total_questoes > 0),
    questoes_acertadas INTEGER NOT NULL CHECK (questoes_acertadas >= 0),
    questoes_erradas INTEGER GENERATED ALWAYS AS (total_questoes - questoes_acertadas) STORED,
    porcentagem_acertos DECIMAL(5,2) GENERATED ALWAYS AS (ROUND((questoes_acertadas::DECIMAL / total_questoes::DECIMAL) * 100, 2)) STORED,
    tempo_total_minutos INTEGER DEFAULT NULL,
    tempo_medio_por_questao DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN tempo_total_minutos IS NOT NULL AND total_questoes > 0 
            THEN ROUND(tempo_total_minutos::DECIMAL / total_questoes::DECIMAL, 2)
            ELSE NULL 
        END
    ) STORED,
    data_realizacao DATE NOT NULL DEFAULT CURRENT_DATE,
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT questoes_acertadas_valida CHECK (questoes_acertadas <= total_questoes)
);

-- Índices para questões
CREATE INDEX IF NOT EXISTS idx_questoes_user_id ON questoes(user_id);
CREATE INDEX IF NOT EXISTS idx_questoes_data ON questoes(data_realizacao);
CREATE INDEX IF NOT EXISTS idx_questoes_materia ON questoes(materia);
CREATE INDEX IF NOT EXISTS idx_questoes_porcentagem ON questoes(porcentagem_acertos);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_questoes_updated_at BEFORE UPDATE ON questoes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();