class QuestaoManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filters = {};
        this.editingId = null;
        this.currentView = 'grid';
        this.currentOrder = 'created_at-DESC';
        this.charts = {
            bestSubject: null,
            worstSubject: null,
            generalSubjects: null
        };
        this.chartColors = [
            '#cba6f7', '#f38ba8', '#89b4fa', '#a6e3a1', '#f9e2af',
            '#fab387', '#eba0ac', '#89dceb', '#b4befe', '#f5c2e7'
        ];
        this.init();
    }

    init() {
        this.bindEvents();
        this.setDefaultDate();
        this.loadStatistics();
        this.loadCharts();
        this.loadQuestoes();
    }

    bindEvents() {
        // Header buttons
        document.getElementById('nova-questao-btn').addEventListener('click', () => this.showForm());
        document.getElementById('estatisticas-btn').addEventListener('click', () => this.showStatistics());

        // Form events
        document.getElementById('questao-form').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('cancel-btn').addEventListener('click', () => this.hideForm());
        document.getElementById('close-form-btn').addEventListener('click', () => this.hideForm());

        // Checkbox para tempo
        document.getElementById('incluir_tempo').addEventListener('change', (e) => this.toggleTempoField(e));

        // Cálculo de tempo médio
        document.getElementById('total_questoes').addEventListener('input', () => this.calculateTempoMedio());
        document.getElementById('tempo_total_minutos').addEventListener('input', () => this.calculateTempoMedio());

        // Validação em tempo real
        document.getElementById('questoes_acertadas').addEventListener('input', () => this.validateAcertos());
        document.getElementById('total_questoes').addEventListener('input', () => this.validateAcertos());

        // Chart events
        document.getElementById('chart-filter-materia').addEventListener('change', () => this.loadCharts());
        document.getElementById('btn-refresh-charts').addEventListener('click', () => this.refreshCharts());

        // View toggle
        document.getElementById('grid-view-btn').addEventListener('click', () => this.setView('grid'));
        document.getElementById('list-view-btn').addEventListener('click', () => this.setView('list'));

        // Order filter
        document.getElementById('order-filter').addEventListener('change', (e) => this.setOrder(e.target.value));

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => this.previousPage());
        document.getElementById('next-page').addEventListener('click', () => this.nextPage());

        // Statistics modal
        document.getElementById('close-stats-btn').addEventListener('click', () => this.hideStatistics());

        // Delete modal
        document.getElementById('close-delete-btn').addEventListener('click', () => this.hideDeleteModal());
        document.getElementById('cancel-delete-btn').addEventListener('click', () => this.hideDeleteModal());
        document.getElementById('confirm-delete-btn').addEventListener('click', () => this.confirmDelete());

        // Character counters
        this.setupCharacterCounters();
    }

    setupCharacterCounters() {
        const inputs = [
            { id: 'tema', max: 500 },
            { id: 'observacoes', max: 1000 }
        ];

        inputs.forEach(input => {
            const element = document.getElementById(input.id);
            const counter = element.parentElement.querySelector('.char-counter');
            
            element.addEventListener('input', () => {
                const length = element.value.length;
                counter.textContent = `${length}/${input.max} caracteres`;
                
                if (length > input.max * 0.9) {
                    counter.style.color = 'var(--ctp-red)';
                } else if (length > input.max * 0.7) {
                    counter.style.color = 'var(--ctp-yellow)';
                } else {
                    counter.style.color = 'var(--ctp-subtext1)';
                }
            });
        });
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('data_realizacao').value = today;
    }

    showForm(questao = null) {
        if (questao) {
            this.fillFormForEdit(questao);
        } else {
            this.resetForm();
            document.getElementById('form-title').textContent = 'Nova Sessão de Questões';
            document.getElementById('submit-text').textContent = 'Salvar Sessão';
        }
        document.getElementById('form-section').classList.remove('hidden');
    }

    hideForm() {
        document.getElementById('form-section').classList.add('hidden');
        this.resetForm();
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
                this.showMessage(this.editingId ? 'Sessão atualizada com sucesso!' : 'Sessão registrada com sucesso!', 'success');
                this.hideForm();
                this.loadStatistics();
                this.loadCharts();
                this.loadQuestoes();
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Erro ao salvar sessão', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showMessage('Erro de conexão', 'error');
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
            this.showMessage('Questões acertadas não pode ser maior que o total de questões', 'error');
            return false;
        }

        if (incluirTempo && tempoTotal <= 0) {
            this.showMessage('Tempo total deve ser maior que zero', 'error');
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

        // Reset character counters
        document.querySelectorAll('.char-counter').forEach(counter => {
            counter.textContent = counter.textContent.replace(/^\d+/, '0');
            counter.style.color = 'var(--ctp-subtext1)';
        });
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

    async loadCharts() {
        try {
            const materiaFilter = document.getElementById('chart-filter-materia').value;
            const params = new URLSearchParams();
            
            if (materiaFilter) {
                params.append('materia', materiaFilter);
            }

            const response = await fetch(`/api/questoes/estatisticas?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.updateCharts(stats);
            }
        } catch (error) {
            console.error('Erro ao carregar dados dos gráficos:', error);
            this.showChartError();
        }
    }

    
    updateCharts(stats) {
        console.log('Dados recebidos para gráficos:', stats); // Debug
        
        const { por_materia } = stats;
        
        if (!por_materia || por_materia.length === 0) {
            console.log('Nenhum dado por matéria encontrado'); // Debug
            this.showEmptyCharts();
            return;
        }

        console.log('Dados por matéria:', por_materia); // Debug

        // Ordenar por média de acertos
        const sortedByBest = [...por_materia].sort((a, b) => b.media_acertos - a.media_acertos);
        const sortedByWorst = [...por_materia].sort((a, b) => a.media_acertos - b.media_acertos);

        // Melhor matéria
        if (sortedByBest.length > 0) {
            const bestSubject = sortedByBest[0];
            this.updateBestSubjectChart(bestSubject);
        }

        // Pior matéria
        if (sortedByWorst.length > 0) {
            const worstSubject = sortedByWorst[0];
            this.updateWorstSubjectChart(worstSubject);
        }

        // Gráfico geral
        this.updateGeneralChart(por_materia);
    }

    updateBestSubjectChart(subject) {
        const ctx = document.getElementById('bestSubjectChart').getContext('2d');
        
        document.getElementById('best-subject-name').textContent = subject.materia;
        document.getElementById('best-subject-percentage').textContent = `${subject.media_acertos}%`;

        // Destruir gráfico anterior se existir
        if (this.charts.bestSubject) {
            this.charts.bestSubject.destroy();
        }

        const acertos = subject.acertos;
        const erros = subject.questoes - subject.acertos;

        this.charts.bestSubject = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Acertos', 'Erros'],
                datasets: [{
                    data: [acertos, erros],
                    backgroundColor: ['#a6e3a1', '#f38ba8'],
                    borderColor: ['#40a02b', '#d20f39'],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e1e2e',
                        titleColor: '#cdd6f4',
                        bodyColor: '#bac2de',
                        borderColor: '#45475a',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    updateWorstSubjectChart(subject) {
        const ctx = document.getElementById('worstSubjectChart').getContext('2d');
        
        document.getElementById('worst-subject-name').textContent = subject.materia;
        document.getElementById('worst-subject-percentage').textContent = `${subject.media_acertos}%`;

        if (this.charts.worstSubject) {
            this.charts.worstSubject.destroy();
        }

        const acertos = subject.acertos;
        const erros = subject.questoes - subject.acertos;

        this.charts.worstSubject = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Acertos', 'Erros'],
                datasets: [{
                    data: [acertos, erros],
                    backgroundColor: ['#f9e2af', '#f38ba8'],
                    borderColor: ['#df8e1d', '#d20f39'],
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e1e2e',
                        titleColor: '#cdd6f4',
                        bodyColor: '#bac2de',
                        borderColor: '#45475a',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
        updateGeneralChart(materias) {
        const ctx = document.getElementById('generalSubjectsChart').getContext('2d');
        
        console.log('Dados originais para gráfico geral:', materias); // Debug
        
        // Destruir gráfico anterior se existir
        if (this.charts.generalSubjects) {
            this.charts.generalSubjects.destroy();
        }

        // Filtrar matérias com questões > 0 e garantir que questoes é um número
        const materiasComQuestoes = materias.filter(m => {
            const questoes = parseInt(m.questoes) || 0;
            return questoes > 0;
        }).map(m => ({
            ...m,
            questoes: parseInt(m.questoes) || 0
        }));
        
        console.log('Matérias filtradas:', materiasComQuestoes); // Debug
        
        if (materiasComQuestoes.length === 0) {
            console.log('Nenhuma matéria com questões encontrada'); // Debug
            this.showEmptyCharts();
            return;
        }

        const labels = materiasComQuestoes.map(m => m.materia);
        const data = materiasComQuestoes.map(m => m.questoes);
        const colors = this.chartColors.slice(0, materiasComQuestoes.length);

        console.log('Labels para gráfico:', labels); // Debug
        console.log('Data para gráfico:', data); // Debug
        console.log('Total de questões:', data.reduce((a, b) => a + b, 0)); // Debug

        this.charts.generalSubjects = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: colors.map(color => this.darkenColor(color, 20)),
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e1e2e',
                        titleColor: '#cdd6f4',
                        bodyColor: '#bac2de',
                        borderColor: '#45475a',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                                return `${label}: ${value} questões (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        // Atualizar legenda personalizada - usar os dados filtrados
        this.updateGeneralChartLegend(materiasComQuestoes, colors);
    }

    updateGeneralChartLegend(materias, colors) {
        const legendContainer = document.getElementById('general-chart-legend');
        
        if (!materias || materias.length === 0) {
            legendContainer.innerHTML = '';
            return;
        }
        
        const totalQuestoes = materias.reduce((sum, m) => sum + (parseInt(m.questoes) || 0), 0);
        
        console.log('Total de questões para legenda:', totalQuestoes); // Debug
        console.log('Matérias para legenda:', materias); // Debug
        
        if (totalQuestoes === 0) {
            legendContainer.innerHTML = '<p class="no-data">Nenhum dado disponível</p>';
            return;
        }
        
        legendContainer.innerHTML = materias.map((materia, index) => {
            const questoes = parseInt(materia.questoes) || 0;
            const percentage = totalQuestoes > 0 ? ((questoes / totalQuestoes) * 100).toFixed(1) : '0.0';
            
            console.log(`${materia.materia}: ${questoes} questões de ${totalQuestoes} = ${percentage}%`); // Debug
            
            return `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${colors[index]}"></div>
                    <span class="legend-label">${materia.materia}</span>
                    <span class="legend-percentage">${percentage}%</span>
                    <span class="legend-count">(${questoes} questões)</span>
                </div>
            `;
        }).join('');
    }


    showEmptyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });

        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            container.innerHTML = `
                <div class="chart-empty">
                    <i class="fas fa-chart-pie"></i>
                    <p>Nenhum dado disponível</p>
                </div>
            `;
        });

        document.getElementById('best-subject-name').textContent = '-';
        document.getElementById('best-subject-percentage').textContent = '0%';
        document.getElementById('worst-subject-name').textContent = '-';
        document.getElementById('worst-subject-percentage').textContent = '0%';
        document.getElementById('general-chart-legend').innerHTML = '';
    }

    showChartError() {
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            container.innerHTML = `
                <div class="chart-empty">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar dados</p>
                </div>
            `;
        });
    }
    refreshCharts() {
        this.showMessage('Atualizando gráficos...', 'info');
        this.loadCharts();
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    async loadQuestoes() {
        try {
            this.showLoading(true);
            
            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                order: this.currentOrder,
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
            this.showMessage('Erro ao carregar questões', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderQuestoes(questoes) {
        const container = document.getElementById('questoes-list');
        const emptyState = document.getElementById('empty-state');
        
        if (questoes.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        container.innerHTML = questoes.map(questao => this.createQuestaoCard(questao)).join('');
    }

    createQuestaoCard(questao) {
        const porcentagem = questao.porcentagem_acertos || 0;
        const tempoInfo = questao.tempo_medio_por_questao ? 
            `<div class="questao-tempo">${questao.tempo_medio_por_questao}min/questão</div>` : '';

        return `
            <div class="questao-card" data-id="${questao.id}">
                <div class="questao-header">
                    <div class="questao-materia">${questao.materia}</div>
                    <div class="questao-date">${this.formatDate(questao.data_realizacao)}</div>
                </div>
                
                <div class="questao-content">
                    <h3 class="questao-tema">${questao.tema || 'Sem tema especificado'}</h3>
                    
                    <div class="questao-stats">
                        <div class="stat-item">
                            <span class="stat-value">${questao.total_questoes}</span>
                            <span class="stat-label">Total</span>
                        </div>
                        <div class="stat-item success">
                            <span class="stat-value">${questao.questoes_acertadas}</span>
                            <span class="stat-label">Acertos</span>
                        </div>
                        <div class="stat-item error">
                            <span class="stat-value">${questao.questoes_erradas}</span>
                            <span class="stat-label">Erros</span>
                        </div>
                        <div class="stat-item percentage">
                            <span class="stat-value">${porcentagem}%</span>
                            <span class="stat-label">Aproveitamento</span>
                        </div>
                    </div>
                    
                    ${tempoInfo}
                    
                    ${questao.observacoes ? `
                        <div class="questao-observacoes">
                            <i class="fas fa-comment"></i>
                            <span>${questao.observacoes}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="questao-actions">
                    <button class="btn-edit" onclick="questaoManager.editQuestao(${questao.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="questaoManager.deleteQuestao(${questao.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const currentPageSpan = document.getElementById('current-page');
        const totalPagesSpan = document.getElementById('total-pages');
        
        if (pagination.pages <= 1) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        
        prevBtn.disabled = pagination.page <= 1;
        nextBtn.disabled = pagination.page >= pagination.pages;
        
        currentPageSpan.textContent = pagination.page;
        totalPagesSpan.textContent = pagination.pages;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadQuestoes();
        }
    }

    nextPage() {
        this.currentPage++;
        this.loadQuestoes();
    }

    setView(view) {
        this.currentView = view;
        const container = document.getElementById('questoes-list');
        const gridBtn = document.getElementById('grid-view-btn');
        const listBtn = document.getElementById('list-view-btn');

        if (view === 'grid') {
            container.className = 'questoes-list grid-view';
            gridBtn.classList.add('active');
            listBtn.classList.remove('active');
        } else {
            container.className = 'questoes-list list-view';
            listBtn.classList.add('active');
            gridBtn.classList.remove('active');
        }
    }

    setOrder(order) {
        this.currentOrder = order;
        this.currentPage = 1;
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
                this.showMessage('Erro ao carregar dados da questão', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showMessage('Erro de conexão', 'error');
        }
    }

    fillFormForEdit(questao) {
        this.editingId = questao.id;
        
        document.getElementById('tema').value = questao.tema || '';
        document.getElementById('materia').value = questao.materia;
        document.getElementById('total_questoes').value = questao.total_questoes;
        document.getElementById('questoes_acertadas').value = questao.questoes_acertadas;
        document.getElementById('data_realizacao').value = questao.data_realizacao;
        document.getElementById('observacoes').value = questao.observacoes || '';

        if (questao.tempo_total_minutos) {
            document.getElementById('incluir_tempo').checked = true;
            document.getElementById('tempo-group').style.display = 'block';
            document.getElementById('tempo_total_minutos').value = questao.tempo_total_minutos;
            document.getElementById('tempo_total_minutos').required = true;
            this.calculateTempoMedio();
        }

        this.validateAcertos();

        document.getElementById('form-title').textContent = 'Editar Sessão';
        document.getElementById('submit-text').textContent = 'Atualizar Sessão';

        this.showForm();
    }

    deleteQuestao(id) {
        this.deleteId = id;
        document.getElementById('delete-modal').classList.remove('hidden');
    }

    hideDeleteModal() {
        document.getElementById('delete-modal').classList.add('hidden');
        this.deleteId = null;
    }

    async confirmDelete() {
        if (!this.deleteId) return;

        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/questoes/${this.deleteId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                this.showMessage('Sessão excluída com sucesso!', 'success');
                this.loadStatistics();
                this.loadCharts();
                this.loadQuestoes();
            } else {
                const error = await response.json();
                this.showMessage(error.error || 'Erro ao excluir sessão', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showMessage('Erro de conexão', 'error');
        } finally {
            this.showLoading(false);
            this.hideDeleteModal();
        }
    }

    async showStatistics() {
        try {
            this.showLoading(true);
            
            const response = await fetch('/api/questoes/estatisticas', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderStatistics(stats);
                document.getElementById('stats-modal').classList.remove('hidden');
            } else {
                this.showMessage('Erro ao carregar estatísticas', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            this.showMessage('Erro de conexão', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    renderStatistics(stats) {
        const { estatisticas_gerais, por_materia, ultimas_sessoes } = stats;
        
        document.getElementById('stats-total-questoes').textContent = estatisticas_gerais.total_questoes || 0;
        document.getElementById('stats-total-acertos').textContent = estatisticas_gerais.total_acertos || 0;
        document.getElementById('stats-media-acertos').textContent = `${estatisticas_gerais.media_acertos || 0}%`;
        document.getElementById('stats-tempo-medio').textContent = 
            estatisticas_gerais.tempo_medio_geral ? `${estatisticas_gerais.tempo_medio_geral}min` : 'N/A';

        const materiasContainer = document.getElementById('materias-stats-content');
        if (por_materia && por_materia.length > 0) {
            materiasContainer.innerHTML = por_materia.map(materia => `
                <div class="materia-stat">
                    <div class="materia-header">
                        <span class="materia-name">${materia.materia}</span>
                        <span class="materia-percentage">${materia.media_acertos}%</span>
                    </div>
                    <div class="materia-details">
                        <span>${materia.questoes} questões • ${materia.acertos} acertos</span>
                    </div>
                    <div class="materia-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${materia.media_acertos}%"></div>
                        </div>
                    </div>
                </div>
            `).join('');
        } else {
            materiasContainer.innerHTML = '<p class="no-data">Nenhum dado disponível</p>';
        }

        const ultimasContainer = document.getElementById('ultimas-sessoes-list');
        if (ultimas_sessoes && ultimas_sessoes.length > 0) {
            ultimasContainer.innerHTML = ultimas_sessoes.map(sessao => `
                <div class="ultima-sessao">
                    <div class="sessao-info">
                        <span class="sessao-materia">${sessao.materia}</span>
                        <span class="sessao-data">${this.formatDate(sessao.data_realizacao)}</span>
                    </div>
                    <div class="sessao-resultado">
                        <span class="sessao-acertos">${sessao.questoes_acertadas}/${sessao.total_questoes}</span>
                        <span class="sessao-porcentagem">${sessao.porcentagem_acertos}%</span>
                    </div>
                </div>
            `).join('');
        } else {
            ultimasContainer.innerHTML = '<p class="no-data">Nenhuma sessão registrada</p>';
        }
    }

    hideStatistics() {
        document.getElementById('stats-modal').classList.add('hidden');
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showMessage(message, type = 'info') {
        const messageContainer = document.getElementById('message');
        
        messageContainer.className = `message ${type}`;
        messageContainer.textContent = message;
        messageContainer.classList.remove('hidden');

        // Auto hide após 5 segundos
        setTimeout(() => {
            messageContainer.classList.add('hidden');
        }, 5000);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }
}

let questaoManager;
document.addEventListener('DOMContentLoaded', () => {
    questaoManager = new QuestaoManager();
});

 
