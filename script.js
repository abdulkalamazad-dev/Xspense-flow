const API_KEY = '93fb63127cfdb6598f09225e'; 
const BASE_API_URL = 'https://v6.exchangerate-api.com/v6';

let state = {   //managing the state
    expenses: [],
    exchangeRates: {},
    baseCurrency: 'USD',
    budgets: {},
    categories: {
        food: 'Food & Dining',
        transport: 'Transportation',
        utilities: 'Utilities',
        entertainment: 'Entertainment',
        shopping: 'Shopping',
        health: 'Healthcare',
        travel: 'Travel',
        other: 'Other'
    }
};

// DOM Elements
const elements = {
    expenseForm: document.getElementById('expenseForm'),
    expenseList: document.getElementById('expenseList'),
    baseCurrency: document.getElementById('baseCurrency'),
    updateRatesBtn: document.getElementById('updateRates'),
    totalBalance: document.getElementById('totalBalance'),
    totalIncome: document.getElementById('totalIncome'),
    totalExpenses: document.getElementById('totalExpenses'),
    transactionType: document.getElementById('transactionType'),
    description: document.getElementById('description'),
    amount: document.getElementById('amount'),
    category: document.getElementById('category'),
    date: document.getElementById('date')
};

// Initializing our chart.js
let expenseChart = null;

// Utility Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: state.baseCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showNotification(message, type = 'info') {
    // Creating notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Adding notification to DOM
    document.body.appendChild(notification);

    // Removing notification after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Analytics 
const analytics = {
    getMonthlyTrends() {
        const monthlyData = {};
        
        state.expenses.forEach(transaction => {
            const month = transaction.date.substring(0, 7);
            if (!monthlyData[month]) {
                monthlyData[month] = {
                    income: 0,
                    expenses: 0,
                    savings: 0,
                    categories: {}
                };
            }
            
            const amount = convertAmount(transaction.amount, transaction.currency);
            if (transaction.type === 'income') {
                monthlyData[month].income += amount;
            } else {
                monthlyData[month].expenses += amount;
                monthlyData[month].categories[transaction.category] = 
                    (monthlyData[month].categories[transaction.category] || 0) + amount;
            }
            monthlyData[month].savings = monthlyData[month].income - monthlyData[month].expenses;
        });
        
        return monthlyData;
    },

    analyzeSpendingPatterns() {
        const patterns = {
            highestSpendingDay: null,
            lowestSpendingDay: null,
            averageDailySpending: 0,
            mostFrequentCategory: null,
            categoryTotals: {}
        };

        const dailyTotals = {};
        const categoryFrequency = {};
        let totalSpending = 0;
        let daysWithTransactions = 0;

        const expenses = state.expenses.filter(t => t.type === 'expense');

        expenses.forEach(transaction => {
            if (!dailyTotals[transaction.date]) {
                dailyTotals[transaction.date] = 0;
                daysWithTransactions++;
            }
            const amount = convertAmount(transaction.amount, transaction.currency);
            dailyTotals[transaction.date] += amount;
            
            categoryFrequency[transaction.category] = 
                (categoryFrequency[transaction.category] || 0) + 1;
            patterns.categoryTotals[transaction.category] = 
                (patterns.categoryTotals[transaction.category] || 0) + amount;
            
            totalSpending += amount;
        });

        const sortedDays = Object.entries(dailyTotals).sort((a, b) => b[1] - a[1]);
        if (sortedDays.length > 0) {
            patterns.highestSpendingDay = {
                date: sortedDays[0][0],
                amount: sortedDays[0][1]
            };
            patterns.lowestSpendingDay = {
                date: sortedDays[sortedDays.length - 1][0],
                amount: sortedDays[sortedDays.length - 1][1]
            };
        }

        patterns.averageDailySpending = daysWithTransactions > 0 ? 
            totalSpending / daysWithTransactions : 0;
        patterns.mostFrequentCategory = Object.entries(categoryFrequency)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

        return patterns;
    },

    getCategoryInsights() {
        const patterns = this.analyzeSpendingPatterns();
        const insights = [];

        Object.entries(patterns.categoryTotals).forEach(([category, total]) => {
            const percentage = (total / Object.values(patterns.categoryTotals)
                .reduce((a, b) => a + b, 0) * 100).toFixed(1);
            insights.push({
                category,
                total,
                percentage,
                isHighest: category === patterns.mostFrequentCategory
            });
        });

        return insights.sort((a, b) => b.total - a.total);
    }
};

// Budget Management
const budgetManager = {
    setBudget(category, limit) {
        state.budgets[category] = limit;
        saveState();
        this.checkBudgets();
    },

    getBudget(category) {
        return state.budgets[category] || 0;
    },

    checkBudgets() {
        const currentDate = new Date();
        const currentMonth = currentDate.toISOString().substring(0, 7);
        
        const monthlySpending = state.expenses
            .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth))
            .reduce((acc, transaction) => {
                const amount = convertAmount(transaction.amount, transaction.currency);
                acc[transaction.category] = (acc[transaction.category] || 0) + amount;
                return acc;
            }, {});

        Object.entries(state.budgets).forEach(([category, limit]) => {
            const spent = monthlySpending[category] || 0;
            if (spent >= limit * 0.9) {
                this.showBudgetAlert(category, spent, limit);
            }
        });
    },

    showBudgetAlert(category, spent, limit) {
        const percentage = ((spent / limit) * 100).toFixed(1);
        showNotification(
            `Budget Alert: You've spent ${percentage}% of your ${state.categories[category]} budget!`,
            'warning'
        );
    }
};

// Data Export
const exportManager = {
    exportData(format = 'csv') {
        const data = state.expenses.map(transaction => ({
            date: transaction.date,
            type: transaction.type,
            description: transaction.description,
            amount: convertAmount(transaction.amount, transaction.currency),
            category: state.categories[transaction.category],
            currency: state.baseCurrency
        }));

        if (data.length === 0) {
            showNotification('No transactions to export!', 'warning');
            return;
        }    

        if (format === 'csv') {
            const csv = this.convertToCSV(data);
            this.downloadFile(csv, 'transactions.csv', 'text/csv');
        } else if (format === 'json') {
            const json = JSON.stringify(data, null, 2);
            this.downloadFile(json, 'transactions.json', 'application/json');
        }
    },

    convertToCSV(data) {
        if (!data || data.length === 0) {
            return ''; // Return empty CSV instead of breaking
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => 
                    JSON.stringify(row[header] ?? '')
                ).join(',')
            )
        ];
        return csvRows.join('\n');
    },

    downloadFile(content, fileName, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
};

// Event Listeners
document.addEventListener('DOMContentLoaded', initialize);
elements.expenseForm.addEventListener('submit', handleTransactionSubmit);
elements.updateRatesBtn.addEventListener('click', fetchExchangeRates);
elements.baseCurrency.addEventListener('change', handleCurrencyChange);

window.deleteTransaction = deleteTransaction;

// Core Functions
async function initialize() {
    loadInitialState();
    await fetchExchangeRates();
    updateUI();
    setTodayAsDefaultDate();
    setupExportButtons();
    budgetManager.checkBudgets();
}


function setupExportButtons() {
    const headerContent = document.createElement('div');
    headerContent.className = 'header-content';
    headerContent.innerHTML = `
        <div class="header-left">
            <div class="currency-control">
                <div class="control-label">
                    <i class="fas fa-globe"></i>
                    <span>Base Currency</span>
                </div>
                <div class="currency-selector">
                    <select id="baseCurrency">
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="JPY">JPY - Japanese Yen</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                        <option value="INR">INR - Indian Rupee</option>
                    </select>
                </div>
            </div>
        </div>
        <div class="header-right">
            <div class="button-group primary-actions">
                <button id="updateRates" class="btn-action btn-primary">
                    <i class="fas fa-sync-alt"></i>
                    <span>Update Rates</span>
                </button>
            </div>
            <div class="button-group export-actions">
                <button id="exportCSV" class="btn-action btn-secondary">
                    <i class="fas fa-file-csv"></i>
                    <span>Export CSV</span>
                </button>
                <button id="exportJSON" class="btn-action btn-secondary">
                    <i class="fas fa-file-code"></i>
                    <span>Export JSON</span>
                </button>
            </div>
            <div class="button-group danger-actions">
                <button onclick="deleteAllTransactions()" class="btn-action btn-danger">
                    <i class="fas fa-trash-alt"></i>
                    <span>Delete All</span>
                </button>
            </div>
        </div>
    `;
    
    const header = document.querySelector('.header');
    header.innerHTML = ''; 
    header.appendChild(headerContent);
    
    document.getElementById('updateRates').addEventListener('click', fetchExchangeRates);
    document.getElementById('baseCurrency').addEventListener('change', handleCurrencyChange);
    document.getElementById('exportCSV').addEventListener('click', () => exportManager.exportData('csv'));
    document.getElementById('exportJSON').addEventListener('click', () => exportManager.exportData('json'));
}

function handleCurrencyChange(e) {
    const newCurrency = e.target.value;
    
    state.baseCurrency = newCurrency;
    
    fetchExchangeRates()
        .then(() => {
            updateUI();
            saveState();
            showNotification(`Base currency changed to ${newCurrency}`, 'success');
        })
        .catch(error => {
            console.error('Currency change error:', error);
            showNotification('Failed to update currency. Please try again.', 'error');
        });
}

async function fetchExchangeRates() {
    try {
        const updateButton = document.getElementById('updateRates');
        updateButton.disabled = true;
        updateButton.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Updating...';

        const response = await fetch(`${BASE_API_URL}/${API_KEY}/latest/${state.baseCurrency}`);
        if (!response.ok) throw new Error('Failed to fetch exchange rates');

        const data = await response.json();
        state.exchangeRates = data.conversion_rates;
        saveState();

        showNotification('Exchange rates updated successfully!', 'success');
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        showNotification('Failed to update exchange rates. Please try again.', 'error');
    } finally {
        const updateButton = document.getElementById('updateRates');
        updateButton.disabled = false;
        updateButton.innerHTML = '<i class="fas fa-sync-alt"></i> Update Rates';
    }
}

 
function loadInitialState() {
    const savedState = localStorage.getItem('expenseTrackerState');
    if (savedState) {
        state = { ...state, ...JSON.parse(savedState) };
    }
    elements.baseCurrency.value = state.baseCurrency;
}

function saveState() {
    localStorage.setItem('expenseTrackerState', JSON.stringify(state));
}

function setTodayAsDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    elements.date.value = today;
}

async function fetchExchangeRates() {
    try {
        elements.updateRatesBtn.disabled = true;
        elements.updateRatesBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Updating...';

        const response = await fetch(`${BASE_API_URL}/${API_KEY}/latest/${state.baseCurrency}`);
        if (!response.ok) throw new Error('Failed to fetch exchange rates');

        const data = await response.json();
        state.exchangeRates = data.conversion_rates;
        saveState();

        showNotification('Exchange rates updated successfully!', 'success');
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        showNotification('Failed to update exchange rates. Please try again.', 'error');
    } finally {
        elements.updateRatesBtn.disabled = false;
        elements.updateRatesBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update Rates';
    }
}

function handleTransactionSubmit(e) {
    e.preventDefault();

    const transaction = {
        id: Date.now(),
        type: elements.transactionType.value,
        description: elements.description.value,
        amount: parseFloat(elements.amount.value),
        category: elements.category.value,
        date: elements.date.value,
        currency: state.baseCurrency
    };

    state.expenses.push(transaction);
    saveState();
    updateUI(); 
    budgetManager.checkBudgets();
    showNotification('Transaction added successfully!', 'success');
    elements.expenseForm.reset();
    setTodayAsDefaultDate();
}

function deleteTransaction(id) {
    if (confirm('Are you sure you want to delete this transaction?')) {
        state.expenses = state.expenses.filter(expense => expense.id !== id);
        saveState();
        updateUI(); 
        showNotification('Transaction deleted successfully!', 'success');
    }
}
function handleCurrencyChange(e) {
    state.baseCurrency = e.target.value;
    saveState();
    fetchExchangeRates();
    updateUI();
}

function convertAmount(amount, fromCurrency) {
    if (!state.exchangeRates || fromCurrency === state.baseCurrency) return amount;
    const rate = state.exchangeRates[fromCurrency] / state.exchangeRates[state.baseCurrency];
    return amount / rate;
}

// UI Updates
function updateUI() {
    updateTotals();
    renderTransactionList();
    updateChart();
    renderInsights();
}

function updateTotals() {
    const totals = state.expenses.reduce((acc, transaction) => {
        const amount = convertAmount(transaction.amount, transaction.currency);
        if (transaction.type === 'income') {
            acc.income += amount;
        } else {
            acc.expenses += amount;
        }
        return acc;
    }, { income: 0, expenses: 0 });

    elements.totalIncome.textContent = formatCurrency(totals.income);
    elements.totalExpenses.textContent = formatCurrency(totals.expenses);
    elements.totalBalance.textContent = formatCurrency(totals.income - totals.expenses);
}

function renderTransactionList() {
    elements.expenseList.innerHTML = '';
    
    const sortedTransactions = [...state.expenses]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);

    sortedTransactions.forEach(transaction => {
        const amount = convertAmount(transaction.amount, transaction.currency);
        
        const transactionEl = document.createElement('div');
        transactionEl.className = 'transaction-item';
        transactionEl.innerHTML = `
            <div class="transaction-info">
                <span class="transaction-title">${transaction.description}</span>
                <span class="transaction-category">
                    ${state.categories[transaction.category]} • ${formatDate(transaction.date)}
                </span>
            </div>
            <div class="transaction-details">
                <span class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'income' ? '+' : '-'} ${formatCurrency(amount)}
                </span>
                <button onclick="deleteTransaction(${transaction.id})" class="delete-btn">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        elements.expenseList.appendChild(transactionEl);
    });
}

function updateChart() {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    // Get monthly expense data for current year
    const monthlyExpenses = {};
    const monthlyIncome = {};
    const currentDate = new Date();
    
    for (let i = 0; i < 12; i++) {
        const date = new Date(currentDate.getFullYear(), i, 1);
        const monthKey = date.toISOString().substring(0, 7);
        monthlyExpenses[monthKey] = 0;
        monthlyIncome[monthKey] = 0;
    }
    
    state.expenses.forEach(transaction => {
        const monthKey = transaction.date.substring(0, 7);
        if (monthlyExpenses.hasOwnProperty(monthKey)) {
            const amount = convertAmount(transaction.amount, transaction.currency);
            if (transaction.type === 'expense') {
                monthlyExpenses[monthKey] += amount;
            } else {
                monthlyIncome[monthKey] += amount;
            }
        }
    });
    
    const data = {
        labels: Object.keys(monthlyExpenses).map(month => {
            const [year, monthNum] = month.split('-');
            return new Date(year, monthNum - 1).toLocaleString('default', { month: 'short' });
        }),
        datasets: [
            {
                label: 'Expenses',
                data: Object.values(monthlyExpenses),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Income',
                data: Object.values(monthlyIncome),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                fill: true
            }
        ]
    };

    if (expenseChart) {
        expenseChart.destroy();
    }

    expenseChart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function renderInsights() {
    const insights = analytics.getCategoryInsights();
    const trendsData = analytics.getMonthlyTrends();
    
    let insightsContainer = document.querySelector('.insights-container');
    if (!insightsContainer) {
        insightsContainer = document.createElement('div');
        insightsContainer.className = 'insights-container';
        document.querySelector('.main-content').appendChild(insightsContainer);
    }

    const currentMonth = new Date().toISOString().substring(0, 7);
    const currentMonthData = trendsData[currentMonth] || {
        income: 0,
        expenses: 0,
        savings: 0
    };

    const previousMonth = new Date(currentMonth);
    previousMonth.setMonth(previousMonth.getMonth() - 1);
    const previousMonthKey = previousMonth.toISOString().substring(0, 7);
    const previousMonthData = trendsData[previousMonthKey] || {
        income: 0,
        expenses: 0,
        savings: 0
    };

    const calculateChange = (current, previous) => {
        if (previous === 0) return 100;
        return ((current - previous) / previous * 100).toFixed(1);
    };

    insightsContainer.innerHTML = `
        <div class="card insights-card">
            <div class="card-header">
                <h3>Financial Insights</h3>
            </div>
            <div class="insights-grid">
                <div class="insight-item">
                    <h4>Monthly Overview</h4>
                    <p>Income: ${formatCurrency(currentMonthData.income)}
                        <span class="change ${calculateChange(currentMonthData.income, previousMonthData.income) > 0 ? 'positive' : 'negative'}">
                            (${calculateChange(currentMonthData.income, previousMonthData.income)}%)
                        </span>
                    </p>
                    <p>Expenses: ${formatCurrency(currentMonthData.expenses)}
                        <span class="change ${calculateChange(currentMonthData.expenses, previousMonthData.expenses) < 0 ? 'positive' : 'negative'}">
                            (${calculateChange(currentMonthData.expenses, previousMonthData.expenses)}%)
                        </span>
                    </p>
                    <p>Savings: ${formatCurrency(currentMonthData.savings)}
                        <span class="change ${calculateChange(currentMonthData.savings, previousMonthData.savings) > 0 ? 'positive' : 'negative'}">
                            (${calculateChange(currentMonthData.savings, previousMonthData.savings)}%)
                        </span>
                    </p>
                </div>
                <div class="insight-item">
                    <h4>Top Spending Categories</h4>
                    ${insights.slice(0, 3).map(insight => `
                        <p>${state.categories[insight.category]}: ${formatCurrency(insight.total)}
                            <span class="percentage">(${insight.percentage}%)</span>
                        </p>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    if (!document.querySelector('#insights-styles')) {
        const styles = document.createElement('style');
        styles.id = 'insights-styles';
        styles.textContent = `
            .insights-container {
                margin-top: 2rem;
            }
            .insights-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                padding: 1rem;
            }
            .insight-item {
                padding: 1rem;
                background-color: var(--background-color);
                border-radius: 0.5rem;
            }
            .insight-item h4 {
                margin-bottom: 1rem;
                color: var(--text-primary);
                font-weight: 600;
            }
            .insight-item p {
                margin-bottom: 0.5rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .change {
                font-size: 0.875rem;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
            }
            .change.positive {
                background-color: rgba(34, 197, 94, 0.1);
                color: var(--success-color);
            }
            .change.negative {
                background-color: rgba(239, 68, 68, 0.1);
                color: var(--danger-color);
            }
            .percentage {
                font-size: 0.875rem;
                color: var(--text-secondary);
            }
        `;
        document.head.appendChild(styles);
    }
}

if (!document.querySelector('#notification-styles')) {
    const notificationStyles = document.createElement('style');
    notificationStyles.id = 'notification-styles';
    notificationStyles.textContent = `
        .notification {
            position: fixed;
            top: 1rem;
            right: 1rem;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        }
        .notification-content {
            padding: 1rem;
            border-radius: 0.5rem;
            background-color: white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .notification.success .notification-content {
            border-left: 4px solid var(--success-color);
        }
        .notification.error .notification-content {
            border-left: 4px solid var(--danger-color);
        }
        .notification.warning .notification-content {
            border-left: 4px solid var(--warning-color);
        }
        .notification button {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1.25rem;
            color: var(--text-secondary);
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
    document.head.appendChild(notificationStyles);
}

if (!document.querySelector('#export-buttons-styles')) {
    const exportButtonsStyles = document.createElement('style');
    exportButtonsStyles.id = 'export-buttons-styles';
    exportButtonsStyles.textContent = `
        .export-buttons {
            display: flex;
            gap: 1rem;
            margin-left: auto;
        }
        .btn-export {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border: none;
            border-radius: 0.375rem;
            background-color: var(--primary-color);
            color: white;
            cursor: pointer;
            transition: opacity 0.3s ease;
        }
        .btn-export:hover {
            opacity: 0.9;
        }
    `;
    document.head.appendChild(exportButtonsStyles);
}


function deleteAllTransactions() {
    if (confirm('Are you sure you want to delete all transactions? This action cannot be undone.')) {
        state.expenses = [];
        saveState();
        updateUI();
        showNotification('All transactions have been deleted', 'success');
    }
}


if (!document.querySelector('#enhanced-header-styles')) {
    const enhancedHeaderStyles = document.createElement('style');
    enhancedHeaderStyles.id = 'enhanced-header-styles';
    enhancedHeaderStyles.textContent = `
        .header {
            background-color: var(--card-background);
            border-radius: 1rem;
            padding: 1.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 
                        0 2px 4px -1px rgba(0, 0, 0, 0.06);
            margin-bottom: 2rem;
        }

        .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 2rem;
        }

        .header-left {
            flex-shrink: 0;
        }

        .header-right {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }

        .currency-control {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .control-label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .currency-selector select {
            padding: 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            background-color: white;
            min-width: 200px;
            font-size: 0.875rem;
            color: var(--text-primary);
            transition: all 0.2s ease;
        }

        .currency-selector select:hover {
            border-color: var(--primary-color);
        }

        .button-group {
            display: flex;
            gap: 0.5rem;
        }

        .button-group:not(:last-child)::after {
            content: '';
            width: 1px;
            background-color: var(--border-color);
            margin: 0 0.5rem;
        }

        .btn-action {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            border: none;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
        }

        .btn-action i {
            font-size: 1rem;
        }

        .btn-primary {
            background-color: var(--primary-color);
            color: white;
        }

        .btn-secondary {
            background-color: var(--background-color);
            color: var(--text-primary);
        }

        .btn-danger {
            background-color: var(--danger-color);
            color: white;
        }

        .btn-action:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .btn-action:active {
            transform: translateY(0);
        }

        .btn-primary:hover {
            background-color: var(--secondary-color);
        }

        .btn-secondary:hover {
            background-color: var(--border-color);
        }

        .btn-danger:hover {
            background-color: #dc2626;
        }

        @media (max-width: 1024px) {
            .header-content {
                flex-direction: column;
                align-items: stretch;
            }

            .header-right {
                flex-direction: column;
            }

            .button-group {
                width: 100%;
                justify-content: center;
            }

            .button-group:not(:last-child)::after {
                display: none;
            }

            .btn-action {
                flex: 1;
                justify-content: center;
            }
        }

        @media (max-width: 640px) {
            .button-group {
                flex-direction: column;
            }

            .currency-selector select {
                width: 100%;
            }
        }
    `;
    document.head.appendChild(enhancedHeaderStyles);
}

const GEMINI_API_KEY = "AIzaSyC4q6qYRpzlkeftVzL7BjqZyadN_flkFhA";  ////////////////////

function renderStatisticsView() {
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <div class="statistics-container">
            <div class="statistics-header">
                <h2>Financial Analytics Dashboard</h2>
            </div>
            
            <div class="statistics-grid">
                <div class="chart-section">
                    <div class="card monthly-spending-card">
                        <div class="card-header">
                            <h3>Monthly Income vs Expenses</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="monthlySpendingChart" class="chart-full-width"></canvas>
                        </div>
                    </div>
                    
                    <div class="charts-row">
                        <div class="card category-spending-card">
                            <div class="card-header">
                                <h3>Spending by Category</h3>
                            </div>
                            <div class="chart-container">
                                <canvas id="categorySpendingChart" class="chart-full-width"></canvas>
                            </div>
                        </div>
                        
                        <div class="card spending-insights-card">
                            <div class="card-header">
                                <h3>Spending Insights</h3>
                            </div>
                            <div id="spendingInsightsContent" class="insights-content"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const statisticsStyles = document.createElement('style');
    statisticsStyles.id = 'statistics-view-styles';
    statisticsStyles.textContent = `
        .statistics-container {
            background-color: var(--background-color);
            border-radius: 1rem;
            padding: 1.5rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);
        }

        .statistics-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-color);
        }

        .time-range-selector {
            display: flex;
            gap: 0.5rem;
        }

        .time-range-selector button {
            padding: 0.5rem 1rem;
            border: 1px solid var(--border-color);
            background-color: transparent;
            color: var(--text-secondary);
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .time-range-selector button.active {
            background-color: var(--primary-color);
            color: white;
            border-color: var(--primary-color);
        }

        .statistics-grid {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .chart-section {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .monthly-spending-card,
        .category-spending-card,
        .spending-insights-card {
            background-color: white;
            border-radius: 1rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 1rem;
        }

        .charts-row {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 1.5rem;
        }

        .chart-container {
            height: 300px;
            position: relative;
        }

        .chart-full-width {
            width: 100% !important;
            height: 100% !important;
        }

        .spending-insights-card .insights-content {
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }

        .insights-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }

        .insight-item {
            background-color: var(--background-color);
            padding: 1rem;
            border-radius: 0.5rem;
            text-align: center;
            transition: transform 0.3s ease;
        }

        .insight-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .insight-item h4 {
            margin-bottom: 0.5rem;
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .insight-item p {
            font-weight: bold;
            color: var(--text-primary);
            font-size: 1rem;
        }

        @media (max-width: 1024px) {
            .charts-row {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(statisticsStyles);

    // Render charts and insights
    renderMonthlySpendingChart();
    renderCategorySpendingChart();
    renderSpendingInsights();
}

function renderMonthlySpendingChart() {
    const monthlyData = analytics.getMonthlyTrends();
    const ctx = document.getElementById('monthlySpendingChart').getContext('2d');
    
    const months = Object.keys(monthlyData);
    const expenses = months.map(month => monthlyData[month].expenses);
    const incomes = months.map(month => monthlyData[month].income);

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => new Date(m).toLocaleString('default', { month: 'short' })),
            datasets: [
                {
                    label: 'Expenses',
                    data: expenses,
                    backgroundColor: 'rgba(239, 68, 68, 0.6)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Income',
                    data: incomes,
                    backgroundColor: 'rgba(34, 197, 94, 0.6)',
                    borderColor: 'rgba(34, 197, 94, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount'
                    }
                }
            }
        }
    });
}

function renderCategorySpendingChart() {
    const categoryInsights = analytics.getCategoryInsights();
    const ctx = document.getElementById('categorySpendingChart').getContext('2d');

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: categoryInsights.map(insight => state.categories[insight.category]),
            datasets: [{
                data: categoryInsights.map(insight => insight.total),
                backgroundColor: [
                    '#6366f1', '#22c55e', '#ef4444', '#f59e0b', 
                    '#3b82f6', '#6b7280', '#8b5cf6', '#ec4899'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function renderSpendingInsights() {
    const insights = analytics.analyzeSpendingPatterns();
    const insightsContent = document.getElementById('spendingInsightsContent');
    
    insightsContent.innerHTML = `
        <div class="insights-grid">
            <div class="insight-item">
                <h4>Average Daily Spending</h4>
                <p>${formatCurrency(insights.averageDailySpending)}</p>
            </div>
            <div class="insight-item">
                <h4>Most Frequent Spending Category</h4>
                <p>${state.categories[insights.mostFrequentCategory]}</p>
            </div>
            <div class="insight-item">
                <h4>Highest Spending Day</h4>
                <p>${insights.highestSpendingDay.date}: ${formatCurrency(insights.highestSpendingDay.amount)}</p>
            </div>
            <div class="insight-item">
                <h4>Lowest Spending Day</h4>
                <p>${insights.lowestSpendingDay.date}: ${formatCurrency(insights.lowestSpendingDay.amount)}</p>
            </div>
        </div>
    `;
}

analytics.analyzeDailySpending = function() {
    const dailyTotals = {};
    let totalSpending = 0;
    let daysWithTransactions = 0;

    const expenses = state.expenses.filter(t => t.type === 'expense');

    expenses.forEach(transaction => {
        const amount = convertAmount(transaction.amount, transaction.currency);
        
        if (!dailyTotals[transaction.date]) {
            dailyTotals[transaction.date] = 0;
            daysWithTransactions++;
        }
        dailyTotals[transaction.date] += amount;
        totalSpending += amount;
    });

    const sortedDays = Object.entries(dailyTotals).sort((a, b) => b[1] - a[1]);

    return {
        highestSpendingDay: {
            date: sortedDays[0]?.[0] || 'N/A',
            amount: sortedDays[0]?.[1] || 0
        },
        lowestSpendingDay: {
            date: sortedDays[sortedDays.length - 1]?.[0] || 'N/A',
            amount: sortedDays[sortedDays.length - 1]?.[1] || 0
        },
        averageDailySpending: daysWithTransactions > 0 ? 
            totalSpending / daysWithTransactions : 0
    };
};

document.querySelector('.sidebar nav').innerHTML = `
    <a href="#" class="active"><i class="fas fa-home"></i> Dashboard</a>
    <a href="#" id="statistics-link"><i class="fas fa-chart-pie"></i> Statistics</a>
    <a href="#"><i class="fas fa-history"></i> History</a>
    <a href="#"><i class="fas fa-cog"></i> Settings</a>
`;

document.getElementById('statistics-link').addEventListener('click', renderStatisticsView);

document.addEventListener("DOMContentLoaded", () => {
    function showSection(sectionId) {
        document.querySelectorAll(".content-section").forEach(section => {
            section.style.display = section.id === sectionId ? "block" : "none";
        });

        document.querySelectorAll(".sidebar nav a").forEach(link => {
            link.classList.toggle("active", link.getAttribute("id") === `${sectionId}-btn`);
        });
    }

    const dashboardBtn = document.getElementById("dashboard-btn");
    const statsBtn = document.getElementById("statistics-btn");
    const historyBtn = document.getElementById("history-btn");
    const settingsBtn = document.getElementById("settings-btn");

    if (dashboardBtn) dashboardBtn.addEventListener("click", () => showSection("dashboard-section"));
    if (statsBtn) statsBtn.addEventListener("click", () => showSection("statistics-section"));
    if (historyBtn) historyBtn.addEventListener("click", () => showSection("history-section"));
    if (settingsBtn) settingsBtn.addEventListener("click", () => showSection("settings-section"));

    showSection("dashboard-section");
});


// View Management
let currentView = 'dashboard';

function showDashboardView() {
    currentView = 'dashboard';
    
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <!-- Header Section -->
        <header class="header">
            <div class="currency-selector">
                <label>Base Currency:</label>
                <select id="baseCurrency">
                    <option value="USD">USD - US Dollar</option>
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="JPY">JPY - Japanese Yen</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                </select>
                <button id="updateRates" class="btn-update">
                    <i class="fas fa-sync-alt"></i> Update Rates
                </button>
            </div>
        </header>

        <!-- Dashboard Grid -->
        <div class="dashboard-grid">
            <div class="card balance-card">
                <div class="card-header"><h3>Total Balance</h3><i class="fas fa-dollar-sign"></i></div>
                <div class="card-content"><h2 id="totalBalance">0.00</h2><p>Current Month</p></div>
            </div>
            <div class="card income-card">
                <div class="card-header"><h3>Income</h3><i class="fas fa-arrow-up"></i></div>
                <div class="card-content"><h2 id="totalIncome">0.00</h2><p>Current Month</p></div>
            </div>
            <div class="card expense-card">
                <div class="card-header"><h3>Expenses</h3><i class="fas fa-arrow-down"></i></div>
                <div class="card-content"><h2 id="totalExpenses">0.00</h2><p>Current Month</p></div>
            </div>
        </div>

        <!-- Add Transaction Section -->
        <div class="add-transaction-section">
            <div class="card transaction-card">
                <div class="card-header">
                    <h3>Add New Transaction</h3>
                </div>
                <form id="expenseForm" class="transaction-form">
                    <div class="form-group">
                        <label>Type</label>
                        <select id="transactionType" required>
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <input type="text" id="description" required placeholder="Enter description">
                    </div>
                    <div class="form-group">
                        <label>Amount</label>
                        <input type="number" id="amount" required step="0.01" placeholder="Enter amount">
                    </div>
                    <div class="form-group">
                        <label>Category</label>
                        <select id="category" required>
                            <option value="food">Food & Dining</option>
                            <option value="transport">Transportation</option>
                            <option value="utilities">Utilities</option>
                            <option value="entertainment">Entertainment</option>
                            <option value="shopping">Shopping</option>
                            <option value="health">Healthcare</option>
                            <option value="travel">Travel</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="date" required>
                    </div>
                    <button type="submit" class="btn-submit">
                        <i class="fas fa-plus"></i> Add Transaction
                    </button>
                </form>
            </div>

            <!-- Chart Section -->
            <div class="card chart-card">
                <div class="card-header">
                    <h3>Expense Analysis</h3>
                </div>
                <div class="chart-container">
                    <canvas id="expenseChart"></canvas>
                </div>
            </div>
        </div>

        <!-- Recent Transactions -->
        <div class="card transactions-card">
            <div class="card-header">
                <h3>Recent Transactions</h3>
            </div>
            <div id="expenseList" class="transaction-list">
                <!-- Transactions will be added here dynamically -->
            </div>
        </div>
    `;

    initializeDashboard();
    updateNavigationState('dashboard');
}

function showStatisticsView() {
    currentView = 'statistics';
    
    const mainContent = document.querySelector('.main-content');
    mainContent.innerHTML = `
        <div class="statistics-container">
            <div class="statistics-header">
                <h2>Financial Analytics Dashboard</h2>
            </div>
            
            <div class="statistics-grid">
                <div class="chart-section">
                    <div class="card monthly-spending-card">
                        <div class="card-header">
                            <h3>Monthly Income vs Expenses</h3>
                        </div>
                        <div class="chart-container">
                            <canvas id="monthlySpendingChart" class="chart-full-width"></canvas>
                        </div>
                    </div>
                    
                    <div class="charts-row">
                        <div class="card category-spending-card">
                            <div class="card-header">
                                <h3>Spending by Category</h3>
                            </div>
                            <div class="chart-container">
                                <canvas id="categorySpendingChart" class="chart-full-width"></canvas>
                            </div>
                        </div>
                        
                        <div class="card spending-insights-card">
                            <div class="card-header">
                                <h3>Spending Insights</h3>
                            </div>
                            <div id="spendingInsightsContent" class="insights-content"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const chatbotContainer = document.createElement("div");
    chatbotContainer.className = "chatbot-container";
    chatbotContainer.innerHTML = `
        <div id="chatbox">
            <div id="chat-messages"></div>
            <input type="text" id="user-input" placeholder="Ask me anything..." />
            <button id="send-btn">Send</button>
        </div>
    `;
    mainContent.appendChild(chatbotContainer);

    updateNavigationState('statistics');
    initializeStatistics();
    
}

function initializeDashboard() {
    elements.expenseForm = document.getElementById('expenseForm');
    elements.expenseList = document.getElementById('expenseList');
    elements.baseCurrency = document.getElementById('baseCurrency');
    elements.updateRatesBtn = document.getElementById('updateRates');
    elements.totalBalance = document.getElementById('totalBalance');
    elements.totalIncome = document.getElementById('totalIncome');
    elements.totalExpenses = document.getElementById('totalExpenses');
    elements.transactionType = document.getElementById('transactionType');
    elements.description = document.getElementById('description');
    elements.amount = document.getElementById('amount');
    elements.category = document.getElementById('category');
    elements.date = document.getElementById('date');

    setTodayAsDefaultDate();

    elements.expenseForm.addEventListener('submit', handleTransactionSubmit);
    elements.updateRatesBtn.addEventListener('click', fetchExchangeRates);
    elements.baseCurrency.addEventListener('change', handleCurrencyChange);

    updateUI();
    setupExportButtons();
}

function initializeStatistics() {
    renderMonthlySpendingChart();
    renderCategorySpendingChart();
    renderSpendingInsights();
}

function updateNavigationState(activeView) {
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.classList.remove('active');
        if ((activeView === 'dashboard' && link.id === 'dashboard-btn') ||
            (activeView === 'statistics' && link.id === 'statistics-btn')) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const sidebarNav = document.querySelector('.sidebar nav');
    sidebarNav.innerHTML = `
        <a href="#" id="dashboard-btn" class="active">
            <i class="fas fa-home"></i> Dashboard
        </a>
        <a href="#" id="statistics-btn">
            <i class="fas fa-chart-pie"></i> Statistics
        </a>
    `;

    document.getElementById('dashboard-btn').addEventListener('click', (e) => {
        e.preventDefault();
        showDashboardView();
    });
    
    document.getElementById('statistics-btn').addEventListener('click', (e) => {
        e.preventDefault();
        showStatisticsView();
    });

    showDashboardView();
});


const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY;

document.addEventListener("DOMContentLoaded", () => {
    const sendBtn = document.getElementById("send-btn");
    const userInput = document.getElementById("user-input");
    const chatMessages = document.getElementById("chat-messages");
    const mainContent = document.querySelector(".main-content");

    if (!mainContent) {
        console.error("Main content area not found in the DOM.");
        return;
    }

    const chatbotContainer = document.createElement("div");
    chatbotContainer.className = "chatbot-container";
    chatbotContainer.innerHTML = `
        <div id="chatbox">
            <div id="chat-messages"></div>
            <input type="text" id="user-input" placeholder="Ask me anything..." />
            <button id="send-btn">Send</button>
        </div>
    `;
    mainContent.appendChild(chatbotContainer);

    const newSendBtn = document.getElementById("send-btn");
    const newUserInput = document.getElementById("user-input");
    const newChatMessages = document.getElementById("chat-messages");

    if (!newSendBtn || !newUserInput || !newChatMessages) {
        console.error("Chatbot elements not found after injection.");
        return;
    }

    newSendBtn.addEventListener("click", sendMessage);
    newUserInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter") sendMessage();
    });

    function sendMessage() {
        const userMessage = newUserInput.value.trim();
        if (!userMessage) return;
    
        displayMessage(userMessage, "user");
        newUserInput.value = ""; 
    
        const monthlyTrends = analytics.getMonthlyTrends();
        const spendingPatterns = analytics.analyzeSpendingPatterns();
        const categoryInsights = analytics.getCategoryInsights();
    
        const financialContext = {
            monthlyTrends,
            spendingPatterns,
            categoryInsights,
            baseCurrency: state.baseCurrency
        };
    
        const enhancedPrompt = `
        Based on my financial data:
        - Monthly Trends: ${JSON.stringify(monthlyTrends)}
        - Spending Patterns: ${JSON.stringify(spendingPatterns)}
        - Category Insights: ${JSON.stringify(categoryInsights)}
    
        Financial Question: ${userMessage}
    
        Please provide a concise, personalized financial advice or insight considering the above context.
        `;
    
        fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                contents: [{ 
                    role: "user", 
                    parts: [{ text: enhancedPrompt }] 
                }] 
            })
        })
        .then(response => response.json())
        .then(data => {
            const botMessage = data?.candidates?.[0]?.content?.parts?.[0]?.text || 
                "I'm unable to provide financial advice right now.";
            displayMessage(botMessage, "bot");
        })
        .catch(error => {
            console.error("Chatbot API Error:", error);
            displayMessage("Oops! Something went wrong. Please try again.", "bot");
        });
    }

    function displayMessage(message, sender) {
        const messageElement = document.createElement("div");
        messageElement.className = sender === "user" ? "message user" : "message bot";
        messageElement.textContent = message;
        newChatMessages.appendChild(messageElement);
        newChatMessages.scrollTop = newChatMessages.scrollHeight;
    }

    const expenseChartContainer = document.querySelector(".chart-container");
    if (expenseChartContainer) {
        expenseChartContainer.style.display = "flex";
        expenseChartContainer.style.justifyContent = "center";
        expenseChartContainer.style.alignItems = "center";
    }
});
