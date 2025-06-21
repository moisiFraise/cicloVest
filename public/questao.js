class QuestaoManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filters = {};
        this.editingId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.setDefaultDate();
        this.loadStatistics();
        this.loadQuestoes();
    }

    bindEvents() {
        // Form events
        document.getElementById('questao-form').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('btn-cancelar').addEventListener('click', () => this.resetForm());
        document.getElementById('toggle-form').addEventListener('click', () => this.toggleForm());

        // Checkbox para tempo
        document.getElementById('incluir_tempo').addEventListener('change', (e) => this.toggleTempoField(e));

        // Cálculo de tempo médio
        document.getElementById('total_questoes').addEventListener('input', () => this.calculateTempoMedio());
        document.getElementById('tempo_total_minutos').addEventListener('input', () => this.calculateTempoMedio());

        // Validação em tempo real
        document.getElementById('questoes_acertadas').addEventListener('input', () => this.validateAcertos());
        document.getElementById('total_questoes').addEventListener('input', () => this.validateAcertos());

        // Filter events
        document.getElementById('btn-aplicar-filtros').addEventListener('click', () => this.applyFilters());
        document.getElementById('btn-limpar-filtros').addEventListener('click', () => this.clearFilters());
        document.getElementById('btn-refresh').addEventListener('click', () => this.refreshData());

        // Modal events
        document.getElementById('btn-cancel-modal').addEventListener('click', () => this.hideModal());
        document.getElementById('btn-confirm-modal').addEventListener('click', () => this.confirmAction());
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('data_realizacao').value = today;
    }

    toggleForm() {
        const form = document.querySelector('.questao-form');
        const toggleBtn = document.getElementById('toggle-form');
        
        form.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
    }

    toggleTempoField(e) {
        const tempoGroup = document.getElementById('tempo-group');
        const tempoInput = document.getElementById('tempo_total_minutos');
        
        if (e.target.checked) {
            tempoGroup.style.display = 'block';
            tempoInput.required = true;
        } else {
            tempoGroup.style.display = 'none';
            tempoInput.required = false;
            tempoInput.value = '';
            document.getElementById('tempo-info').style.display = 'none';
        }
    }

    calculateTempoMedio() {
        const totalQuestoes = parseInt(document.getElementById('total_questoes').value) || 0;
        const tempoTotal = parseInt(document.getElementById('tempo_total_minutos').value) || 0;
        const tempoInfo = document.getElementById('tempo-info');
        const tempoMedioSpan = document.getElementById('tempo-medio-calc');

        if (totalQuestoes > 0 && tempoTotal > 0) {
            const tempoMedio = (tempoTotal / totalQuestoes).toFixed(2);
            tempoMedioSpan.textContent = tempoMedio;
            tempoInfo.style.display = 'block';
        } else {
            tempoInfo.style.display = 'none';
        }
    }

    validateAcertos() {
        const totalQuestoes = parseInt(document.getElementById('total_questoes').value) || 0;
        const questoesAcertadas = parseInt(document.getElementById('questoes_acertadas').value) || 0;
        const acertosGroup = document.getElementById('questoes_acertadas').closest('.form-group');

        // Remove classes anteriores
        acertosGroup.classList.remove('error', 'success');

        // Remove mensagens anteriores
        const existingMessage = acertosGroup.querySelector('.error-message, .success-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        if (totalQuestoes > 0 && questoesAcertadas > totalQuestoes) {
            acertosGroup.classList.add('error');
            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-message';
            errorMsg.innerHTML = '<i class="fas fa-exclamation-circle"></i> Não pode ser maior que o total de questões';
            acertosGroup.appendChild(errorMsg);
        } else if (questoesAcertadas >= 0 && totalQuestoes > 0) {
            acertosGroup.classList.add('success');
            const porcentagem = ((questoesAcertadas / totalQuestoes) * 100).toFixed(1);
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message';
            successMsg.innerHTML = `<i class="fas fa-check-circle"></i> ${porcentagem}% de acertos`;
            acertosGroup.appendChild(successMsg);
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            return;
        }

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Converter valores numéricos
        data.total_questoes = parseInt(data.total_questoes);
        data.questoes_acertadas = parseInt(data.questoes_acertadas);
        
        if (data.tempo_total_minutos) {
            data.tempo_total_minutos = parseInt(data.tempo_total_minutos);
        } else {
            delete data.tempo_total_minutos;
        }

        // Remover campo incluir_tempo
        delete data.incluir_tempo;

        try {
            this.showLoading(true);
            
            const url = this.editingId ? `/api/questoes/${this.editingId}` : '/api/questoes';
            const method = this.editingId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                this.showSuccess(this.editingId ? 'Questão atualizada com sucesso!' : 'Questão registrada com sucesso!');
                this.resetForm();
                this.loadStatistics();
                this.loadQuestoes();
            } else {
                const error = await response.json();
                this.showError(error.error || 'Erro ao salvar questão');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showError('Erro de conexão');
        } finally {
            this.showLoading(false);
        }
    }

    validateForm() {
        const totalQuestoes = parseInt(document.getElementById('total_questoes').value) || 0;
        const questoesAcertadas = parseInt(document.getElementById('questoes_acertadas').value) || 0;
        const incluirTempo = document.getElementById('incluir_tempo').checked;
        const tempoTotal = parseInt(document.getElementById('tempo_total_minutos').value) || 0;

        if (questoesAcertadas > totalQuestoes) {
            this.showError('Questões acertadas não pode ser maior que o total de questões');
            return false;
        }

        if (incluirTempo && tempoTotal <= 0) {
            this.showError('Tempo total deve ser maior que zero');
            return false;
        }

        return true;
    }

    resetForm() {
        document.getElementById('questao-form').reset();
        this.setDefaultDate();
        this.editingId = null;
        
        // Reset tempo field
        document.getElementById('tempo-group').style.display = 'none';
        document.getElementById('tempo-info').style.display = 'none';
        document.getElementById('tempo_total_minutos').required = false;
        
        // Reset validation classes
        document.querySelectorAll('.form-group').forEach(group => {
            group.classList.remove('error', 'success');
            const message = group.querySelector('.error-message, .success-message');
            if (message) message.remove();
        });

        // Update button text
        document.getElementById('btn-salvar').innerHTML = '<i class="fas fa-save"></i> Salvar Sessão';
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/questoes/estatisticas', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.updateStatistics(stats);
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    }

    updateStatistics(stats) {
        const { estatisticas_gerais } = stats;
        
        document.getElementById('total-questoes').textContent = estatisticas_gerais.total_questoes || 0;
        document.getElementById('total-acertos').textContent = estatisticas_gerais.total_acertos || 0;
        document.getElementById('media-acertos').textContent = `${estatisticas_gerais.media_acertos || 0}%`;
        
        const tempoMedio = estatisticas_gerais.tempo_medio_geral;
        document.getElementById('tempo-medio').textContent = tempoMedio ? `${tempoMedio}min` : 'N/A';
    }

    async loadQuestoes() {
        try {
            this.showLoading(true);
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                ...this.filters
            });

            const response = await fetch(`/api/questoes?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderQuestoes(data.questoes);
                this.renderPagination(data.pagination);
            } else {
                throw new Error('Erro ao carregar questões');
            }
        } catch (error) {
            console.error('Erro ao carregar questões:', error);
            this.showError('Erro ao carregar questões');
        } finally {
            this.showLoading(false);
        }
    }

    renderQuestoes(questoes) {
        const container = document.getElementById('questao-list');
        
        if (questoes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-question-circle"></i>
                    <h3>Nenhuma questão encontrada</h3>
                    <p>Registre sua primeira sessão de questões para começar!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = questoes.map(questao => `
            <div class="questao-item" data-materia="${questao.materia}">
                <div class="questao-item-header">
                    <span class="questao-materia">${questao.materia}</span>
                    <span class="questao-data">${this.formatDate(questao.data_realizacao)}</span>
                </div>
                
                <div class="questao-stats">
                    <div class="questao-stat">
                        <div class="questao-stat-value">${questao.total_questoes}</div>
                        <div class="questao-stat-label">Total</div>
                    </div>
                    <div class="questao-stat">
                        <div class="questao-stat-value questao-acertos">${questao.questoes_acertadas}</div>
                        <div class="questao-stat-label">Acertos</div>
                    </div>
                    <div class="questao-stat">
                        <div class="questao-stat-value questao-erros">${questao.questoes_erradas}</div>
                        <div class="questao-stat-label">Erros</div>
                    </div>
                    <div class="questao-stat">
                        <div class="questao-stat-value questao-porcentagem">${questao.porcentagem_acertos}%</div>
                        <div class="questao-stat-label">Acertos</div>
                    </div>
                    ${questao.tempo_medio_por_questao ? `
                        <div class="questao-stat">
                            <div class="questao-stat-value questao-tempo">${questao.tempo_medio_por_questao}min</div>
                            <div class="questao-stat-label">Tempo/Questão</div>
                        </div>
                    ` : ''}
                </div>
                
                ${questao.observacoes ? `
                    <div class="questao-observacoes">
                        <i class="fas fa-comment"></i> ${questao.observacoes}
                    </div>
                ` : ''}
                
                <div class="questao-actions">
                    <button class="btn-edit" onclick="questaoManager.editQuestao(${questao.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="questaoManager.deleteQuestao(${questao.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        
        if (pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = `
            <button ${pagination.page <= 1 ? 'disabled' : ''} onclick="questaoManager.goToPage(${pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Páginas
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.pages, pagination.page + 2);

        if (startPage > 1) {
            paginationHTML += `<button onclick="questaoManager.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span>...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="${i === pagination.page ? 'active' : ''}" onclick="questaoManager.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < pagination.pages) {
            if (endPage < pagination.pages - 1) {
                paginationHTML += `<span>...</span>`;
            }
            paginationHTML += `<button onclick="questaoManager.goToPage(${pagination.pages})">${pagination.pages}</button>`;
        }

        paginationHTML += `
            <button ${pagination.page >= pagination.pages ? 'disabled' : ''} onclick="questaoManager.goToPage(${pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        paginationHTML += `
            <div class="pagination-info">
                Página ${pagination.page} de ${pagination.pages} (${pagination.total} registros)
            </div>
        `;

        container.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadQuestoes();
    }

    applyFilters() {
        this.filters = {};
        
        const materia = document.getElementById('filter-materia').value;
        const dataInicio = document.getElementById('filter-data-inicio').value;
        const dataFim = document.getElementById('filter-data-fim').value;

        if (materia) this.filters.materia = materia;
        if (dataInicio) this.filters.data_inicio = dataInicio;
        if (dataFim) this.filters.data_fim = dataFim;

        this.currentPage = 1;
        this.loadQuestoes();
    }

    clearFilters() {
        this.filters = {};
        this.currentPage = 1;
        
        document.getElementById('filter-materia').value = '';
        document.getElementById('filter-data-inicio').value = '';
        document.getElementById('filter-data-fim').value = '';
        
        this.loadQuestoes();
    }

    refreshData() {
        this.loadStatistics();
        this.loadQuestoes();
    }

    async editQuestao(id) {
        try {
            const response = await fetch(`/api/questoes/${id}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const questao = await response.json();
                this.fillFormForEdit(questao);
            } else {
                this.showError('Erro ao carregar dados da questão');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showError('Erro de conexão');
        }
    }

    fillFormForEdit(questao) {
        this.editingId = questao.id;
        
        // Expandir formulário se estiver colapsado
        const form = document.querySelector('.questao-form');
        const toggleBtn = document.getElementById('toggle-form');
        
        if (form.classList.contains('collapsed')) {
            form.classList.remove('collapsed');
            toggleBtn.classList.remove('collapsed');
        }

        // Preencher campos
        document.getElementById('materia').value = questao.materia;
        document.getElementById('total_questoes').value = questao.total_questoes;
        document.getElementById('questoes_acertadas').value = questao.questoes_acertadas;
        document.getElementById('data_realizacao').value = questao.data_realizacao;
        document.getElementById('observacoes').value = questao.observacoes || '';

        // Tempo
        if (questao.tempo_total_minutos) {
            document.getElementById('incluir_tempo').checked = true;
            document.getElementById('tempo-group').style.display = 'block';
            document.getElementById('tempo_total_minutos').value = questao.tempo_total_minutos;
            document.getElementById('tempo_total_minutos').required = true;
            this.calculateTempoMedio();
        }

        // Validar acertos
        this.validateAcertos();

        // Atualizar botão
        document.getElementById('btn-salvar').innerHTML = '<i class="fas fa-save"></i> Atualizar Sessão';

        // Scroll para o formulário
        document.querySelector('.questao-form-section').scrollIntoView({ behavior: 'smooth' });
    }

    deleteQuestao(id) {
        this.showModal(
            'Tem certeza que deseja excluir esta sessão de questões?',
            () => this.confirmDelete(id)
        );
    }

    async confirmDelete(id) {
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/questoes/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                this.showSuccess('Questão excluída com sucesso!');
                this.loadStatistics();
                this.loadQuestoes();
            } else {
                const error = await response.json();
                this.showError(error.error || 'Erro ao excluir questão');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showError('Erro de conexão');
        } finally {
            this.showLoading(false);
            this.hideModal();
        }
    }

    showModal(message, confirmCallback) {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-modal').style.display = 'flex';
        this.confirmCallback = confirmCallback;
    }

    hideModal() {
        document.getElementById('confirm-modal').style.display = 'none';
        this.confirmCallback = null;
    }

    confirmAction() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Remove notificações existentes
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove após 5 segundos
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }
}

// Estilos para notificações
const notificationStyles = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1001;
        max-width: 400px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    }

    .notification-success {
        background: linear-gradient(135deg, #28a745, #20c997);
        color: white;
    }

    .notification-error {
        background: linear-gradient(135deg, #dc3545, #e74c3c);
        color: white;
    }

    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 15px 20px;
    }

    .notification-close {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        margin-left: auto;
        padding: 5px;
        border-radius: 50%;
        transition: background 0.3s ease;
    }

    .notification-close:hover {
        background: rgba(255,255,255,0.2);
    }

    @keyframes slideIn {
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

// Adicionar estilos ao documento
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);

// Inicializar quando o DOM estiver carregado
let questaoManager;
document.addEventListener('DOMContentLoaded', () => {
    questaoManager = new QuestaoManager();
});

