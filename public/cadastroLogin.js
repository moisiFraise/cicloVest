// Elementos DOM
const loginToggle = document.getElementById('login-toggle');
const registerToggle = document.getElementById('register-toggle');
const formToggle = document.getElementById('form-toggle');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const userArea = document.getElementById('user-area');
const messageDiv = document.getElementById('message');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');

// Toggle entre login e cadastro
loginToggle.addEventListener('click', () => {
    showLogin();
});

registerToggle.addEventListener('click', () => {
    showRegister();
});

function showLogin() {
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
    loginToggle.classList.add('active');
    registerToggle.classList.remove('active');
    formToggle.classList.remove('register-active');
    clearMessage();
}

function showRegister() {
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
    registerToggle.classList.add('active');
    loginToggle.classList.remove('active');
    formToggle.classList.add('register-active');
    clearMessage();
}

// Verificar se usuário já está logado
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        // Se já está logado, redirecionar para dashboard
        window.location.href = '/MainPage.html';
        return;
    }
    
    // Se não está logado, mostrar formulário de login por padrão
    showLogin();
});

// Formulário de cadastro
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const senha = document.getElementById('register-password').value;

    // Validações no frontend
    if (!nome || !email || !senha) {
        showMessage('Todos os campos são obrigatórios', 'error');
        return;
    }

    if (nome.length < 2) {
        showMessage('Nome deve ter pelo menos 2 caracteres', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showMessage('Por favor, insira um email válido', 'error');
        return;
    }

    if (senha.length < 6) {
        showMessage('Senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }

    setLoading(registerBtn, true);

    try {
        const response = await fetch('/api/cadastro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nome, email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showMessage('Cadastro realizado com sucesso! 🎉 Redirecionando...', 'success');
            
            // Redirecionar para dashboard após breve delay
            setTimeout(() => {
                window.location.href = data.redirectTo || '/MainPage.html';
            }, 1500);
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showMessage('Erro ao conectar com servidor. Tente novamente.', 'error');
    } finally {
        setLoading(registerBtn, false);
    }
});

// Formulário de login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-password').value;

    // Validações no frontend
    if (!email || !senha) {
        showMessage('Email e senha são obrigatórios', 'error');
        return;
    }

    if (!isValidEmail(email)) {
        showMessage('Por favor, insira um email válido', 'error');
        return;
    }

    setLoading(loginBtn, true);

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            showMessage('Login realizado com sucesso! 🎉 Redirecionando...', 'success');
            
            // Redirecionar para dashboard após breve delay
            setTimeout(() => {
                window.location.href = data.redirectTo || '/MainPage.html';
            }, 1500);
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showMessage('Erro ao conectar com servidor. Tente novamente.', 'error');
    } finally {
        setLoading(loginBtn, false);
    }
});

// Logout (caso seja usado na área do usuário)
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            const token = localStorage.getItem('token');
            
            if (token) {
                // Chamar API de logout para registrar a atividade
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            }
        } catch (error) {
            console.error('Erro no logout:', error);
        } finally {
            // Limpar dados locais independentemente do resultado da API
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showMessage('Logout realizado com sucesso! 👋', 'success');
            
            // Redirecionar para login após breve delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
        }
    });
}

// Botão para ir ao dashboard (caso seja usado na área do usuário)
const dashboardBtn = document.getElementById('dashboard-btn');
if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
        window.location.href = '/MainPage.html';
    });
}

// Funções auxiliares
function showUserArea() {
    const formContainer = document.querySelector('.form-container');
    if (formContainer) formContainer.style.display = 'none';
    if (userArea) userArea.style.display = 'block';
}

function showLoginForm() {
    const formContainer = document.querySelector('.form-container');
    if (formContainer) formContainer.style.display = 'block';
    if (userArea) userArea.style.display = 'none';
    showLogin();
}

async function loadUserProfile() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        showLoginForm();
        return;
    }
    
    try {
        const response = await fetch('/api/perfil', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            displayUserInfo(data);
        } else {
            // Token inválido ou expirado
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showLoginForm();
            showMessage('Sessão expirada. Faça login novamente.', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showMessage('Erro ao carregar perfil do usuário', 'error');
    }
}

function displayUserInfo(user) {
    const userInfo = document.getElementById('user-info');
    if (!userInfo) return;
    
    const createdDate = new Date(user.created_at).toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    userInfo.innerHTML = `
        <div class="user-profile">
            <h3>👤 ${escapeHtml(user.nome)}</h3>
            <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
            <p><strong>ID:</strong> #${user.id}</p>
            <p><strong>Membro desde:</strong> ${createdDate}</p>
        </div>
    `;
}

function showMessage(message, type) {
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Auto-hide após 5 segundos
    setTimeout(() => {
        clearMessage();
    }, 5000);
}

function clearMessage() {
    if (!messageDiv) return;
    
    messageDiv.style.display = 'none';
    messageDiv.className = 'message';
    messageDiv.textContent = '';
}

function clearForms() {
    // Limpar formulário de login
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    
    // Limpar formulário de cadastro
    const registerName = document.getElementById('register-name');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');
    if (registerName) registerName.value = '';
    if (registerEmail) registerEmail.value = '';
    if (registerPassword) registerPassword.value = '';
}

function setLoading(button, isLoading) {
    if (!button) return;
    
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.setAttribute('aria-busy', 'true');
        
        // Salvar texto original
        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }
        
        // Mostrar texto de carregamento
        if (button === loginBtn) {
            button.textContent = 'Entrando...';
        } else if (button === registerBtn) {
            button.textContent = 'Cadastrando...';
        }
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.setAttribute('aria-busy', 'false');
        
        // Restaurar texto original
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
        }
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Verificar token periodicamente (a cada 5 minutos)
setInterval(() => {
    const token = localStorage.getItem('token');
    if (token && userArea && userArea.style.display !== 'none') {
        loadUserProfile();
    }
}, 5 * 60 * 1000); // 5 minutos

// Validação em tempo real
const registerEmailInput = document.getElementById('register-email');
if (registerEmailInput) {
    registerEmailInput.addEventListener('input', function(e) {
        const email = e.target.value;
        if (email && !isValidEmail(email)) {
            e.target.setCustomValidity('Por favor, insira um email válido');
        } else {
            e.target.setCustomValidity('');
        }
    });
}

const loginEmailInput = document.getElementById('login-email');
if (loginEmailInput) {
    loginEmailInput.addEventListener('input', function(e) {
        const email = e.target.value;
        if (email && !isValidEmail(email)) {
            e.target.setCustomValidity('Por favor, insira um email válido');
        } else {
            e.target.setCustomValidity('');
        }
    });
}

const registerPasswordInput = document.getElementById('register-password');
if (registerPasswordInput) {
    registerPasswordInput.addEventListener('input', function(e) {
        const password = e.target.value;
        if (password && password.length < 6) {
            e.target.setCustomValidity('Senha deve ter pelo menos 6 caracteres');
        } else {
            e.target.setCustomValidity('');
        }
    });
}

const registerNameInput = document.getElementById('register-name');
if (registerNameInput) {
    registerNameInput.addEventListener('input', function(e) {
        const name = e.target.value.trim();
        if (name && name.length < 2) {
            e.target.setCustomValidity('Nome deve ter pelo menos 2 caracteres');
        } else {
            e.target.setCustomValidity('');
        }
    });
}

// Navegação por teclado
document.addEventListener('keydown', function(e) {
    // Alt + L para ir para login
    if (e.altKey && e.key === 'l') {
        e.preventDefault();
        showLogin();
        const loginEmail = document.getElementById('login-email');
        if (loginEmail) loginEmail.focus();
    }
    
    // Alt + R para ir para cadastro
    if (e.altKey && e.key === 'r') {
        e.preventDefault();
        showRegister();
        const registerName = document.getElementById('register-name');
        if (registerName) registerName.focus();
    }
    
    // Escape para limpar mensagens
    if (e.key === 'Escape') {
        clearMessage();
    }
});

// Service Worker para cache (opcional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registrado com sucesso:', registration);
            })
            .catch(registrationError => {
                console.log('SW falhou ao registrar:', registrationError);
            });
    });
}

// Detectar se está offline
window.addEventListener('online', () => {
    showMessage('Conexão restaurada! 🌐', 'success');
});

window.addEventListener('offline', () => {
    showMessage('Você está offline. Algumas funcionalidades podem não funcionar.', 'error');
});

// Prevenir envio de formulário com Enter em campos específicos
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            // Se for o último campo do formulário, submeter
            const form = this.closest('form');
            if (!form) return;
            
            const inputs = form.querySelectorAll('input');
            const lastInput = inputs[inputs.length - 1];
            
            if (this === lastInput) {
                form.dispatchEvent(new Event('submit'));
            } else {
                // Focar no próximo campo
                const currentIndex = Array.from(inputs).indexOf(this);
                if (currentIndex < inputs.length - 1) {
                    inputs[currentIndex + 1].focus();
                }
            }
        }
    });
});

// Animação de entrada suave
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.container');
    if (container) {
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            container.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
            container.style.opacity = '1';
            container.style.transform = 'translateY(0)';
        }, 100);
    }
});

// Feedback visual para campos obrigatórios
document.querySelectorAll('input[required]').forEach(input => {
    input.addEventListener('blur', function() {
        if (!this.value.trim()) {
            this.style.borderColor = 'var(--ctp-red)';
        } else {
            this.style.borderColor = '';
        }
    });
    
    input.addEventListener('input', function() {
        if (this.value.trim()) {
            this.style.borderColor = '';
        }
    });
});

// Verificar autenticação ao carregar a página
function checkAuthentication() {
    const token = localStorage.getItem('token');
    const currentPath = window.location.pathname;
    
    // Se está na página de login e tem token válido, redirecionar
    if ((currentPath === '/' || currentPath === '/index.html') && token) {
        // Verificar se o token ainda é válido
        fetch('/api/perfil', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                // Token válido, redirecionar para dashboard
                window.location.href = '/MainPage.html';
            } else {
                // Token inválido, remover e continuar na página de login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        })
        .catch(error => {
            console.error('Erro ao verificar token:', error);
            // Em caso de erro, remover token por segurança
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        });
    }
}

// Auto-complete e salvamento de dados (opcional)
function saveFormData(formType, data) {
    const savedData = {
        ...data,
        timestamp: Date.now()
    };
    localStorage.setItem(`ciclovest_${formType}_draft`, JSON.stringify(savedData));
}

function loadFormData(formType) {
    const saved = localStorage.getItem(`ciclovest_${formType}_draft`);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            // Verificar se os dados não são muito antigos (24 horas)
            if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                return data;
            } else {
                // Dados antigos, remover
                localStorage.removeItem(`ciclovest_${formType}_draft`);
            }
        } catch (error) {
            console.error('Erro ao carregar dados salvos:', error);
            localStorage.removeItem(`ciclovest_${formType}_draft`);
        }
    }
    return null;
}

function clearFormData(formType) {
    localStorage.removeItem(`ciclovest_${formType}_draft`);
}

// Salvar dados do formulário automaticamente
const autoSaveInputs = document.querySelectorAll('#register-form input, #login-form input');
autoSaveInputs.forEach(input => {
    input.addEventListener('input', debounce(() => {
        const form = input.closest('form');
        const formType = form.id.replace('-form', '');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Não salvar senhas por segurança
        if (data.senha) delete data.senha;
        
        saveFormData(formType, data);
    }, 1000));
});

// Carregar dados salvos ao inicializar
document.addEventListener('DOMContentLoaded', () => {
    // Carregar dados do formulário de cadastro
    const registerData = loadFormData('register');
    if (registerData) {
        const registerName = document.getElementById('register-name');
        const registerEmail = document.getElementById('register-email');
        
        if (registerName && registerData.nome) registerName.value = registerData.nome;
        if (registerEmail && registerData.email) registerEmail.value = registerData.email;
    }
    
    // Carregar dados do formulário de login
    const loginData = loadFormData('login');
    if (loginData) {
        const loginEmail = document.getElementById('login-email');
        if (loginEmail && loginData.email) loginEmail.value = loginData.email;
    }
});

// Limpar dados salvos após login/cadastro bem-sucedido
function clearAllSavedData() {
    clearFormData('login');
    clearFormData('register');
}

// Função debounce para otimizar performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Melhorias de acessibilidade
function setupAccessibility() {
    // Adicionar labels visuais para screen readers
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        if (!input.getAttribute('aria-label') && input.placeholder) {
            input.setAttribute('aria-label', input.placeholder);
        }
    });
    
    // Adicionar role e aria-live para mensagens
    if (messageDiv) {
        messageDiv.setAttribute('role', 'alert');
        messageDiv.setAttribute('aria-live', 'polite');
    }
    
    // Melhorar navegação por teclado
    const focusableElements = document.querySelectorAll(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    focusableElements.forEach((element, index) => {
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                // Lógica personalizada de navegação se necessário
            }
        });
    });
}

// Configurar acessibilidade quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', setupAccessibility);

// Monitorar mudanças de foco para melhor UX
document.addEventListener('focusin', (e) => {
    if (e.target.matches('input')) {
        e.target.parentElement?.classList.add('focused');
    }
});

document.addEventListener('focusout', (e) => {
    if (e.target.matches('input')) {
        e.target.parentElement?.classList.remove('focused');
    }
});

// Tratamento de erros globais
window.addEventListener('error', (e) => {
    console.error('Erro JavaScript:', e.error);
    showMessage('Ocorreu um erro inesperado. Recarregue a página.', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rejeitada:', e.reason);
    showMessage('Erro de conexão. Verifique sua internet.', 'error');
});

// Verificar compatibilidade do navegador
function checkBrowserCompatibility() {
    const requiredFeatures = [
        'fetch',
        'localStorage',
        'Promise',
        'addEventListener'
    ];
    
    const unsupportedFeatures = requiredFeatures.filter(feature => {
        return !(feature in window);
    });
    
    if (unsupportedFeatures.length > 0) {
        showMessage(
            'Seu navegador não suporta todas as funcionalidades necessárias. ' +
            'Por favor, atualize seu navegador.',
            'error'
        );
        return false;
    }
    
    return true;
}

// Verificar compatibilidade ao carregar
document.addEventListener('DOMContentLoaded', () => {
    if (!checkBrowserCompatibility()) {
        // Desabilitar funcionalidades se navegador não for compatível
        const buttons = document.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);
    }
});

// Exportar funções para uso global se necessário
window.CicloVestAuth = {
    showMessage,
    clearMessage,
    isValidEmail,
    checkAuthentication,
    clearAllSavedData
};

// Executar verificação de autenticação
checkAuthentication();

// Log para debug (remover em produção)
console.log('🔐 cicloVest Auth System carregado');
console.log('📱 Funcionalidades disponíveis:', Object.keys(window.CicloVestAuth || {}));
