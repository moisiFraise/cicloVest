class SimuladoManager {
    constructor() {
        this.simulados = [];
        this.simuladoEditando = null;
        this.simuladoParaExcluir = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.carregarSimulados();
        this.carregarEstatisticas();
    }

    bindEvents() {
        document.getElementById('btnNovoSimulado').addEventListener('click', () => {
            this.abrirModalSimulado();
        });

        document.getElementById('formSimulado').addEventListener('submit', (e) => {
            e.preventDefault();
            this.salvarSimulado();
        });

        document.getElementById('filtroTipo').addEventListener('change', () => {
            this.aplicarFiltros();
        });

        document.getElementById('filtroDia').addEventListener('change', () => {
            this.aplicarFiltros();
        });

        document.getElementById('filtroNivel').addEventListener('change', () => {
            this.aplicarFiltros();
        });

        document.getElementById('filtroNome').addEventListener('input', () => {
            this.aplicarFiltros();
        });

        document.getElementById('total_questoes').addEventListener('input', () => {
            this.calcularPorcentagem();
        });

        document.getElementById('questoes_acertadas').addEventListener('input', () => {
            this.calcularPorcentagem();
        });

        document.getElementById('btnConfirmarExclusao').addEventListener('click', () => {
            this.confirmarExclusao();
        });

        document.getElementById('modalSimulado').addEventListener('click', (e) => {
            if (e.target.id === 'modalSimulado') {
                this.fecharModalSimulado();
            }
        });

        document.getElementById('modalConfirmacao').addEventListener('click', (e) => {
            if (e.target.id === 'modalConfirmacao') {
                this.fecharModalConfirmacao();
            }
        });
    }

    async carregarSimulados() {
        try {
            this.mostrarLoading(true);
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Token não encontrado');
            }

            const response = await fetch('/api/simulados', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                    window.location.href = '/';
                    return;
                }
                
                const errorText = await response.text();
                console.error('Erro na resposta:', errorText);
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Dados recebidos:', data);
            
            if (data.success) {
                this.simulados = data.simulados || [];
            } else {
                this.simulados = data || [];
            }
            
            this.renderizarSimulados();
        } catch (error) {
            console.error('Erro ao carregar simulados:', error);
            this.mostrarMensagem('Erro ao carregar simulados: ' + error.message, 'error');
            this.simulados = [];
            this.renderizarSimulados();
        } finally {
            this.mostrarLoading(false);
        }
    }

    async carregarEstatisticas() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) {
                throw new Error('Token não encontrado');
            }

            const response = await fetch('/api/simulados/estatisticas', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                    window.location.href = '/';
                    return;
                }
                
                console.warn('Erro ao carregar estatísticas, usando valores padrão');
                this.atualizarEstatisticas({
                    geral: {
                        total_simulados: 0,
                        media_acertos: 0,
                        melhor_resultado: 0,
                        tempo_medio: 0
                    }
                });
                return;
            }

            const data = await response.json();
            console.log('Estatísticas recebidas:', data);
            
            if (data.success && data.estatisticas) {
                this.atualizarEstatisticas(data.estatisticas);
            } else {
                this.atualizarEstatisticas({
                    geral: {
                        total_simulados: 0,
                        media_acertos: 0,
                        melhor_resultado: 0,
                        tempo_medio: 0
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
            this.atualizarEstatisticas({
                geral: {
                    total_simulados: 0,
                    media_acertos: 0,
                    melhor_resultado: 0,
                    tempo_medio: 0
                }
            });
        }
    }

    atualizarEstatisticas(stats) {
        const geral = stats.geral || stats;
        
        document.getElementById('totalSimulados').textContent = geral.total_simulados || 0;
        document.getElementById('mediaAcertos').textContent = `${Math.round(geral.media_acertos || 0)}%`;
        document.getElementById('melhorResultado').textContent = `${Math.round(geral.melhor_resultado || 0)}%`;
        document.getElementById('tempoMedio').textContent = `${Math.round(geral.tempo_medio || 0)}min`;
    }

    renderizarSimulados(simuladosFiltrados = null) {
        const grid = document.getElementById('simuladosGrid');
        const simulados = simuladosFiltrados || this.simulados;

        if (!simulados || simulados.length === 0) {
            grid.innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        document.getElementById('emptyState').style.display = 'none';

        grid.innerHTML = simulados.map(simulado => `
            <div class="simulado-card">
                <div class="simulado-header">
                    <div class="simulado-title">${this.escapeHtml(simulado.nome)}</div>
                    <div class="simulado-subtitle">${this.escapeHtml(simulado.tipo_simulado)} - ${this.escapeHtml(simulado.dia_prova)}</div>
                </div>
                <div class="simulado-body">
                    <div class="porcentagem-destaque">
                        <div class="porcentagem-numero">${Math.round(simulado.porcentagem_acertos || 0)}%</div>
                        <div class="porcentagem-label">Acertos</div>
                    </div>
                    
                    <div class="simulado-info">
                        <div class="info-item">
                            <span class="info-label">Questões</span>
                            <span class="info-value">${simulado.questoes_acertadas}/${simulado.total_questoes}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Tempo</span>
                            <span class="info-value">${this.formatarTempo(simulado.tempo_realizacao)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Data</span>
                            <span class="info-value">${this.formatarData(simulado.data_realizacao)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Nível</span>
                            <span class="info-value">
                                <span class="nivel-badge nivel-${simulado.nivel_dificuldade}">
                                    ${this.formatarNivel(simulado.nivel_dificuldade)}
                                </span>
                            </span>
                        </div>
                    </div>

                    ${simulado.descricao ? `
                        <div class="simulado-description">
                            ${this.escapeHtml(simulado.descricao)}
                        </div>
                    ` : ''}

                    <div class="simulado-actions">
                        <button class="btn btn-secondary btn-small" onclick="simuladoManager.editarSimulado(${simulado.id})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-danger btn-small" onclick="simuladoManager.excluirSimulado(${simulado.id})">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    aplicarFiltros() {
        const filtroTipo = document.getElementById('filtroTipo').value;
        const filtroDia = document.getElementById('filtroDia').value;
        const filtroNivel = document.getElementById('filtroNivel').value;
        const filtroNome = document.getElementById('filtroNome').value.toLowerCase();

        const simuladosFiltrados = this.simulados.filter(simulado => {
            const matchTipo = !filtroTipo || simulado.tipo_simulado === filtroTipo;
            const matchDia = !filtroDia || simulado.dia_prova === filtroDia;
            const matchNivel = !filtroNivel || simulado.nivel_dificuldade === filtroNivel;
            const matchNome = !filtroNome || simulado.nome.toLowerCase().includes(filtroNome);

            return matchTipo && matchDia && matchNivel && matchNome;
        });

        this.renderizarSimulados(simuladosFiltrados);
    }

    abrirModalSimulado(simulado = null) {
        this.simuladoEditando = simulado;
        const modal = document.getElementById('modalSimulado');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('formSimulado');

        if (simulado) {
            title.textContent = 'Editar Simulado';
            this.preencherFormulario(simulado);
        } else {
            title.textContent = 'Novo Simulado';
            form.reset();
            document.getElementById('porcentagemPreview').textContent = '0%';
        }

        modal.classList.add('active');
    }

    fecharModalSimulado() {
        const modal = document.getElementById('modalSimulado');
        modal.classList.remove('active');
        this.simuladoEditando = null;
    }

    preencherFormulario(simulado) {
        document.getElementById('nome').value = simulado.nome || '';
        document.getElementById('tipo_simulado').value = simulado.tipo_simulado || '';
        document.getElementById('dia_prova').value = simulado.dia_prova || '';
        document.getElementById('total_questoes').value = simulado.total_questoes || '';
        document.getElementById('questoes_acertadas').value = simulado.questoes_acertadas || '';
        
               if (simulado.data_realizacao) {
            const data = new Date(simulado.data_realizacao);
            const dataFormatada = data.toISOString().split('T')[0];
            document.getElementById('data_realizacao').value = dataFormatada;
        }
        
        document.getElementById('tempo_realizacao').value = simulado.tempo_realizacao || '';
        document.getElementById('nivel_dificuldade').value = simulado.nivel_dificuldade || '';
        document.getElementById('descricao').value = simulado.descricao || '';
        
        this.calcularPorcentagem();
    }

    calcularPorcentagem() {
        const total = parseInt(document.getElementById('total_questoes').value) || 0;
        const acertadas = parseInt(document.getElementById('questoes_acertadas').value) || 0;
        
        if (total > 0) {
            const porcentagem = Math.round((acertadas / total) * 100);
            document.getElementById('porcentagemPreview').textContent = `${porcentagem}%`;
        } else {
            document.getElementById('porcentagemPreview').textContent = '0%';
        }
    }

    async salvarSimulado() {
        try {
            const formData = new FormData(document.getElementById('formSimulado'));
            const data = Object.fromEntries(formData.entries());

            console.log('Dados do formulário:', data);

            if (!data.nome || !data.tipo_simulado || !data.dia_prova || 
                !data.total_questoes || !data.questoes_acertadas || 
                !data.data_realizacao || !data.tempo_realizacao || 
                !data.nivel_dificuldade) {
                this.mostrarMensagem('Todos os campos obrigatórios devem ser preenchidos', 'error');
                return;
            }

            const totalQuestoes = parseInt(data.total_questoes);
            const questoesAcertadas = parseInt(data.questoes_acertadas);
            const tempoRealizacao = parseInt(data.tempo_realizacao);

            if (isNaN(totalQuestoes) || totalQuestoes <= 0) {
                this.mostrarMensagem('Total de questões deve ser um número maior que zero', 'error');
                return;
            }

            if (isNaN(questoesAcertadas) || questoesAcertadas < 0) {
                this.mostrarMensagem('Questões acertadas deve ser um número maior ou igual a zero', 'error');
                return;
            }

            if (questoesAcertadas > totalQuestoes) {
                this.mostrarMensagem('Número de questões acertadas não pode ser maior que o total', 'error');
                return;
            }

            if (isNaN(tempoRealizacao) || tempoRealizacao <= 0) {
                this.mostrarMensagem('Tempo de realização deve ser um número maior que zero', 'error');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                this.mostrarMensagem('Token não encontrado. Faça login novamente.', 'error');
                window.location.href = '/';
                return;
            }

            const url = this.simuladoEditando 
                ? `/api/simulados/${this.simuladoEditando.id}`
                : '/api/simulados';
            
            const method = this.simuladoEditando ? 'PUT' : 'POST';

            console.log('Fazendo requisição:', method, url);
            console.log('Dados enviados:', data);

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                    window.location.href = '/';
                    return;
                }

                const errorText = await response.text();
                console.error('Erro na resposta:', errorText);
                
                let errorMessage = 'Erro ao salvar simulado';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Resultado:', result);
            
            const message = result.message || 'Simulado salvo com sucesso!';
            this.mostrarMensagem(message, 'success');
            this.fecharModalSimulado();
            await this.carregarSimulados();
            await this.carregarEstatisticas();

        } catch (error) {
            console.error('Erro ao salvar simulado:', error);
            this.mostrarMensagem(error.message || 'Erro ao salvar simulado', 'error');
        }
    }

    editarSimulado(id) {
        const simulado = this.simulados.find(s => s.id === id);
        if (simulado) {
            this.abrirModalSimulado(simulado);
        } else {
            this.mostrarMensagem('Simulado não encontrado', 'error');
        }
    }

    excluirSimulado(id) {
        this.simuladoParaExcluir = id;
        document.getElementById('modalConfirmacao').classList.add('active');
    }

    fecharModalConfirmacao() {
        document.getElementById('modalConfirmacao').classList.remove('active');
        this.simuladoParaExcluir = null;
    }

    async confirmarExclusao() {
        if (!this.simuladoParaExcluir) return;

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                this.mostrarMensagem('Token não encontrado. Faça login novamente.', 'error');
                window.location.href = '/';
                return;
            }

            const response = await fetch(`/api/simulados/${this.simuladoParaExcluir}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Delete response status:', response.status);

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem('token');
                    window.location.href = '/';
                    return;
                }

                const errorText = await response.text();
                console.error('Erro ao excluir:', errorText);
                
                let errorMessage = 'Erro ao excluir simulado';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = errorText || errorMessage;
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Resultado da exclusão:', result);
            
            const message = result.message || 'Simulado excluído com sucesso!';
            this.mostrarMensagem(message, 'success');
            this.fecharModalConfirmacao();
            await this.carregarSimulados();
            await this.carregarEstatisticas();

        } catch (error) {
            console.error('Erro ao excluir simulado:', error);
            this.mostrarMensagem(error.message || 'Erro ao excluir simulado', 'error');
        }
    }

    mostrarLoading(show) {
        const loading = document.getElementById('loading');
        const grid = document.getElementById('simuladosGrid');
        
        if (show) {
            loading.style.display = 'block';
            grid.style.display = 'none';
        } else {
            loading.style.display = 'none';
            grid.style.display = 'grid';
        }
    }

    mostrarMensagem(mensagem, tipo = 'info') {
        const mensagensExistentes = document.querySelectorAll('.toast-message');
        mensagensExistentes.forEach(msg => msg.remove());

        const toast = document.createElement('div');
        toast.className = `toast-message toast-${tipo}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getIconePorTipo(tipo)}"></i>
                <span>${mensagem}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        if (!document.getElementById('toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast-message {
                    position: fixed;
                    top: 90px;
                    right: 20px;
                    z-index: 10000;
                    min-width: 300px;
                    max-width: 500px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                    animation: slideInRight 0.3s ease;
                }
                
                .toast-success {
                    background: var(--ctp-green);
                    color: var(--ctp-base);
                }
                
                .toast-error {
                    background: var(--ctp-red);
                    color: var(--ctp-base);
                }
                
                .toast-info {
                    background: var(--ctp-blue);
                    color: var(--ctp-base);
                }
                
                .toast-warning {
                    background: var(--ctp-yellow);
                    color: var(--ctp-base);
                }
                
                .toast-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                }
                
                .toast-close {
                    background: none;
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    margin-left: auto;
                    padding: 4px;
                    border-radius: 4px;
                    opacity: 0.8;
                }
                
                .toast-close:hover {
                    opacity: 1;
                    background: rgba(0, 0, 0, 0.1);
                }
                
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(toast);

        // Auto remover após 5 segundos
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    getIconePorTipo(tipo) {
        const icones = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icones[tipo] || 'info-circle';
    }

    formatarData(data) {
        if (!data) return '-';
        try {
            return new Date(data).toLocaleDateString('pt-BR');
        } catch (error) {
            return data;
        }
    }

    formatarTempo(minutos) {
        if (!minutos) return '-';
        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;
        
        if (horas > 0) {
            return `${horas}h ${mins}min`;
        }
        return `${mins}min`;
    }

    formatarNivel(nivel) {
        const niveis = {
            facil: 'Fácil',
            medio: 'Médio',
            dificil: 'Difícil'
        };
        return niveis[nivel] || nivel;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.abrirModalSimulado = function() {
    if (window.simuladoManager) {
        window.simuladoManager.abrirModalSimulado();
    }
};

window.fecharModalSimulado = function() {
    if (window.simuladoManager) {
        window.simuladoManager.fecharModalSimulado();
    }
};

window.fecharModalConfirmacao = function() {
    if (window.simuladoManager) {
        window.simuladoManager.fecharModalConfirmacao();
    }
};

function verificarAutenticacao() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('Token não encontrado, redirecionando para login');
        window.location.href = '/';
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, verificando autenticação...');
    
    if (verificarAutenticacao()) {
        console.log('Usuário autenticado, inicializando SimuladoManager...');
        window.simuladoManager = new SimuladoManager();
    }
});

setInterval(() => {
    const token = localStorage.getItem('token');
    if (!token && window.location.pathname === '/simulado.html') {
        console.log('Token perdido, redirecionando para login');
        window.location.href = '/';
    }
}, 30000); // Verificar a cada 30 segundos

window.SimuladoManager = SimuladoManager;
