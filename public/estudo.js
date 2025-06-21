class EstudoManager {
    constructor() {
        this.currentPeriod = 'daily';
        this.charts = {};
        this.editingId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDate();
        this.loadEstudos();
        this.initCharts();
        this.createModal();
    }

    setupEventListeners() {
        // Formulário
        document.getElementById('estudoForm').addEventListener('submit', this.handleSubmit.bind(this));
        
        // Mostrar campo de questões quando atividade for "Responder questões"
        document.getElementById('atividade').addEventListener('change', this.toggleQuestoesField.bind(this));
        
        // Filtros de período
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', this.handlePeriodChange.bind(this));
        });
    }

    createModal() {
        const modalHTML = `
            <div id="editModal" class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3 id="modalTitle">Editar Estudo</h3>
                        <button class="modal-close" onclick="estudoManager.closeModal()">&times;</button>
                    </div>
                    <div id="modalContent">
                        <!-- Conteúdo será inserido dinamicamente -->
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Fechar modal ao clicar fora
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                this.closeModal();
            }
        });
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dataEstudo').value = today;
    }

    toggleQuestoesField() {
        const atividade = document.getElementById('atividade').value;
        const questoesGroup = document.getElementById('questoesGroup');
        
        if (atividade === 'Responder questões') {
            questoesGroup.classList.remove('hidden');
            questoesGroup.classList.add('show');
            document.getElementById('questoes').required = true;
        } else {
            questoesGroup.classList.add('hidden');
            questoesGroup.classList.remove('show');
            document.getElementById('questoes').required = false;
            document.getElementById('questoes').value = '';
        }
    }

    getAuthHeaders() {
        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Token de autenticação não encontrado');
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('.btn-primary');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        // Loading state
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        
        try {
            const formData = new FormData(form);
            const data = {
                materia: formData.get('materia'),
                atividade: formData.get('atividade') || null,
                tempo: parseInt(formData.get('tempo')),
                quantidade_questoes: formData.get('questoes') ? parseInt(formData.get('questoes')) : null,
                descricao: formData.get('descricao') || null,
                data_estudo: formData.get('dataEstudo')
            };

            console.log('Enviando dados:', data);

            const response = await fetch('/api/estudos', {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });

            const result = await response.json();
            console.log('Resposta da API:', result);

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao salvar estudo');
            }

            this.showNotification('Estudo registrado com sucesso!', 'success');
            form.reset();
            this.setDefaultDate();
            this.toggleQuestoesField();
            this.loadEstudos();
            this.updateCharts();

        } catch (error) {
            console.error('Erro:', error);
            if (error.message.includes('Token')) {
                this.showNotification('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                this.showNotification('Erro ao registrar estudo. Tente novamente.', 'error');
            }
        } finally {
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    }

    async loadEstudos() {
        try {
            console.log('Carregando estudos...');
            
            const response = await fetch('/api/estudos', {
                headers: this.getAuthHeaders()
            });

            console.log('Status da resposta:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erro da API:', errorData);
                throw new Error(errorData.error || 'Erro ao carregar estudos');
            }
            
            const estudos = await response.json();
            console.log('Estudos carregados:', estudos);
            
            this.renderEstudos(estudos);
            this.updateStats(estudos);
            
        } catch (error) {
            console.error('Erro ao carregar estudos:', error);
            if (error.message.includes('Token')) {
                this.showNotification('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                this.showNotification('Erro ao carregar estudos', 'error');
                this.renderEmptyState();
            }
        }
    }

    renderEstudos(estudos) {
        const container = document.getElementById('estudosList');
        
        if (estudos.length === 0) {
            this.renderEmptyState();
            return;
        }

               container.innerHTML = estudos.slice(0, 10).map(estudo => `
            <div class="estudo-item">
                <div class="estudo-header">
                    <span class="estudo-materia">${estudo.materia}</span>
                    <span class="estudo-tempo">${estudo.tempo_minutos}min</span>
                </div>
                <div class="estudo-details">
                    ${estudo.atividade ? `<span>📝 ${estudo.atividade}</span>` : ''}
                    ${estudo.quantidade_questoes ? `<span>❓ ${estudo.quantidade_questoes} questões</span>` : ''}
                    <span>📅 ${this.formatDate(estudo.data_estudo)}</span>
                </div>
                ${estudo.descricao ? `<div class="estudo-descricao">${estudo.descricao}</div>` : ''}
                <div class="estudo-actions">
                    <button class="btn-action btn-edit" onclick="estudoManager.editEstudo(${estudo.id})">
                        ✏️ Editar
                    </button>
                    <button class="btn-action btn-delete" onclick="estudoManager.deleteEstudo(${estudo.id})">
                        🗑️ Excluir
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderEmptyState() {
        const container = document.getElementById('estudosList');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📚</div>
                <h3>Nenhum estudo registrado</h3>
                <p>Comece registrando seu primeiro estudo usando o formulário ao lado.</p>
            </div>
        `;
    }

    async editEstudo(id) {
        try {
            console.log('Editando estudo:', id);
            
            const response = await fetch(`/api/estudos/${id}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao carregar estudo');
            }

            const estudo = await response.json();
            console.log('Estudo carregado para edição:', estudo);
            
            this.showEditModal(estudo);
            
        } catch (error) {
            console.error('Erro ao carregar estudo para edição:', error);
            this.showNotification('Erro ao carregar estudo para edição', 'error');
        }
    }

    showEditModal(estudo) {
        this.editingId = estudo.id;
        
        const modalContent = document.getElementById('modalContent');
        modalContent.innerHTML = `
            <form id="editEstudoForm" class="estudo-form">
                <div class="form-group">
                    <label for="editMateria">Matéria</label>
                    <select id="editMateria" name="materia" required>
                        <option value="">Selecione uma matéria</option>
                        <option value="Linguagens" ${estudo.materia === 'Linguagens' ? 'selected' : ''}>Linguagens</option>
                        <option value="História" ${estudo.materia === 'História' ? 'selected' : ''}>História</option>
                        <option value="Geografia" ${estudo.materia === 'Geografia' ? 'selected' : ''}>Geografia</option>
                        <option value="Filosofia" ${estudo.materia === 'Filosofia' ? 'selected' : ''}>Filosofia</option>
                        <option value="Sociologia" ${estudo.materia === 'Sociologia' ? 'selected' : ''}>Sociologia</option>
                        <option value="Redação" ${estudo.materia === 'Redação' ? 'selected' : ''}>Redação</option>
                        <option value="Matemática" ${estudo.materia === 'Matemática' ? 'selected' : ''}>Matemática</option>
                        <option value="Física" ${estudo.materia === 'Física' ? 'selected' : ''}>Física</option>
                        <option value="Química" ${estudo.materia === 'Química' ? 'selected' : ''}>Química</option>
                        <option value="Biologia" ${estudo.materia === 'Biologia' ? 'selected' : ''}>Biologia</option>
                        <option value="Inglês" ${estudo.materia === 'Inglês' ? 'selected' : ''}>Inglês</option>
                        <option value="Espanhol" ${estudo.materia === 'Espanhol' ? 'selected' : ''}>Espanhol</option>
                        <option value="Gramática" ${estudo.materia === 'Gramática' ? 'selected' : ''}>Gramática</option>
                        <option value="Outra" ${estudo.materia === 'Outra' ? 'selected' : ''}>Outra</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="editAtividade">Atividade (opcional)</label>
                    <select id="editAtividade" name="atividade">
                        <option value="">Selecione uma atividade</option>
                        <option value="Escrever redação" ${estudo.atividade === 'Escrever redação' ? 'selected' : ''}>Escrever redação</option>
                        <option value="Assistir videoaulas" ${estudo.atividade === 'Assistir videoaulas' ? 'selected' : ''}>Assistir videoaulas</option>
                        <option value="Responder questões" ${estudo.atividade === 'Responder questões' ? 'selected' : ''}>Responder questões</option>
                        <option value="Anki" ${estudo.atividade === 'Anki' ? 'selected' : ''}>Anki</option>
                        <option value="Leitura" ${estudo.atividade === 'Leitura' ? 'selected' : ''}>Leitura</option>
                        <option value="Resumos" ${estudo.atividade === 'Resumos' ? 'selected' : ''}>Resumos</option>
                        <option value="Exercícios" ${estudo.atividade === 'Exercícios' ? 'selected' : ''}>Exercícios</option>
                        <option value="Revisão" ${estudo.atividade === 'Revisão' ? 'selected' : ''}>Revisão</option>
                        <option value="Outra" ${estudo.atividade === 'Outra' ? 'selected' : ''}>Outra</option>
                    </select>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="editTempo">Tempo de Estudo (minutos)</label>
                        <input type="number" id="editTempo" name="tempo" min="1" value="${estudo.tempo_minutos}" required>
                    </div>

                    <div class="form-group ${estudo.quantidade_questoes ? '' : 'hidden'}" id="editQuestoesGroup">
                        <label for="editQuestoes">Quantidade de Questões</label>
                        <input type="number" id="editQuestoes" name="questoes" min="1" value="${estudo.quantidade_questoes || ''}">
                    </div>
                </div>

                <div class="form-group">
                    <label for="editDataEstudo">Data do Estudo</label>
                    <input type="date" id="editDataEstudo" name="dataEstudo" value="${estudo.data_estudo}" required>
                </div>

                <div class="form-group">
                    <label for="editDescricao">Descrição (opcional)</label>
                    <textarea id="editDescricao" name="descricao" rows="3" placeholder="Descreva o que foi estudado, dificuldades encontradas, etc.">${estudo.descricao || ''}</textarea>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="estudoManager.closeModal()">Cancelar</button>
                    <button type="submit" class="btn-save">
                        <span class="btn-text">Salvar Alterações</span>
                        <span class="btn-loading hidden">Salvando...</span>
                    </button>
                </div>
            </form>
        `;

        // Configurar eventos do modal de edição
        document.getElementById('editEstudoForm').addEventListener('submit', this.handleEditSubmit.bind(this));
        document.getElementById('editAtividade').addEventListener('change', this.toggleEditQuestoesField.bind(this));
        
        // Mostrar modal
        document.getElementById('editModal').classList.add('show');
    }

    toggleEditQuestoesField() {
        const atividade = document.getElementById('editAtividade').value;
        const questoesGroup = document.getElementById('editQuestoesGroup');
        
        if (atividade === 'Responder questões') {
            questoesGroup.classList.remove('hidden');
            questoesGroup.classList.add('show');
            document.getElementById('editQuestoes').required = true;
        } else {
            questoesGroup.classList.add('hidden');
            questoesGroup.classList.remove('show');
            document.getElementById('editQuestoes').required = false;
            document.getElementById('editQuestoes').value = '';
        }
    }

    async handleEditSubmit(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('.btn-save');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');
        
        // Loading state
        submitBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        
        try {
            const formData = new FormData(form);
            const data = {
                materia: formData.get('materia'),
                atividade: formData.get('atividade') || null,
                tempo: parseInt(formData.get('tempo')),
                quantidade_questoes: formData.get('questoes') ? parseInt(formData.get('questoes')) : null,
                descricao: formData.get('descricao') || null,
                data_estudo: formData.get('dataEstudo')
            };

            console.log('Atualizando estudo:', this.editingId, data);

            const response = await fetch(`/api/estudos/${this.editingId}`, {
                method: 'PUT',
                headers: this.getAuthHeaders(),
                body: JSON.stringify(data)
            });

            const result = await response.json();
            console.log('Resposta da API:', result);

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao atualizar estudo');
            }

            this.showNotification('Estudo atualizado com sucesso!', 'success');
            this.closeModal();
            this.loadEstudos();
            this.updateCharts();

        } catch (error) {
            console.error('Erro:', error);
            if (error.message.includes('Token')) {
                this.showNotification('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                this.showNotification('Erro ao atualizar estudo. Tente novamente.', 'error');
            }
        } finally {
            submitBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    }

    async deleteEstudo(id) {
        try {
            console.log('Preparando para deletar estudo:', id);
            
            // Buscar dados do estudo para mostrar na confirmação
            const response = await fetch(`/api/estudos/${id}`, {
                headers: this.getAuthHeaders()
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro ao carregar estudo');
            }

            const estudo = await response.json();
            this.showDeleteConfirmation(estudo);
            
        } catch (error) {
            console.error('Erro ao preparar exclusão:', error);
            this.showNotification('Erro ao preparar exclusão', 'error');
        }
    }

    showDeleteConfirmation(estudo) {
        const modalTitle = document.getElementById('modalTitle');
        const modalContent = document.getElementById('modalContent');
        
        modalTitle.textContent = 'Confirmar Exclusão';
        modalContent.innerHTML = `
            <div class="confirm-delete">
                <p>Tem certeza que deseja excluir este registro de estudo?</p>
                
                <div class="estudo-preview">
                    <h4>${estudo.materia} - ${estudo.tempo_minutos} minutos</h4>
                    <span>📅 ${this.formatDate(estudo.data_estudo)}</span>
                    ${estudo.atividade ? `<br><span>📝 ${estudo.atividade}</span>` : ''}
                    ${estudo.quantidade_questoes ? `<br><span>❓ ${estudo.quantidade_questoes} questões</span>` : ''}
                </div>
                
                <p><strong>Esta ação não pode ser desfeita.</strong></p>
                
                <div class="modal-actions">
                    <button type="button" class="btn-cancel" onclick="estudoManager.closeModal()">Cancelar</button>
                    <button type="button" class="btn-confirm-delete" onclick="estudoManager.confirmDelete(${estudo.id})">
                        <span class="btn-text">Excluir</span>
                        <span class="btn-loading hidden">Excluindo...</span>
                    </button>
                </div>
            </div>
        `;
        
        // Mostrar modal
        document.getElementById('editModal').classList.add('show');
    }

    async confirmDelete(id) {
        const deleteBtn = document.querySelector('.btn-confirm-delete');
        const btnText = deleteBtn.querySelector('.btn-text');
        const btnLoading = deleteBtn.querySelector('.btn-loading');
        
        // Loading state
        deleteBtn.disabled = true;
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        
        try {
            console.log('Deletando estudo:', id);

            const response = await fetch(`/api/estudos/${id}`, {
                method: 'DELETE',
                headers: this.getAuthHeaders()
            });

            const result = await response.json();
            console.log('Resposta da API:', result);

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao excluir estudo');
            }
                        this.showNotification('Estudo excluído com sucesso!', 'success');
            this.closeModal();
            this.loadEstudos();
            this.updateCharts();

        } catch (error) {
            console.error('Erro:', error);
            if (error.message.includes('Token')) {
                this.showNotification('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            } else {
                this.showNotification('Erro ao excluir estudo. Tente novamente.', 'error');
            }
        } finally {
            deleteBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoading.classList.add('hidden');
        }
    }

    closeModal() {
        const modal = document.getElementById('editModal');
        modal.classList.remove('show');
        this.editingId = null;
        
        // Limpar conteúdo após animação
        setTimeout(() => {
            document.getElementById('modalContent').innerHTML = '';
            document.getElementById('modalTitle').textContent = 'Editar Estudo';
        }, 300);
    }

    updateStats(estudos) {
        const totalMinutos = estudos.reduce((sum, estudo) => sum + estudo.tempo_minutos, 0);
        const totalHoras = Math.floor(totalMinutos / 60);
        const minutosRestantes = totalMinutos % 60;
        
        const totalQuestoes = estudos.reduce((sum, estudo) => sum + (estudo.quantidade_questoes || 0), 0);
        
        const diasUnicos = new Set(estudos.map(estudo => estudo.data_estudo)).size;
        
        const materiaCount = {};
        estudos.forEach(estudo => {
            materiaCount[estudo.materia] = (materiaCount[estudo.materia] || 0) + estudo.tempo_minutos;
        });
        
        const materiaFavorita = Object.keys(materiaCount).length > 0 
            ? Object.keys(materiaCount).reduce((a, b) => materiaCount[a] > materiaCount[b] ? a : b)
            : '-';

        // Verificar se os elementos existem antes de atualizar
        const totalHorasEl = document.getElementById('totalHoras');
        const totalQuestoesEl = document.getElementById('totalQuestoes');
        const diasEstudadosEl = document.getElementById('diasEstudados');
        const materiaFavoritaEl = document.getElementById('materiaFavorita');

        if (totalHorasEl) totalHorasEl.textContent = `${totalHoras}h ${minutosRestantes}min`;
        if (totalQuestoesEl) totalQuestoesEl.textContent = totalQuestoes;
        if (diasEstudadosEl) diasEstudadosEl.textContent = diasUnicos;
        if (materiaFavoritaEl) materiaFavoritaEl.textContent = materiaFavorita;
    }

    handlePeriodChange(e) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPeriod = e.target.dataset.period;
        this.updateCharts();
    }

    initCharts() {
        this.initTempoChart();
        this.initMateriaChart();
        this.updateCharts();
    }

    initTempoChart() {
        const ctx = document.getElementById('tempoChart');
        if (!ctx) {
            console.warn('Elemento tempoChart não encontrado');
            return;
        }
        
        this.charts.tempo = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Tempo de Estudo (minutos)',
                    data: [],
                    borderColor: '#cba6f7',
                    backgroundColor: 'rgba(203, 166, 247, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Tempo de Estudo por Período',
                        color: '#cdd6f4'
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#a6adc8',
                            callback: function(value) {
                                return value + 'min';
                            }
                        },
                        grid: {
                            color: '#45475a'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#a6adc8'
                        },
                        grid: {
                            color: '#45475a'
                        }
                    }
                }
            }
        });
    }

    initMateriaChart() {
        const ctx = document.getElementById('materiaChart');
        if (!ctx) {
            console.warn('Elemento materiaChart não encontrado');
            return;
        }
        
        this.charts.materia = new Chart(ctx.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#cba6f7', '#89b4fa', '#94e2d5', '#a6e3a1',
                        '#f9e2af', '#fab387', '#f38ba8', '#eba0ac',
                        '#f5c2e7', '#f2cdcd', '#89dceb', '#74c7ec'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribuição por Matéria',
                        color: '#cdd6f4'
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#a6adc8'
                        }
                    }
                }
            }
        });
    }

    async updateCharts() {
        try {
            console.log('Atualizando gráficos...');
            
            const response = await fetch(`/api/estudos/stats?period=${this.currentPeriod}`, {
                headers: this.getAuthHeaders()
            });

            console.log('Status da resposta (stats):', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erro da API (stats):', errorData);
                throw new Error(errorData.error || 'Erro ao carregar estatísticas');
            }
            
            const stats = await response.json();
            console.log('Estatísticas carregadas:', stats);
            
            // Atualizar gráfico de tempo
            if (this.charts.tempo) {
                this.charts.tempo.data.labels = stats.tempo.labels;
                this.charts.tempo.data.datasets[0].data = stats.tempo.data;
                this.charts.tempo.update();
            }
            
            // Atualizar gráfico de matérias
            if (this.charts.materia) {
                this.charts.materia.data.labels = stats.materias.labels;
                this.charts.materia.data.datasets[0].data = stats.materias.data;
                this.charts.materia.update();
            }
            
        } catch (error) {
            console.error('Erro ao atualizar gráficos:', error);
            if (error.message.includes('Token')) {
                this.showNotification('Sessão expirada. Faça login novamente.', 'error');
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
            }
        }
    }

    formatDate(dateString) {
        try {
            // Verificar se a data é válida
            if (!dateString) return 'Data inválida';
            
            // Se a data já vem no formato YYYY-MM-DD, usar diretamente
            let date;
            if (dateString.includes('T')) {
                // Se tem horário, extrair apenas a data
                date = new Date(dateString.split('T')[0] + 'T12:00:00');
            } else {
                // Se é apenas data, adicionar horário do meio-dia para evitar problemas de timezone
                date = new Date(dateString + 'T12:00:00');
            }
            
            // Verificar se a data é válida
            if (isNaN(date.getTime())) {
                console.warn('Data inválida:', dateString);
                return 'Data inválida';
            }
            
            // Formatar para DD/MM/YYYY
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            
            return `${day}/${month}/${year}`;
        } catch (error) {
            console.error('Erro ao formatar data:', error, 'Data original:', dateString);
            return 'Data inválida';
        }
    }

    showNotification(message, type) {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type}`;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        } else {
            // Fallback para alert se não houver elemento de notificação
            console.log(`${type.toUpperCase()}: ${message}`);
            alert(message);
        }
    }
}

// Variável global para acessar o manager
let estudoManager;

// Inicializar quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se o usuário está autenticado
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('Usuário não autenticado, redirecionando...');
        window.location.href = '/';
        return;
    }
    
    console.log('Inicializando EstudoManager...');
    estudoManager = new EstudoManager();
});
