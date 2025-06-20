document.addEventListener('DOMContentLoaded', () => {
    console.log('Página de Redação carregada');
    
    // Verificar autenticação
    const token = localStorage.getItem('token');
    if (!token) {
        console.log('Token não encontrado, redirecionando para login');
        window.location.href = '/';
        return;
    }
    
    initializeVariables();
    
    // Inicializar página
    initRedacaoPage();
    loadRedacoes();
    bindEvents();
});

function initializeVariables() {
    if (typeof currentPage === 'undefined' || isNaN(currentPage)) {
        currentPage = 1;
    }
    if (typeof totalPages === 'undefined' || isNaN(totalPages)) {
        totalPages = 1;
    }
    if (typeof currentFilters === 'undefined') {
        currentFilters = {
            nivel: '',
            orderBy: 'created_at',
            orderDir: 'DESC'
        };
    }
    
    console.log('Variáveis inicializadas:', { currentPage, totalPages, currentFilters });
}

// Variáveis globais
let currentPage = 1;
let totalPages = 1;
let currentFilters = {
    nivel: '',
    orderBy: 'created_at',
    orderDir: 'DESC'
};
let redacaoToDelete = null;

function initRedacaoPage() {
    // Carregar menu
    if (typeof loadMenu === 'function') {
        loadMenu();
    }
    
    // Configurar contadores de caracteres
    setupCharCounters();
    
    // Configurar cálculo automático da nota final
    setupNotaCalculation();
    
    // Inicializar modo de visualização
    const savedViewMode = localStorage.getItem('redacao-view-mode') || 'grid';
    setViewMode(savedViewMode);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const originalText = submitText.textContent;
    
    submitBtn.disabled = true;
    submitText.textContent = 'Salvando...';
    
    try {
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        console.log('FormData completo:', data);
        
        data.competencia_1 = parseInt(data.competencia_1) || 0;
        data.competencia_2 = parseInt(data.competencia_2) || 0;
        data.competencia_3 = parseInt(data.competencia_3) || 0;
        data.competencia_4 = parseInt(data.competencia_4) || 0;
        data.competencia_5 = parseInt(data.competencia_5) || 0;
        
        const competencias = [data.competencia_1, data.competencia_2, data.competencia_3, data.competencia_4, data.competencia_5];
        for (let i = 0; i < competencias.length; i++) {
            if (isNaN(competencias[i]) || competencias[i] < 0 || competencias[i] > 200) {
                throw new Error(`Competência ${i + 1} deve ser um número entre 0 e 200`);
            }
        }
        
        const redacaoIdField = document.getElementById('redacao-id');
        const redacaoId = redacaoIdField ? redacaoIdField.value : '';
        
        console.log('Campo redacao-id existe?', !!redacaoIdField);
        console.log('Valor do campo redacao-id:', redacaoId);
        console.log('Valor do data.id:', data.id);
        
        const isEdit = redacaoId && redacaoId.trim() !== '' && redacaoId !== 'undefined';
        
        console.log('Dados finais a serem enviados:', data);
        console.log('ID da redação final:', redacaoId);
        console.log('É edição?', isEdit);
        
        const url = isEdit ? `/api/redacoes/${redacaoId}` : '/api/redacoes';
        const method = isEdit ? 'PUT' : 'POST';
        
        console.log('URL final:', url);
        console.log('Method final:', method);
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        console.log('Resposta do servidor:', result);
        
        if (response.ok) {
            showMessage(result.message, 'success');
            hideRedacaoForm();
            loadRedacoes();
        } else {
            showMessage(result.error || 'Erro ao salvar redação', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao salvar redação:', error);
        showMessage(error.message || 'Erro ao salvar redação', 'error');
    } finally {
        // Reabilitar botão
        submitBtn.disabled = false;
        submitText.textContent = originalText;
    }
}

async function loadRedacoes() {
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    const redacoesList = document.getElementById('redacoes-list');
    const paginationDiv = document.getElementById('pagination');
    
    console.log('Iniciando carregamento de redações...');
    
    if (loading) {
        loading.classList.remove('hidden');
        console.log('Loading mostrado');
    }
    if (emptyState) {
        emptyState.classList.add('hidden');
        console.log('Empty state escondido');
    }
    if (redacoesList) {
        redacoesList.innerHTML = '';
        console.log('Lista limpa');
    }
    if (paginationDiv) {
        paginationDiv.classList.add('hidden');
        console.log('Paginação escondida');
    }
    
    try {
        const validPage = !isNaN(currentPage) && currentPage > 0 ? currentPage : 1;
        const validLimit = 12;
        const validNivel = currentFilters.nivel || '';
        const validOrderBy = currentFilters.orderBy || 'created_at';
        const validOrder = currentFilters.orderDir || 'DESC';
        
        const params = new URLSearchParams({
            page: validPage.toString(),
            limit: validLimit.toString(),
            nivel: validNivel,
            orderBy: validOrderBy,
            order: validOrder
        });
        
        console.log('Fazendo requisição com parâmetros:', params.toString());
        
        const response = await fetch(`/api/redacoes?${params}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        console.log('Resposta recebida:', data);
        
        if (response.ok) {
            const redacoes = data.redacoes || [];
            const pagination = data.pagination || { currentPage: 1, totalPages: 1 };
            
            console.log('Número de redações:', redacoes.length);
            
            // Esconder loading ANTES de mostrar conteúdo erro que nao parava mais ksksksks
            if (loading) {
                loading.classList.add('hidden');
                console.log('Loading escondido após sucesso');
            }
            
            if (redacoes.length > 0) {
                displayRedacoes(redacoes);
                updatePagination(pagination);
                console.log('Redações exibidas');
            } else {
                if (emptyState) {
                    emptyState.classList.remove('hidden');
                    console.log('Empty state mostrado - nenhuma redação');
                }
            }
            
        } else {
            console.error('Erro na resposta:', data);
            
            if (loading) {
                loading.classList.add('hidden');
                console.log('Loading escondido após erro');
            }
            
            showMessage(data.error || 'Erro ao carregar redações', 'error');
            
            if (emptyState) {
                emptyState.classList.remove('hidden');
                console.log('Empty state mostrado após erro');
            }
        }
        
    } catch (error) {
        console.error('Erro ao carregar redações:', error);
        
        if (loading) {
            loading.classList.add('hidden');
            console.log('Loading escondido após exceção');
        }
        
        showMessage('Erro ao carregar redações', 'error');
        
        if (emptyState) {
            emptyState.classList.remove('hidden');
            console.log('Empty state mostrado após exceção');
        }
    }
}

function handleFilterChange() {
    const nivelFilter = document.getElementById('nivel-filter');
    const orderFilter = document.getElementById('order-filter');
    
    if (!currentFilters) {
        currentFilters = {
            nivel: '',
            orderBy: 'created_at',
            orderDir: 'DESC'
        };
    }
    
    if (nivelFilter) {
        currentFilters.nivel = nivelFilter.value;
    }
    
    if (orderFilter) {
        const orderValue = orderFilter.value.split('-');
        currentFilters.orderBy = orderValue[0] || 'created_at';
        currentFilters.orderDir = orderValue[1] || 'DESC';
    }
    
    console.log('Filtros atualizados:', currentFilters);
    
    currentPage = 1; 
    loadRedacoes();
}


async function showEstatisticas() {
    const statsModal = document.getElementById('stats-modal');
    statsModal.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/redacoes/stats', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const data = await response.json();
        console.log('Estatísticas carregadas:', data);
        
        if (response.ok) {
            displayEstatisticas(data);
        } else {
            showMessage(data.error || 'Erro ao carregar estatísticas', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        showMessage('Erro ao carregar estatísticas', 'error');
    }
}

function displayEstatisticas(data) {
    console.log('Exibindo estatísticas:', data);
    
    const stats = data.geral || data.estatisticas || {};
    const porNivel = data.porNivel || data.por_nivel || [];
    const ultimas = data.ultimasRedacoes || data.ultimas_redacoes || [];
    
    document.getElementById('total-redacoes').textContent = stats.totalRedacoes || stats.total_redacoes || 0;
    document.getElementById('media-geral').textContent = (stats.mediaGeral || stats.media_geral || 0).toFixed(1);
    document.getElementById('melhor-nota').textContent = stats.melhorNota || stats.melhor_nota || 0;
    document.getElementById('pior-nota').textContent = stats.piorNota || stats.pior_nota || 0;
    
    // Competências
    const competencias = ['c1', 'c2', 'c3', 'c4', 'c5'];
    const mediaCompetencias = stats.mediaCompetencias || stats.competencias || {};
    
    competencias.forEach(comp => {
        const valor = mediaCompetencias[comp] || 0;
        const percentage = (valor / 200) * 100;
        
        const valueElement = document.getElementById(`${comp}-value`);
        const barElement = document.getElementById(`${comp}-bar`);
        
        if (valueElement) valueElement.textContent = valor.toFixed(1);
        if (barElement) barElement.style.width = `${percentage}%`;
    });
    
    displayNivelStats(porNivel);
    
    displayUltimasRedacoes(ultimas);
}

function setupCharCounters() {
    const temaInput = document.getElementById('tema');
    const observacoesTextarea = document.getElementById('observacoes');
    
    if (temaInput) {
        const temaCounter = temaInput.parentElement.querySelector('.char-counter');
        temaInput.addEventListener('input', () => {
            updateCharCounter(temaInput, temaCounter, 500);
        });
    }
    
    if (observacoesTextarea) {
        const obsCounter = observacoesTextarea.parentElement.querySelector('.char-counter');
        observacoesTextarea.addEventListener('input', () => {
            updateCharCounter(observacoesTextarea, obsCounter, 1000);
        });
    }
}

function updateCharCounter(input, counter, maxLength) {
    const currentLength = input.value.length;
    counter.textContent = `${currentLength}/${maxLength} caracteres`;
    
    if (currentLength > maxLength * 0.9) {
        counter.style.color = '#e74c3c';
    } else if (currentLength > maxLength * 0.7) {
        counter.style.color = '#f39c12';
    } else {
        counter.style.color = '#7f8c8d';
    }
}

function setupNotaCalculation() {
    const competenciaInputs = ['c1', 'c2', 'c3', 'c4', 'c5'].map(id => document.getElementById(id));
    
    competenciaInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', calculateNotaFinal);
        }
    });
}

// nota final calc
function calculateNotaFinal() {
    const competencias = ['c1', 'c2', 'c3', 'c4', 'c5'];
    let total = 0;
    let allFilled = true;
    
    competencias.forEach(id => {
        const input = document.getElementById(id);
        const value = parseInt(input.value) || 0;
        
        if (!input.value) {
            allFilled = false;
        }
        
        total += value;
    });
    
    const notaDisplay = document.getElementById('nota-final-display');
    const progressFill = document.querySelector('.progress-fill');
    
    if (notaDisplay) {
        notaDisplay.textContent = total;
    }
    
    if (progressFill) {
        const percentage = (total / 1000) * 100;
        progressFill.style.width = `${percentage}%`;
        
        // Cores baseadas na nota
        if (total >= 800) {
            progressFill.style.backgroundColor = '#27ae60';
        } else if (total >= 600) {
            progressFill.style.backgroundColor = '#f39c12';
        } else {
            progressFill.style.backgroundColor = '#e74c3c';
        }
    }
}

// Bind de eventos
function bindEvents() {
    // Botões principais
    const novaRedacaoBtn = document.getElementById('nova-redacao-btn');
    const estatisticasBtn = document.getElementById('estatisticas-btn');
    
    if (novaRedacaoBtn) {
        novaRedacaoBtn.addEventListener('click', showRedacaoForm);
    }
    
    if (estatisticasBtn) {
        estatisticasBtn.addEventListener('click', showEstatisticas);
    }
    
    // Formulário
    const redacaoForm = document.getElementById('redacao-form');
    const closeFormBtn = document.getElementById('close-form-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    
    if (redacaoForm) {
        redacaoForm.addEventListener('submit', handleFormSubmit);
    }
    
    if (closeFormBtn) {
        closeFormBtn.addEventListener('click', hideRedacaoForm);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideRedacaoForm);
    }
    
    // Filtros
    const nivelFilter = document.getElementById('nivel-filter');
    const orderFilter = document.getElementById('order-filter');
    
    if (nivelFilter) {
        nivelFilter.addEventListener('change', handleFilterChange);
    }
    
    if (orderFilter) {
        orderFilter.addEventListener('change', handleFilterChange);
    }
    
    // Visualização
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    
    if (gridViewBtn) {
        gridViewBtn.addEventListener('click', () => setViewMode('grid'));
    }
    
    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => setViewMode('list'));
    }
    
    // Paginação
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));
    }
    
    // Modais
    const closeStatsBtn = document.getElementById('close-stats-btn');
    const closeDeleteBtn = document.getElementById('close-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    
    if (closeStatsBtn) {
        closeStatsBtn.addEventListener('click', hideStatsModal);
    }
    
    if (closeDeleteBtn) {
        closeDeleteBtn.addEventListener('click', hideDeleteModal);
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    }
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
    
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });
}

//  formulário de redação
function showRedacaoForm(redacao = null) {
    const formSection = document.getElementById('form-section');
    const formTitle = document.getElementById('form-title');
    const submitText = document.getElementById('submit-text');
    const form = document.getElementById('redacao-form');
    
    if (redacao) {
        console.log('Modo edição - redação recebida:', redacao);
        formTitle.textContent = 'Editar Redação';
        submitText.textContent = 'Atualizar Redação';
        fillForm(redacao);
    } else {
        console.log('Modo criação - nova redação');
        formTitle.textContent = 'Nova Redação';
        submitText.textContent = 'Salvar Redação';
        form.reset();
        
        const redacaoIdField = document.getElementById('redacao-id');
        if (redacaoIdField) {
            redacaoIdField.value = '';
            console.log('Campo ID limpo para nova redação');
        }
        
        calculateNotaFinal();
    }
    
    formSection.classList.remove('hidden');
    document.getElementById('tema').focus();
}
function hideRedacaoForm() {
    const formSection = document.getElementById('form-section');
    formSection.classList.add('hidden');
}

function fillForm(redacao) {
    console.log('Preenchendo formulário com:', redacao); 
    const redacaoIdField = document.getElementById('redacao-id');
    if (redacaoIdField) {
        redacaoIdField.value = redacao.id;
        console.log('ID definido no campo hidden:', redacao.id); // Debug
    }
    
    document.getElementById('tema').value = redacao.tema || '';
    document.getElementById('nivel').value = redacao.nivel_dificuldade || '';
    document.getElementById('c1').value = redacao.competencia_1 || 0;
    document.getElementById('c2').value = redacao.competencia_2 || 0;
    document.getElementById('c3').value = redacao.competencia_3 || 0;
    document.getElementById('c4').value = redacao.competencia_4 || 0;
    document.getElementById('c5').value = redacao.competencia_5 || 0;
    document.getElementById('observacoes').value = redacao.observacoes || '';
    
    const temaInput = document.getElementById('tema');
    const obsInput = document.getElementById('observacoes');
    
    if (temaInput) {
        const temaCounter = temaInput.parentElement.querySelector('.char-counter');
        if (temaCounter) updateCharCounter(temaInput, temaCounter, 500);
    }
    
    if (obsInput) {
        const obsCounter = obsInput.parentElement.querySelector('.char-counter');
        if (obsCounter) updateCharCounter(obsInput, obsCounter, 1000);
    }
    
    calculateNotaFinal();
}

function displayRedacoes(redacoes) {
    const redacoesList = document.getElementById('redacoes-list');
    const emptyState = document.getElementById('empty-state');
    
    console.log('Exibindo redações:', redacoes.length);
    
    if (!redacoes || !Array.isArray(redacoes)) {
        console.warn('Redações inválidas:', redacoes);
        if (emptyState) {
            emptyState.classList.remove('hidden');
            console.log('Empty state mostrado - dados inválidos');
        }
        return;
    }
    
    if (redacoes.length === 0) {
        console.log('Nenhuma redação para exibir');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            console.log('Empty state mostrado - array vazio');
        }
        if (redacoesList) {
            redacoesList.innerHTML = '';
        }
        return;
    }
    
    console.log('Renderizando', redacoes.length, 'redações');
    
    if (emptyState) {
        emptyState.classList.add('hidden');
        console.log('Empty state escondido - há redações');
    }
    
    if (redacoesList) {
        try {
            const cardsHTML = redacoes.map(redacao => createRedacaoCard(redacao)).join('');
            redacoesList.innerHTML = cardsHTML;
            console.log('Cards HTML gerados e inseridos');
        } catch (error) {
            console.error('Erro ao gerar cards:', error);
            if (emptyState) {
                emptyState.classList.remove('hidden');
            }
        }
    }
}
function createRedacaoCard(redacao) {
    if (!redacao) {
        console.warn('Redação inválida para criar card');
        return '';
    }
    
    try {
        const data = new Date(redacao.created_at).toLocaleDateString('pt-BR');
        const nivelEmoji = {
            'facil': '😊',
            'medio': '😐',
            'dificil': '😰'
        };
        
        const nivelText = {
            'facil': 'Fácil',
            'medio': 'Médio',
            'dificil': 'Difícil'
        };
        
        const notaFinal = redacao.nota_final || 0;
        const notaClass = notaFinal >= 800 ? 'nota-alta' : 
                         notaFinal >= 600 ? 'nota-media' : 'nota-baixa';
        
        return `
            <div class="redacao-card" data-id="${redacao.id}">
                <div class="card-header">
                    <div class="card-nivel">
                        <span class="nivel-emoji">${nivelEmoji[redacao.nivel_dificuldade] || '😐'}</span>
                        <span class="nivel-text">${nivelText[redacao.nivel_dificuldade] || 'Médio'}</span>
                    </div>
                    <div class="card-actions">
                        <button class="action-btn edit-btn" onclick="editRedacao(${redacao.id})" title="Editar">
                            ✏️
                        </button>
                        <button class="action-btn delete-btn" onclick="deleteRedacao(${redacao.id})" title="Excluir">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="card-content">
                    <h3 class="card-tema">${redacao.tema || 'Sem título'}</h3>
                    
                    <div class="card-nota ${notaClass}">
                        <span class="nota-valor">${notaFinal}</span>
                        <span class="nota-max">/1000</span>
                    </div>
                    
                    <div class="competencias-resumo">
                        <div class="comp-item">
                            <span class="comp-label">C1</span>
                            <span class="comp-valor">${redacao.competencia_1 || 0}</span>
                        </div>
                        <div class="comp-item">
                            <span class="comp-label">C2</span>
                            <span class="comp-valor">${redacao.competencia_2 || 0}</span>
                        </div>
                        <div class="comp-item">
                            <span class="comp-label">C3</span>
                            <span class="comp-valor">${redacao.competencia_3 || 0}</span>
                        </div>
                        <div class="comp-item">
                            <span class="comp-label">C4</span>
                            <span class="comp-valor">${redacao.competencia_4 || 0}</span>
                        </div>
                        <div class="comp-item">
                            <span class="comp-label">C5</span>
                            <span class="comp-valor">${redacao.competencia_5 || 0}</span>
                        </div>
                    </div>
                    
                    ${redacao.observacoes ? `
                        <div class="card-observacoes">
                            <p>${redacao.observacoes.substring(0, 100)}${redacao.observacoes.length > 100 ? '...' : ''}</p>
                        </div>
                    ` : ''}
                </div>
                
                <div class="card-footer">
                    <span class="card-data">📅 ${data}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao criar card da redação:', error, redacao);
        return '';
    }
}
async function editRedacao(id) {
    console.log('Editando redação ID:', id);
    
    try {
        const response = await fetch(`/api/redacoes/${id}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const redacao = await response.json();
        console.log('Redação carregada para edição:', redacao);
        
        if (response.ok) {
            showRedacaoForm(redacao);
        } else {
            showMessage(redacao.error || 'Erro ao carregar redação', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao carregar redação:', error);
        showMessage('Erro ao carregar redação', 'error');
    }
}
function deleteRedacao(id) {
    redacaoToDelete = id;
    const deleteModal = document.getElementById('delete-modal');
    deleteModal.classList.remove('hidden');
}

async function confirmDelete() {
    if (!redacaoToDelete) return;
    
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const originalText = confirmBtn.textContent;
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Excluindo...';
    
    try {
        const response = await fetch(`/api/redacoes/${redacaoToDelete}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage(result.message, 'success');
            hideDeleteModal();
            loadRedacoes();
        } else {
            showMessage(result.error || 'Erro ao excluir redação', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao excluir redação:', error);
        showMessage('Erro ao excluir redação', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
    }
}

function hideDeleteModal() {
    const deleteModal = document.getElementById('delete-modal');
    deleteModal.classList.add('hidden');
    redacaoToDelete = null;
}


function setViewMode(mode) {
    const redacoesList = document.getElementById('redacoes-list');
    const gridBtn = document.getElementById('grid-view-btn');
    const listBtn = document.getElementById('list-view-btn');
    
    if (!redacoesList) return;
    
    if (mode === 'grid') {
        redacoesList.classList.add('grid-view');
        redacoesList.classList.remove('list-view');
        if (gridBtn) gridBtn.classList.add('active');
        if (listBtn) listBtn.classList.remove('active');
    } else {
        redacoesList.classList.add('list-view');
        redacoesList.classList.remove('grid-view');
        if (listBtn) listBtn.classList.add('active');
        if (gridBtn) gridBtn.classList.remove('active');
    }
    
    localStorage.setItem('redacao-view-mode', mode);
}

function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    
    if (!messageDiv) {
        console.warn('Elemento message não encontrado');
        return;
    }
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');
    
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}
function changePage(page) {
    const newPage = parseInt(page);
    
    if (isNaN(newPage) || newPage < 1) {
        console.warn('Página inválida:', page);
        return;
    }
    
    if (totalPages > 0 && newPage > totalPages) {
        console.warn('Página maior que total:', newPage, 'total:', totalPages);
        return;
    }
    
    console.log('Mudando para página:', newPage);
    currentPage = newPage;
    loadRedacoes();
}

function updatePagination(pagination) {
    const paginationDiv = document.getElementById('pagination');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const currentPageSpan = document.getElementById('current-page');
    const totalPagesSpan = document.getElementById('total-pages');
    
    console.log('Atualizando paginação:', pagination);
    
    if (!pagination) {
        console.warn('Paginação não fornecida');
        if (paginationDiv) paginationDiv.classList.add('hidden');
        return;
    }
    
    currentPage = parseInt(pagination.currentPage) || parseInt(pagination.page) || 1;
    totalPages = parseInt(pagination.totalPages) || parseInt(pagination.pages) || 1;
    
    console.log('Paginação processada:', { currentPage, totalPages });
    
    if (!paginationDiv) {
        console.warn('Elemento pagination não encontrado');
        return;
    }
    
    if (totalPages <= 1) {
        paginationDiv.classList.add('hidden');
        console.log('Paginação escondida - apenas 1 página');
        return;
    }
    
    paginationDiv.classList.remove('hidden');
    console.log('Paginação mostrada');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
    
    if (currentPageSpan) {
        currentPageSpan.textContent = currentPage;
    }
    
    if (totalPagesSpan) {
        totalPagesSpan.textContent = totalPages;
    }
}
function displayUltimasRedacoes(ultimasRedacoes) {
    const container = document.getElementById('ultimas-redacoes-list');
    
    if (ultimasRedacoes.length === 0) {
        container.innerHTML = '<p class="no-data">Nenhuma redação registrada ainda</p>';
        return;
    }
    
    container.innerHTML = ultimasRedacoes.map(redacao => {
        const data = new Date(redacao.created_at).toLocaleDateString('pt-BR');
        const notaClass = redacao.nota_final >= 800 ? 'nota-alta' : 
                         redacao.nota_final >= 600 ? 'nota-media' : 'nota-baixa';
        
        return `
            <div class="ultima-redacao-item">
                <div class="redacao-info">
                    <h4 class="redacao-tema">${redacao.tema}</h4>
                    <span class="redacao-data">${data}</span>
                </div>
                <div class="redacao-nota ${notaClass}">
                    ${redacao.nota_final}
                </div>
            </div>
        `;
    }).join('');
}

function hideStatsModal() {
    const statsModal = document.getElementById('stats-modal');
    statsModal.classList.add('hidden');
}

function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');
    
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    const savedViewMode = localStorage.getItem('redacao-view-mode') || 'grid';
    setViewMode(savedViewMode);
});

window.editRedacao = editRedacao;
window.deleteRedacao = deleteRedacao;
