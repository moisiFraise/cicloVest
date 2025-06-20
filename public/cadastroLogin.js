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
        showUserArea();
        loadUserProfile();
    }
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
            showMessage('Cadastro realizado com sucesso! 🎉', 'success');
            setTimeout(() => {
                showUserArea();
                loadUserProfile();
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
            showMessage('Login realizado com sucesso! 🎉', 'success');
            setTimeout(() => {
                showUserArea();
                loadUserProfile();
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

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showLoginForm();
    clearForms();
    showMessage('Logout realizado com sucesso! 👋', 'success');
});

// Funções auxiliares
function showUserArea() {
    document.querySelector('.form-container').style.display = 'none';
    userArea.style.display = 'block';
}

function showLoginForm() {
    document.querySelector('.form-container').style.display = 'block';
    userArea.style.display = 'none';
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
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Auto-hide após 5 segundos
    setTimeout(() => {
        clearMessage();
    }, 5000);
}

function clearMessage() {
    messageDiv.style.display = 'none';
    messageDiv.className = 'message';
    messageDiv.textContent = '';
}

function clearForms() {
    // Limpar formulário de login
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    // Limpar formulário de cadastro
    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
}

function setLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.classList.add('loading');
        button.setAttribute('aria-busy', 'true');
    } else {
        button.disabled = false;
        button.classList.remove('loading');
        button.setAttribute('aria-busy', 'false');
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
    if (token && userArea.style.display !== 'none') {
        loadUserProfile();
    }
}, 5 * 60 * 1000); // 5 minutos

// Validação em tempo real
document.getElementById('register-email').addEventListener('input', function(e) {
    const email = e.target.value;
    if (email && !isValidEmail(email)) {
        e.target.setCustomValidity('Por favor, insira um email válido');
    } else {
        e.target.setCustomValidity('');
    }
});

document.getElementById('login-email').addEventListener('input', function(e) {
    const email = e.target.value;
    if (email && !isValidEmail(email)) {
        e.target.setCustomValidity('Por favor, insira um email válido');
    } else {
        e.target.setCustomValidity('');
    }
});

document.getElementById('register-password').addEventListener('input', function(e) {
    const password = e.target.value;
    if (password && password.length < 6) {
        e.target.setCustomValidity('Senha deve ter pelo menos 6 caracteres');
    } else {
        e.target.setCustomValidity('');
    }
});

document.getElementById('register-name').addEventListener('input', function(e) {
    const name = e.target.value.trim();
    if (name && name.length < 2) {
        e.target.setCustomValidity('Nome deve ter pelo menos 2 caracteres');
    } else {
        e.target.setCustomValidity('');
    }
});

// Navegação por teclado
document.addEventListener('keydown', function(e) {
    // Alt + L para ir para login
    if (e.altKey && e.key === 'l') {
        e.preventDefault();
        showLogin();
        document.getElementById('login-email').focus();
    }
    
    // Alt + R para ir para cadastro
    if (e.altKey && e.key === 'r') {
        e.preventDefault();
        showRegister();
        document.getElementById('register-name').focus();
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
    container.style.opacity = '0';
    container.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        container.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 100);
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

