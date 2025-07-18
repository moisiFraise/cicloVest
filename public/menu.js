// Menu Component JavaScript
class MenuComponent {
  constructor() {
    this.init();
  }

  init() {
    this.createMenuHTML();
    this.bindEvents();
    this.loadUserData();
    this.setActiveLink();
  }

  createMenuHTML() {
    const menuHTML = `
      <div class="menu-container">
        <nav class="menu-nav">
          <a href="/MainPage.html" class="menu-logo">
            <div class="menu-logo-icon">CV</div>
            <span>cicloVest</span>
          </a>
          
          <ul class="menu-links">
            <li><a href="/MainPage.html" class="menu-link" data-page="dashboard">Dashboard</a></li>
            <li><a href="/simulado.html" class="menu-link" data-page="simulados">Simulados</a></li>
            <li><a href="/redacao.html" class="menu-link" data-page="redacao">Redação</a></li>
            <li><a href="/questao.html" class="menu-link" data-page="questoes">Questões</a></li>
            <li><a href="/estudo.html" class="menu-link" data-page="estudos">Registrar Estudos</a></li>
            <li><a href="/calendario.html" class="menu-link" data-page="calendario">Calendário</a></li>
            <li><a href="/relatorios.html" class="menu-link" data-page="relatorios">Relatórios</a></li>
          </ul>
          
          <div class="menu-user">
            <div class="menu-user-info">
              <span class="menu-user-name" id="menu-user-name">Carregando...</span>
              <span class="menu-user-role">Estudante</span>
            </div>
            <div class="menu-user-avatar" id="menu-user-avatar" title="Menu do usuário">
              <span id="menu-user-initial">U</span>
            </div>
          </div>
          
          <div class="menu-toggle" id="menu-toggle">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </nav>
        
        <div class="menu-mobile" id="menu-mobile">
          <div class="menu-mobile-links">
            <a href="/MainPage.html" class="menu-link" data-page="dashboard">Dashboard</a>
            <a href="/simulado.html" class="menu-link" data-page="simulados">Simulados</a>
            <a href="/redacao.html" class="menu-link" data-page="redacao">Redação</a>
            <a href="/questao.html" class="menu-link" data-page="questoes">Questões</a>
            <a href="/estudo.html" class="menu-link" data-page="estudos">Registrar Estudos</a>
            <a href="/calendario.html" class="menu-link" data-page="calendario">Calendário</a>
            <a href="/relatorios.html" class="menu-link" data-page="relatorios">Relatórios</a>
          </div>
          
          <div class="menu-mobile-user">
            <div class="menu-user-avatar">
              <span id="menu-mobile-user-initial">U</span>
            </div>
            <div>
              <div class="menu-user-name" id="menu-mobile-user-name">Carregando...</div>
              <div class="menu-user-role">Estudante</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inserir o menu no início do body
    document.body.insertAdjacentHTML('afterbegin', menuHTML);
    
    // NÃO sobrescrever o padding-top se já existir no CSS
    if (!document.body.style.paddingTop) {
      document.body.style.paddingTop = '70px';
    }
  }

  bindEvents() {
    const menuToggle = document.getElementById('menu-toggle');
    const menuMobile = document.getElementById('menu-mobile');
    const userAvatar = document.getElementById('menu-user-avatar');

    // Toggle mobile menu
    menuToggle?.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      menuMobile.classList.toggle('active');
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!menuToggle?.contains(e.target) && !menuMobile?.contains(e.target)) {
        menuToggle?.classList.remove('active');
        menuMobile?.classList.remove('active');
      }
    });

    // User avatar click (future: dropdown menu)
    userAvatar?.addEventListener('click', () => {
      // TODO: Implementar dropdown do usuário
      console.log('User menu clicked');
    });

    // Adicionar event listeners para os links do menu
    this.bindMenuLinks();
  }

  bindMenuLinks() {
    const menuLinks = document.querySelectorAll('.menu-link');
    
    menuLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        const page = link.getAttribute('data-page');
        
        console.log(`Clicou no link: ${href} (página: ${page})`);
        
        // Verificar se o usuário está autenticado antes de navegar para páginas protegidas
        const token = localStorage.getItem('token');
        const protectedPages = ['dashboard', 'simulados', 'redacao', 'estudos', 'relatorios'];
        
        if (protectedPages.includes(page) && !token) {
          e.preventDefault();
          console.log('Usuário não autenticado, redirecionando para login');
          this.redirectToLogin();
          return;
        }
        
        // Se chegou até aqui, o usuário está autenticado
        console.log(`Navegando para: ${href}`);
        
        // Fechar menu mobile se estiver aberto
        const menuToggle = document.getElementById('menu-toggle');
        const menuMobile = document.getElementById('menu-mobile');
        
        if (menuToggle?.classList.contains('active')) {
          menuToggle.classList.remove('active');
          menuMobile?.classList.remove('active');
        }
        
        // Para páginas específicas, garantir navegação correta
        if (page === 'simulados') {
          e.preventDefault();
          console.log('Navegando para simulados...');
          window.location.href = '/simulado.html';
          return;
        }
        
        if (page === 'estudos') {
          e.preventDefault();
          console.log('Navegando para estudos...');
          window.location.href = '/estudo.html';
          return;
        }
        
        if (page === 'redacao') {
          e.preventDefault();
          console.log('Navegando para redação...');
          window.location.href = '/redacao.html';
          return;
        }
        
        if (page === 'relatorios') {
          e.preventDefault();
          console.log('Navegando para relatórios...');
          window.location.href = '/relatorios.html';
          return;
        }
        
        if (page === 'dashboard') {
          e.preventDefault();
          console.log('Navegando para dashboard...');
          window.location.href = '/MainPage.html';
          return;
        }
        
        // Para outras páginas, permitir navegação normal
        // Não prevenir o comportamento padrão aqui para outras páginas
      });
    });
  }

  async loadUserData() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Se não há token e estamos em uma página protegida, redirecionar
        const currentPath = window.location.pathname;
        const protectedPaths = ['/MainPage.html', '/simulado.html', '/redacao.html', '/estudo.html', '/relatorios.html'];
        
        if (protectedPaths.includes(currentPath)) {
          console.log('Usuário não autenticado em página protegida, redirecionando para login');
          this.redirectToLogin();
        }
        return;
      }

      const response = await fetch('/api/perfil', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        this.updateUserDisplay(userData);
        console.log('Dados do usuário carregados com sucesso');
      } else {
        console.log('Token inválido, redirecionando para login');
        this.redirectToLogin();
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      // Só redirecionar se estivermos em uma página protegida
      const currentPath = window.location.pathname;
      const protectedPaths = ['/MainPage.html', '/simulado.html', '/redacao.html', '/estudo.html', '/relatorios.html'];
      
      if (protectedPaths.includes(currentPath)) {
        this.redirectToLogin();
      }
    }
  }

  updateUserDisplay(userData) {
    const userName = userData.nome || 'Usuário';
    const userInitial = userName.charAt(0).toUpperCase();

    // Desktop
    const menuUserName = document.getElementById('menu-user-name');
    const menuUserInitial = document.getElementById('menu-user-initial');
    
    // Mobile
    const menuMobileUserName = document.getElementById('menu-mobile-user-name');
    const menuMobileUserInitial = document.getElementById('menu-mobile-user-initial');

    if (menuUserName) menuUserName.textContent = userName;
    if (menuUserInitial) menuUserInitial.textContent = userInitial;
    if (menuMobileUserName) menuMobileUserName.textContent = userName;
    if (menuMobileUserInitial) menuMobileUserInitial.textContent = userInitial;
  }

  setActiveLink() {
    const currentPage = window.location.pathname;
    const menuLinks = document.querySelectorAll('.menu-link');
    
    console.log('Página atual:', currentPage);
    
    menuLinks.forEach(link => {
      link.classList.remove('active');
      const linkHref = link.getAttribute('href');
      
      // Verificar correspondência exata
      if (linkHref === currentPage) {
        link.classList.add('active');
        console.log('Link ativo encontrado:', linkHref);
        return;
      }
      
      // Verificar correspondência por data-page
      const dataPage = link.getAttribute('data-page');
      
      // Mapear páginas para seus caminhos
      const pageMap = {
        'dashboard': ['/MainPage.html', '/'],
        'simulados': ['/simulado.html'],
        'redacao': ['/redacao.html'],
        'questoes': ['/questao.html'],
        'estudos': ['/estudo.html'],
        'relatorios': ['/relatorios.html']
      };
      
      if (pageMap[dataPage] && pageMap[dataPage].includes(currentPage)) {
        link.classList.add('active');
        console.log('Link ativo por mapeamento:', dataPage, currentPage);
      }
    });

    // Set dashboard as active for root path
    if (currentPage === '/' || currentPage === '/MainPage.html') {
      const dashboardLinks = document.querySelectorAll('[data-page="dashboard"]');
      dashboardLinks.forEach(link => {
        link.classList.add('active');
        console.log('Dashboard ativo para:', currentPage);
      });
    }

    // Set simulados as active for simulado.html
    if (currentPage === '/simulado.html') {
      const simuladosLinks = document.querySelectorAll('[data-page="simulados"]');
      simuladosLinks.forEach(link => {
        link.classList.add('active');
        console.log('Simulados ativo para:', currentPage);
      });
    }

    // Set estudos as active for estudo.html
    if (currentPage === '/estudo.html') {
      const estudosLinks = document.querySelectorAll('[data-page="estudos"]');
      estudosLinks.forEach(link => {
        link.classList.add('active');
        console.log('Estudos ativo para:', currentPage);
      });
    }

    // Set redacao as active for redacao.html
    if (currentPage === '/redacao.html') {
      const redacaoLinks = document.querySelectorAll('[data-page="redacao"]');
      redacaoLinks.forEach(link => {
        link.classList.add('active');
        console.log('Redação ativo para:', currentPage);
      });
    }

    // Set questoes as active for questao.html
    if (currentPage === '/questao.html') {
      const questoesLinks = document.querySelectorAll('[data-page="questoes"]');
      questoesLinks.forEach(link => {
        link.classList.add('active');
        console.log('Questões ativo para:', currentPage);
      });
    }

    // Set relatorios as active for relatorios.html
    if (currentPage === '/relatorios.html') {
      const relatoriosLinks = document.querySelectorAll('[data-page="relatorios"]');
      relatoriosLinks.forEach(link => {
        link.classList.add('active');
        console.log('Relatórios ativo para:', currentPage);
      });
    }
  }

  redirectToLogin() {
    console.log('Redirecionando para login...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }
}

// Initialize menu when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Inicializando MenuComponent...');
  new MenuComponent();
});

// Export for use in other files
window.MenuComponent = MenuComponent;
