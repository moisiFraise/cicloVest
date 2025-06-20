// Elementos DOM
const loginToggle = document.getElementById('login-toggle');
const registerToggle = document.getElementById('register-toggle');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const userArea = document.getElementById('user-area');
const messageDiv = document.getElementById('message');

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
    clearMessage();
}

function showRegister() {
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
    registerToggle.classList.add('active');
    loginToggle.classList.remove('active');
    clearMessage();
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        showUserArea();
        loadUserProfile();
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const senha = document.getElementById('register-password').value;

    if (!nome || !email || !senha) {
        showMessage('Todos os campos são obrigatórios', 'error');
        return;
    }

    if (senha.length < 6) {
        showMessage('Senha deve ter pelo menos 6 caracteres', 'error');
        return;
    }

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
            showMessage('Cadastro realizado com sucesso!', 'success');
            setTimeout(() => {
                showUserArea();
                loadUserProfile();
            }, 1500);
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        console.error('Erro no cadastro:', error);
        showMessage('Erro ao conectar com servidor', 'error');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-password').value;

    if (!email || !senha) {
        showMessage('Email e senha são obrigatórios', 'error');
        return;
    }

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
            showMessage('Login realizado com sucesso!', 'success');
            setTimeout(() => {
                showUserArea();
                loadUserProfile();
            }, 1500);
        } else {
            showMessage(data.error, 'error');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showMessage('Erro ao conectar com servidor', 'error');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showLoginForm();
    clearForms();
    showMessage('Logout realizado com sucesso!', 'success');
});

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
    const createdDate = new Date(user.created_at).toLocaleDateString('pt-BR');
    
    userInfo.innerHTML = `
        <div class="user-profile">
            <h3>👤 ${user.nome}</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>ID:</strong> ${user.id}</p>
            <p><strong>Membro desde:</strong> ${createdDate}</p>
        </div>
    `;
}

function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
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
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    
    document.getElementById('register-name').value = '';
    document.getElementById('register-email').value = '';
    document.getElementById('register-password').value = '';
}

setInterval(() => {
    const token = localStorage.getItem('token');
    if (token && userArea.style.display !== 'none') {
        loadUserProfile();
    }
}, 5 * 60 * 1000); // 5 minutos

async function testDatabase() {
    try {
        const response = await fetch('/api/test-db');
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Conexão com banco OK:', data.message);
            return true;
        } else {
            console.error('❌ Erro na conexão com banco:', data.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Erro ao testar banco:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    testDatabase();
});
async function setupDatabase() {
    try {
        const response = await fetch('/api/setup-db', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Setup do banco realizado:', data.message);
            showMessage('Banco de dados configurado com sucesso!', 'success');
        } else {
            console.error('❌ Erro no setup do banco:', data.error);
            showMessage('Erro ao configurar banco de dados', 'error');
        }
    } catch (error) {
        console.error('❌ Erro no setup:', error);
        showMessage('Erro ao conectar com servidor', 'error');
    }
}

if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.addEventListener('DOMContentLoaded', () => {
        const setupBtn = document.createElement('button');
        setupBtn.textContent = 'Setup DB (Dev)';
        setupBtn.className = 'btn-secondary';
        setupBtn.style.position = 'fixed';
        setupBtn.style.bottom = '10px';
        setupBtn.style.right = '10px';
        setupBtn.style.zIndex = '1000';
        setupBtn.onclick = setupDatabase;
        document.body.appendChild(setupBtn);
    });
}
