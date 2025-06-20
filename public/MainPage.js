// MainPage Dashboard JavaScript
class Dashboard {
  constructor() {
    this.charts = {};
    this.init();
  }

  init() {
    this.checkAuthentication();
    this.updateCurrentDate();
    this.initializeCharts();
    this.bindEvents();
    this.animateCounters();
  }

  checkAuthentication() {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/';
      return;
    }
  }

  updateCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (dateElement) {
      const now = new Date();
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      dateElement.textContent = now.toLocaleDateString('pt-BR', options);
    }
  }

  initializeCharts() {
    this.createProgressChart();
    this.createSubjectsChart();
  }

  createProgressChart() {
    const ctx = document.getElementById('progressChart');
    if (!ctx) return;

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(203, 166, 247, 0.3)');
    gradient.addColorStop(1, 'rgba(203, 166, 247, 0.05)');

    this.charts.progress = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
        datasets: [{
          label: 'Acertos (%)',
          data: [65, 72, 68, 78, 82, 75, 85],
          borderColor: '#cba6f7',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#cba6f7',
          pointBorderColor: '#1e1e2e',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8
        }, {
          label: 'Meta (%)',
          data: [70, 70, 70, 70, 70, 70, 70],
          borderColor: '#94e2d5',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#cdd6f4',
              font: {
                family: 'Inter',
                size: 12
              },
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: 'rgba(30, 30, 46, 0.9)',
            titleColor: '#cdd6f4',
            bodyColor: '#bac2de',
            borderColor: '#45475a',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: true
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(69, 71, 90, 0.3)',
              drawBorder: false
            },
            ticks: {
              color: '#9399b2',
              font: {
                family: 'Inter',
                size: 11
              }
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              color: 'rgba(69, 71, 90, 0.3)',
              drawBorder: false
            },
            ticks: {
              color: '#9399b2',
              font: {
                family: 'Inter',
                size: 11
              },
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        elements: {
          point: {
            hoverBackgroundColor: '#cba6f7'
          }
        }
      }
    });
  }

  createSubjectsChart() {
    const ctx = document.getElementById('subjectsChart');
    if (!ctx) return;

    this.charts.subjects = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Matemática', 'Português', 'Física', 'Química', 'História', 'Geografia'],
        datasets: [{
          data: [92, 78, 87, 84, 65, 68],
          backgroundColor: [
            '#a6e3a1',
            '#89b4fa',
            '#cba6f7',
            '#94e2d5',
            '#f9e2af',
            '#fab387'
          ],
          borderColor: '#1e1e2e',
          borderWidth: 2,
          hoverBorderWidth: 3,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right',
            labels: {
              color: '#cdd6f4',
              font: {
                family: 'Inter',
                size: 11
              },
              usePointStyle: true,
              padding: 15,
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map((label, i) => {
                    const value = data.datasets[0].data[i];
                    return {
                      text: `${label}: ${value}%`,
                      fillStyle: data.datasets[0].backgroundColor[i],
                      strokeStyle: data.datasets[0].borderColor,
                      lineWidth: data.datasets[0].borderWidth,
                      pointStyle: 'circle',
                      hidden: false,
                      index: i
                    };
                  });
                }
                return [];
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(30, 30, 46, 0.9)',
            titleColor: '#cdd6f4',
            bodyColor: '#bac2de',
            borderColor: '#45475a',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.parsed}%`;
              }
            }
          }
        },
        cutout: '60%',
        radius: '90%'
      }
    });
  }

  bindEvents() {
    // Chart period buttons
    const chartButtons = document.querySelectorAll('.chart-btn');
    chartButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        chartButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        const period = e.target.dataset.period;
        this.updateProgressChart(period);
      });
    });

    // Refresh data every 5 minutes
    setInterval(() => {
      this.refreshData();
    }, 300000);
  }

  updateProgressChart(period) {
    if (!this.charts.progress) return;

    let newData, newLabels;
    
    switch(period) {
      case '7':
        newLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
        newData = [65, 72, 68, 78, 82, 75, 85];
        break;
      case '30':
        newLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
        newData = [70, 75, 78, 82];
        break;
      case '90':
        newLabels = ['Mês 1', 'Mês 2', 'Mês 3'];
        newData = [68, 75, 82];
        break;
      default:
        return;
    }

    this.charts.progress.data.labels = newLabels;
    this.charts.progress.data.datasets[0].data = newData;
    this.charts.progress.data.datasets[1].data = new Array(newLabels.length).fill(70);
    this.charts.progress.update('active');
  }

  animateCounters() {
    const counters = document.querySelectorAll('.stat-value');
    
    const animateCounter = (element) => {
      const target = parseFloat(element.textContent);
      const isPercentage = element.textContent.includes('%');
      const duration = 2000;
      const step = target / (duration / 16);
      let current = 0;

      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        
        if (isPercentage) {
          element.textContent = current.toFixed(1) + '%';
        } else {
          element.textContent = Math.floor(current);
        }
      }, 16);
    };

    // Intersection Observer para animar quando visível
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    });

    counters.forEach(counter => {
      observer.observe(counter);
    });
  }

  async refreshData() {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Simular atualização de dados
      console.log('Atualizando dados do dashboard...');
      
      // Aqui você faria uma requisição real para a API
      // const response = await fetch('/api/dashboard-data', {
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
      
      // Por enquanto, apenas log
      this.updateLastRefresh();
      
    } catch (error) {
      console.error('Erro ao atualizar dados:', error);
    }
  }

  updateLastRefresh() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    // Adicionar indicador de última atualização se necessário
    console.log(`Dados atualizados às ${timeString}`);
  }

  // Método para exportar dados (futuro)
  exportData(format = 'pdf') {
    console.log(`Exportando dados em formato ${format}...`);
    // Implementar exportação
  }

  // Método para configurar notificações (futuro)
  setupNotifications() {
    if ('Notification' in window && Notification.permission === 'granted') {
      // Configurar notificações de metas, lembretes, etc.
    }
  }
}

// Utility functions
const utils = {
  formatNumber: (num) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  },
  
  formatPercentage: (num) => {
    return `${num.toFixed(1)}%`;
  },
  
  getGradeColor: (grade) => {
    if (grade >= 80) return '#a6e3a1'; // green
    if (grade >= 70) return '#f9e2af'; // yellow
    if (grade >= 60) return '#fab387'; // peach
    return '#f38ba8'; // red
  },
  
  debounce: (func, wait) => {
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
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // Página ficou visível, atualizar dados se necessário
    const dashboard = new Dashboard();
    dashboard.refreshData();
  }
});

// Handle online/offline status
window.addEventListener('online', () => {
  console.log('Conexão restaurada');
  // Sincronizar dados quando voltar online
});

window.addEventListener('offline', () => {
  console.log('Conexão perdida');
  // Mostrar indicador offline
});

// Export for global access
window.Dashboard = Dashboard;
window.DashboardUtils = utils;
