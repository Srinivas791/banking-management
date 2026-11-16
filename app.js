// ========================================================
// Simple Banking Management System - Main Dashboard Controller
// ========================================================

let currentUser = null;
let currentRole = null;
let userAccounts = [];
let allBankAccounts = [];
let monthlyTrendChartInstance = null;
let distributionChartInstance = null;

// Initialize System on DOM Load
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthSession();
  setupEventListeners();
  loadDashboardData();
});

// Check Authentication Session
async function checkAuthSession() {
  try {
    const data = await API.get('/api/auth/me');
    if (!data || !data.authenticated) {
      window.location.href = '/login';
      return;
    }

    currentUser = data.user;
    currentRole = data.user.role;
    userAccounts = data.accounts || [];

    // Render User Info in Sidebar
    document.getElementById('userNameDisplay').textContent = currentUser.full_name;
    document.getElementById('userAvatar').textContent = currentUser.full_name.charAt(0).toUpperCase();

    const roleBadge = document.getElementById('userRoleBadge');
    roleBadge.textContent = currentRole.toUpperCase();
    roleBadge.className = `role-badge ${currentRole}`;

    // Apply RBAC UI Visibility
    if (currentRole === 'customer') {
      document.querySelectorAll('.staff-only, .admin-only').forEach(el => el.style.display = 'none');
    } else if (currentRole === 'employee') {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.staff-only').forEach(el => el.style.display = '');
    } else if (currentRole === 'admin') {
      document.querySelectorAll('.staff-only, .admin-only').forEach(el => el.style.display = '');
    }

  } catch (err) {
    console.error('Session verification error:', err);
    window.location.href = '/login';
  }
}

// Sidebar Navigation & View Switcher
function switchView(viewId, clickedLink = null) {
  // Update Navigation Active State
  if (clickedLink) {
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => link.classList.remove('active'));
    clickedLink.classList.add('active');
  }

  // Switch View Visibility
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const targetView = document.getElementById(viewId);
  if (targetView) targetView.classList.add('active');

  // Update Top Header Titles
  const heading = document.getElementById('viewHeading');
  const subheading = document.getElementById('viewSubheading');

  const titles = {
    dashboardView: { title: 'Dashboard Overview', sub: 'Real-time financial status & system telemetry' },
    customersView: { title: 'Customer Management', sub: 'Client portfolio, KYC profiles & relationships' },
    accountsView: { title: 'Bank Accounts', sub: 'Retail & commercial account repository' },
    operationsView: { title: 'Banking Operations', sub: 'Deposit, withdrawal, and fund transfer desk' },
    transactionsView: { title: 'Transaction Ledger', sub: 'Master audit trails and official statement records' },
    adminView: { title: 'System Administration', sub: 'Staff roles, access logs & operational audit' }
  };

  if (titles[viewId]) {
    heading.textContent = titles[viewId].title;
    subheading.textContent = titles[viewId].sub;
  }

  // Trigger Data Loads for Selected View
  if (viewId === 'dashboardView') loadDashboardData();
  if (viewId === 'customersView') loadCustomers();
  if (viewId === 'accountsView') loadAccounts();
  if (viewId === 'operationsView') prepareOperationsView();
  if (viewId === 'transactionsView') loadTransactions();
  if (viewId === 'adminView') loadAdminSection();

  // Close mobile sidebar if open
  document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

async function handleLogout() {
  if (confirm('Are you sure you want to securely log out?')) {
    await API.post('/api/auth/logout', {});
    window.location.href = '/login';
  }
}

// ========================================================
// 1. DASHBOARD OVERVIEW & ANALYTICS
// ========================================================

async function loadDashboardData() {
  try {
    const data = await API.get('/api/dashboard/stats');
    if (!data || !data.success) return;

    renderKPIStats(data);
    renderRecentTransactions(data.recent_transactions || []);
    renderCharts(data);

  } catch (err) {
    console.error('Error loading dashboard stats:', err);
  }
}

function renderKPIStats(data) {
  const grid = document.getElementById('statsGrid');
  grid.innerHTML = '';

  if (data.role === 'admin' || data.role === 'employee') {
    const s = data.summary;
    grid.innerHTML = `
      <div class="stat-card blue">
        <div class="stat-info">
          <span class="stat-label">Total Customers</span>
          <span class="stat-value">${s.total_customers}</span>
          <span class="stat-subtext">Active KYC clients</span>
        </div>
        <div class="stat-icon-wrap blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
        </div>
      </div>

      <div class="stat-card emerald">
        <div class="stat-info">
          <span class="stat-label">Total Accounts</span>
          <span class="stat-value">${s.total_accounts}</span>
          <span class="stat-subtext">${s.active_accounts} currently active</span>
        </div>
        <div class="stat-icon-wrap emerald">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
        </div>
      </div>

      <div class="stat-card cyan">
        <div class="stat-info">
          <span class="stat-label">Total Bank Liquidity</span>
          <span class="stat-value">${formatCurrency(s.total_liquidity)}</span>
          <span class="stat-subtext">Cumulative deposits</span>
        </div>
        <div class="stat-icon-wrap cyan">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </div>
      </div>

      <div class="stat-card amber">
        <div class="stat-info">
          <span class="stat-label">Total Deposits</span>
          <span class="stat-value">${formatCurrency(s.total_deposits)}</span>
          <span class="stat-subtext">${s.deposit_count} deposit actions</span>
        </div>
        <div class="stat-icon-wrap amber">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        </div>
      </div>

      <div class="stat-card rose">
        <div class="stat-info">
          <span class="stat-label">Total Withdrawals</span>
          <span class="stat-value">${formatCurrency(s.total_withdrawals)}</span>
          <span class="stat-subtext">${s.withdrawal_count} payouts</span>
        </div>
        <div class="stat-icon-wrap rose">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
        </div>
      </div>
    `;
  } else {
    // Customer Dashboard Cards
    const s = data.summary;
    grid.innerHTML = `
      <div class="stat-card blue">
        <div class="stat-info">
          <span class="stat-label">Total Available Funds</span>
          <span class="stat-value">${formatCurrency(s.total_balance)}</span>
          <span class="stat-subtext">Across ${s.total_accounts} linked account(s)</span>
        </div>
        <div class="stat-icon-wrap blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
        </div>
      </div>

      <div class="stat-card emerald">
        <div class="stat-info">
          <span class="stat-label">Total Deposited</span>
          <span class="stat-value">${formatCurrency(s.total_deposits)}</span>
          <span class="stat-subtext">Credits to your accounts</span>
        </div>
        <div class="stat-icon-wrap emerald">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        </div>
      </div>

      <div class="stat-card rose">
        <div class="stat-info">
          <span class="stat-label">Total Withdrawn</span>
          <span class="stat-value">${formatCurrency(s.total_withdrawals)}</span>
          <span class="stat-subtext">Cash and ATM disbursements</span>
        </div>
        <div class="stat-icon-wrap rose">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
        </div>
      </div>

      <div class="stat-card amber">
        <div class="stat-info">
          <span class="stat-label">Transfers Out</span>
          <span class="stat-value">${formatCurrency(s.total_transfers)}</span>
          <span class="stat-subtext">Sent to other accounts</span>
        </div>
        <div class="stat-icon-wrap amber">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path></svg>
        </div>
      </div>
    `;
  }
}

function renderRecentTransactions(txns) {
  const tbody = document.getElementById('dashboardTxnBody');
  if (!txns || txns.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No transactions recorded.</td></tr>';
    return;
  }

  let html = '';
  txns.forEach(t => {
    let typeClass = 'pill-info';
    if (t.transaction_type === 'DEPOSIT') typeClass = 'pill-success';
    if (t.transaction_type === 'WITHDRAWAL') typeClass = 'pill-danger';
    if (t.transaction_type === 'TRANSFER') typeClass = 'pill-warning';

    const accDisplay = t.from_account_number || t.to_account_number || '-';

    html += `
      <tr>
        <td style="font-family: var(--font-mono); font-weight: 600;">${t.transaction_ref}</td>
        <td><strong style="color: #1e40af;">${accDisplay}</strong></td>
        <td><span class="pill ${typeClass}">${t.transaction_type}</span></td>
        <td style="font-weight: 700;">${formatCurrency(t.amount)}</td>
        <td>${t.created_at}</td>
        <td><span class="pill pill-success">${t.status}</span></td>
        <td>${t.description || '-'}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderCharts(data) {
  // 1. Monthly Trends Chart
  const trendCtx = document.getElementById('monthlyTrendChart').getContext('2d');
  if (monthlyTrendChartInstance) monthlyTrendChartInstance.destroy();

  const trends = data.monthly_trends || [];
  const labels = trends.map(t => t.month) || ['Current'];
  const depositsData = trends.map(t => t.deposits || 0);
  const withdrawalsData = trends.map(t => t.withdrawals || t.expenses || 0);

  monthlyTrendChartInstance = new Chart(trendCtx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Demo Period'],
      datasets: [
        {
          label: 'Deposits ($)',
          data: depositsData.length ? depositsData : [18000],
          backgroundColor: 'rgba(37, 99, 235, 0.8)',
          borderRadius: 6
        },
        {
          label: 'Withdrawals / Expenses ($)',
          data: withdrawalsData.length ? withdrawalsData : [8400],
          backgroundColor: 'rgba(239, 68, 68, 0.75)',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // 2. Doughnut Distribution Chart
  const distCtx = document.getElementById('distributionChart').getContext('2d');
  if (distributionChartInstance) distributionChartInstance.destroy();

  let distLabels = ['Savings', 'Current'];
  let distValues = [65, 35];

  if (data.account_distribution && data.account_distribution.length) {
    distLabels = data.account_distribution.map(d => d.account_type + ' Accounts');
    distValues = data.account_distribution.map(d => d.total_balance || d.count);
  } else if (data.role === 'customer' && data.accounts) {
    distLabels = data.accounts.map(a => `${a.account_type} (${a.account_number.slice(-4)})`);
    distValues = data.accounts.map(a => a.balance);
  }

  distributionChartInstance = new Chart(distCtx, {
    type: 'doughnut',
    data: {
      labels: distLabels,
      datasets: [{
        data: distValues,
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#06b6d4'],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
}

// ========================================================
// 2. CUSTOMER MANAGEMENT CONTROLLER
// ========================================================

async function loadCustomers(searchQuery = '') {
  try {
    const url = searchQuery ? `/api/customers?q=${encodeURIComponent(searchQuery)}` : '/api/customers';
    const data = await API.get(url);
    if (!data || !data.success) return;

    const tbody = document.getElementById('customersTableBody');
    if (data.customers.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No customers found.</td></tr>';
      return;
    }

    let html = '';
    data.customers.forEach(c => {
      html += `
        <tr>
          <td>#${c.id}</td>
          <td><strong>${c.full_name}</strong></td>
          <td>${c.email}</td>
          <td>${c.phone}</td>
          <td><span class="pill pill-info">${c.account_count} Account(s)</span></td>
          <td style="font-weight: 700; color: #059669;">${formatCurrency(c.total_balance)}</td>
          <td><span class="pill ${c.user_status === 'active' ? 'pill-success' : 'pill-danger'}">${c.user_status}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-outline btn-sm" onclick="viewCustomerDetails(${c.id})">Details</button>
              ${currentRole === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id}, '${c.full_name}')">Close</button>` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

let searchCustomerTimeout = null;
function handleCustomerSearch() {
  clearTimeout(searchCustomerTimeout);
  searchCustomerTimeout = setTimeout(() => {
    const q = document.getElementById('customerSearchInput').value.trim();
    loadCustomers(q);
  }, 300);
}

function openAddCustomerModal() {
  openModal('addCustomerModal');
}

async function handleAddCustomerSubmit(e) {
  e.preventDefault();
  const payload = {
    full_name: document.getElementById('newCustName').value.trim(),
    phone: document.getElementById('newCustPhone').value.trim(),
    email: document.getElementById('newCustEmail').value.trim(),
    password: document.getElementById('newCustPassword').value.trim(),
    address: document.getElementById('newCustAddress').value.trim(),
    city: document.getElementById('newCustCity').value.trim(),
    account_type: document.getElementById('newCustAccType').value,
    initial_deposit: parseFloat(document.getElementById('newCustDeposit').value) || 1000
  };

  const res = await API.post('/api/customers', payload);
  if (res && res.success) {
    showToast('Success', res.message, 'success');
    closeModal('addCustomerModal');
    loadCustomers();
    loadDashboardData();
  } else {
    showToast('Customer Error', res ? res.message : 'Failed to add customer', 'error');
  }
}

async function viewCustomerDetails(custId) {
  const data = await API.get(`/api/customers/${custId}`);
  if (!data || !data.success) return;

  const c = data.customer;
  const accounts = data.accounts || [];

  document.getElementById('detailCustName').textContent = `Customer Profile: ${c.full_name}`;

  let accountsHtml = '<div style="margin-top: 16px;"><strong>Linked Bank Accounts:</strong></div>';
  if (accounts.length === 0) {
    accountsHtml += '<p style="color: var(--text-muted); font-size: 0.85rem;">No accounts open.</p>';
  } else {
    accountsHtml += '<div style="margin-top: 8px;">';
    accounts.forEach(a => {
      accountsHtml += `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-family: monospace; font-weight: 700; color: #1e40af;">${a.account_number}</div>
            <div style="font-size: 0.78rem; color: #64748b;">${a.account_type} &bull; Status: ${a.status.toUpperCase()}</div>
          </div>
          <div style="font-weight: 700; font-size: 1rem; color: #059669;">
            ${formatCurrency(a.balance)}
          </div>
        </div>
      `;
    });
    accountsHtml += '</div>';
  }

  document.getElementById('customerDetailsContent').innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.88rem;">
      <div><strong>Full Name:</strong> ${c.full_name}</div>
      <div><strong>Email:</strong> ${c.email}</div>
      <div><strong>Phone:</strong> ${c.phone}</div>
      <div><strong>DOB:</strong> ${c.date_of_birth || 'N/A'}</div>
      <div><strong>Occupation:</strong> ${c.occupation || 'N/A'}</div>
      <div><strong>ID Number:</strong> ${c.id_number || 'N/A'}</div>
      <div style="grid-column: span 2;"><strong>Address:</strong> ${c.address || 'N/A'}, ${c.city || ''} ${c.state || ''} ${c.postal_code || ''}</div>
    </div>
    ${accountsHtml}
  `;

  openModal('customerDetailsModal');
}

async function deleteCustomer(custId, name) {
  if (confirm(`Are you sure you want to deactivate customer "${name}"? Linked accounts must have $0.00 balance.`)) {
    const res = await API.delete(`/api/customers/${custId}`);
    if (res && res.success) {
      showToast('Customer Closed', res.message, 'success');
      loadCustomers();
      loadDashboardData();
    } else {
      showToast('Action Blocked', res ? res.message : 'Error closing customer', 'error');
    }
  }
}

// ========================================================
// 3. ACCOUNT MANAGEMENT CONTROLLER
// ========================================================

async function loadAccounts() {
  try {
    const q = document.getElementById('accountSearchInput')?.value.trim() || '';
    const type = document.getElementById('accountTypeFilter')?.value || '';
    const status = document.getElementById('accountStatusFilter')?.value || '';

    let url = `/api/accounts?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`;
    const data = await API.get(url);
    if (!data || !data.success) return;

    allBankAccounts = data.accounts;
    const tbody = document.getElementById('accountsTableBody');

    if (data.accounts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No accounts found matching criteria.</td></tr>';
      return;
    }

    let html = '';
    data.accounts.forEach(a => {
      let statusClass = 'pill-success';
      if (a.status === 'frozen') statusClass = 'pill-warning';
      if (a.status === 'closed') statusClass = 'pill-danger';

      html += `
        <tr>
          <td style="font-family: var(--font-mono); font-weight: 700; color: #1e40af;">${a.account_number}</td>
          <td><strong>${a.customer_name}</strong></td>
          <td><span class="pill pill-neutral">${a.account_type}</span></td>
          <td style="font-weight: 700; font-size: 0.95rem; color: #059669;">${formatCurrency(a.balance)}</td>
          <td><span class="pill ${statusClass}">${a.status.toUpperCase()}</span></td>
          <td>${a.created_at.slice(0, 10)}</td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-outline btn-sm" onclick="viewStatementForAccount('${a.account_number}')">Statement</button>
              ${currentRole !== 'customer' ? `
                <button class="btn btn-sm ${a.status === 'active' ? 'btn-danger' : 'btn-success'}" onclick="toggleAccountFreeze(${a.id}, '${a.status}')">
                  ${a.status === 'active' ? 'Freeze' : 'Unfreeze'}
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (err) {
    console.error('Error loading accounts:', err);
  }
}

let searchAccountTimeout = null;
function handleAccountSearch() {
  clearTimeout(searchAccountTimeout);
  searchAccountTimeout = setTimeout(() => {
    loadAccounts();
  }, 250);
}

async function openCreateAccountModal() {
  const custData = await API.get('/api/customers');
  if (custData && custData.success) {
    const sel = document.getElementById('newAccCustomerSelect');
    sel.innerHTML = '<option value="">-- Choose Customer --</option>';
    custData.customers.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${c.full_name} (${c.email})</option>`;
    });
  }
  openModal('createAccountModal');
}

async function handleCreateAccountSubmit(e) {
  e.preventDefault();
  const customer_id = document.getElementById('newAccCustomerSelect').value;
  const account_type = document.getElementById('newAccTypeSelect').value;
  const initial_deposit = parseFloat(document.getElementById('newAccDeposit').value) || 500;

  const res = await API.post('/api/accounts', { customer_id, account_type, initial_deposit });
  if (res && res.success) {
    showToast('Account Created', res.message, 'success');
    closeModal('createAccountModal');
    loadAccounts();
    loadDashboardData();
  } else {
    showToast('Creation Failed', res ? res.message : 'Error creating account', 'error');
  }
}

async function toggleAccountFreeze(accId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'frozen' : 'active';
  const actionName = newStatus === 'frozen' ? 'freeze' : 'unfreeze';

  if (confirm(`Are you sure you want to ${actionName} this account?`)) {
    const res = await API.patch(`/api/accounts/${accId}/status`, { status: newStatus });
    if (res && res.success) {
      showToast('Status Updated', res.message, 'success');
      loadAccounts();
    } else {
      showToast('Update Failed', res ? res.message : 'Error updating status', 'error');
    }
  }
}

function viewStatementForAccount(accNum) {
  window.open(`/statement?account=${accNum}`, '_blank');
}

// ========================================================
// 4. BANKING OPERATIONS CONTROLLER
// ========================================================

function switchOperationTab(tabId, btn) {
  document.querySelectorAll('.op-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.op-tab-content').forEach(c => c.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';
}

function setOpAmount(inputId, val) {
  document.getElementById(inputId).value = val;
}

async function prepareOperationsView() {
  // Populate dropdowns with eligible accounts
  let accounts = [];
  if (currentRole === 'customer') {
    accounts = userAccounts;
  } else {
    const data = await API.get('/api/accounts?status=active');
    accounts = data && data.accounts ? data.accounts : [];
  }

  const depositSel = document.getElementById('depositAccountSelect');
  const withdrawSel = document.getElementById('withdrawAccountSelect');
  const transferFromSel = document.getElementById('transferFromSelect');

  const populate = (sel) => {
    sel.innerHTML = '<option value="">-- Select Account --</option>';
    accounts.forEach(a => {
      const holder = a.customer_name ? ` (${a.customer_name})` : '';
      sel.innerHTML += `<option value="${a.account_number}" data-balance="${a.balance}">${a.account_number} - ${a.account_type}${holder} - $${Number(a.balance).toFixed(2)}</option>`;
    });
  };

  populate(depositSel);
  populate(withdrawSel);
  populate(transferFromSel);
}

function updateAccountBalanceHint(accNum, hintElementId) {
  const el = document.getElementById(hintElementId);
  if (!accNum) {
    el.textContent = '';
    return;
  }
  const sel = el.previousElementSibling;
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset.balance !== undefined) {
    el.textContent = `Available Balance: ${formatCurrency(opt.dataset.balance)}`;
  }
}

async function verifyReceiverAccount(accNum) {
  const hint = document.getElementById('transferReceiverHint');
  accNum = accNum.trim();
  if (!accNum) {
    hint.textContent = '';
    return;
  }

  try {
    const res = await API.get(`/api/accounts/${accNum}`);
    if (res && res.success && res.account) {
      hint.textContent = `Beneficiary Verified: ${res.account.customer_name} (${res.account.status.toUpperCase()})`;
      hint.style.color = '#059669';
    } else {
      hint.textContent = 'Account not found or invalid.';
      hint.style.color = '#dc2626';
    }
  } catch (e) {
    hint.textContent = 'Verification error.';
    hint.style.color = '#dc2626';
  }
}

async function handleDepositSubmit(e) {
  e.preventDefault();
  const account_number = document.getElementById('depositAccountSelect').value;
  const amount = parseFloat(document.getElementById('depositAmount').value);
  const description = document.getElementById('depositDesc').value.trim();

  const res = await API.post('/api/operations/deposit', { account_number, amount, description });
  if (res && res.success) {
    showToast('Deposit Complete', res.message, 'success');
    document.getElementById('depositAmount').value = '';
    document.getElementById('depositDesc').value = '';
    await checkAuthSession();
    prepareOperationsView();
    loadDashboardData();
  } else {
    showToast('Deposit Rejected', res ? res.message : 'Error processing deposit', 'error');
  }
}

async function handleWithdrawSubmit(e) {
  e.preventDefault();
  const account_number = document.getElementById('withdrawAccountSelect').value;
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const description = document.getElementById('withdrawDesc').value.trim();

  const res = await API.post('/api/operations/withdraw', { account_number, amount, description });
  if (res && res.success) {
    showToast('Withdrawal Processed', res.message, 'success');
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawDesc').value = '';
    await checkAuthSession();
    prepareOperationsView();
    loadDashboardData();
  } else {
    showToast('Withdrawal Failed', res ? res.message : 'Error processing withdrawal', 'error');
  }
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  const from_account = document.getElementById('transferFromSelect').value;
  const to_account = document.getElementById('transferToInput').value.trim();
  const amount = parseFloat(document.getElementById('transferAmount').value);
  const description = document.getElementById('transferDesc').value.trim();

  if (from_account === to_account) {
    showToast('Invalid Operation', 'Sender and receiver accounts cannot be identical.', 'warning');
    return;
  }

  if (confirm(`Authorize fund transfer of ${formatCurrency(amount)} to Account ${to_account}?`)) {
    const res = await API.post('/api/operations/transfer', { from_account, to_account, amount, description });
    if (res && res.success) {
      showToast('Transfer Executed', res.message, 'success');
      document.getElementById('transferAmount').value = '';
      document.getElementById('transferToInput').value = '';
      document.getElementById('transferDesc').value = '';
      document.getElementById('transferReceiverHint').textContent = '';
      await checkAuthSession();
      prepareOperationsView();
      loadDashboardData();
    } else {
      showToast('Transfer Blocked', res ? res.message : 'Error executing transfer', 'error');
    }
  }
}

// ========================================================
// 5. TRANSACTION HISTORY CONTROLLER
// ========================================================

async function loadTransactions() {
  try {
    const q = document.getElementById('txnSearchInput')?.value.trim() || '';
    const type = document.getElementById('txnTypeFilter')?.value || '';

    const url = `/api/transactions?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`;
    const data = await API.get(url);
    if (!data || !data.success) return;

    const tbody = document.getElementById('transactionsTableBody');
    if (data.transactions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">No transactions found.</td></tr>';
      return;
    }

    let html = '';
    data.transactions.forEach(t => {
      let typePill = 'pill-info';
      if (t.transaction_type === 'DEPOSIT') typePill = 'pill-success';
      if (t.transaction_type === 'WITHDRAWAL') typePill = 'pill-danger';
      if (t.transaction_type === 'TRANSFER') typePill = 'pill-warning';

      html += `
        <tr>
          <td style="font-family: var(--font-mono); font-weight: 700;">${t.transaction_ref}</td>
          <td>${t.created_at}</td>
          <td><span class="pill ${typePill}">${t.transaction_type}</span></td>
          <td style="font-family: monospace;">${t.from_account_number || '-'}</td>
          <td style="font-family: monospace;">${t.to_account_number || '-'}</td>
          <td style="font-weight: 700; color: #0a192f;">${formatCurrency(t.amount)}</td>
          <td style="font-weight: 600;">${formatCurrency(t.balance_after)}</td>
          <td><span class="pill pill-success">${t.status}</span></td>
          <td>${t.description || '-'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (err) {
    console.error('Error loading transactions:', err);
  }
}

let searchTxnTimeout = null;
function handleTransactionSearch() {
  clearTimeout(searchTxnTimeout);
  searchTxnTimeout = setTimeout(() => {
    loadTransactions();
  }, 250);
}

function exportLedgerCSV() {
  // Use first account or let user specify
  const acc = userAccounts.length ? userAccounts[0].account_number : (allBankAccounts.length ? allBankAccounts[0].account_number : '1001002345');
  window.location.href = `/api/statement/${acc}/download-csv`;
}

function openStatementModal() {
  const sel = document.getElementById('statementAccSelect');
  sel.innerHTML = '';
  const accountsToPick = currentRole === 'customer' ? userAccounts : allBankAccounts;

  accountsToPick.forEach(a => {
    sel.innerHTML += `<option value="${a.account_number}">${a.account_number} - ${a.account_type} ($${Number(a.balance).toFixed(2)})</option>`;
  });

  openModal('statementPickerModal');
}

function proceedToStatement() {
  const acc = document.getElementById('statementAccSelect').value;
  if (acc) {
    closeModal('statementPickerModal');
    viewStatementForAccount(acc);
  }
}

// ========================================================
// 6. ADMIN PANEL CONTROLLER
// ========================================================

function switchAdminTab(tabId, btn) {
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.admin-tab-content').forEach(c => c.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

  if (tabId === 'employeesTab') loadEmployees();
  if (tabId === 'auditTab') loadAuditLogs();
  if (tabId === 'reportsTab') loadAdminReports();
}

function loadAdminSection() {
  loadEmployees();
}

async function loadEmployees() {
  try {
    const data = await API.get('/api/admin/employees');
    if (!data || !data.success) return;

    const tbody = document.getElementById('employeesTableBody');
    if (data.employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No staff records found.</td></tr>';
      return;
    }

    let html = '';
    data.employees.forEach(e => {
      html += `
        <tr>
          <td>#${e.id}</td>
          <td><strong>${e.full_name}</strong></td>
          <td>${e.email}</td>
          <td>${e.phone}</td>
          <td><span class="pill ${e.role === 'admin' ? 'pill-danger' : 'pill-warning'}">${e.role.toUpperCase()}</span></td>
          <td><span class="pill ${e.status === 'active' ? 'pill-success' : 'pill-danger'}">${e.status}</span></td>
          <td>
            ${e.id !== currentUser.id ? `
              <button class="btn btn-outline btn-sm" onclick="toggleUserStatus(${e.id}, '${e.status}')">
                ${e.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            ` : '<span style="font-size: 0.75rem; color: #64748b;">(Current)</span>'}
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (err) {
    console.error('Error loading employees:', err);
  }
}

function openAddEmployeeModal() {
  openModal('addEmployeeModal');
}

async function handleAddEmployeeSubmit(e) {
  e.preventDefault();
  const payload = {
    full_name: document.getElementById('newEmpName').value.trim(),
    email: document.getElementById('newEmpEmail').value.trim(),
    phone: document.getElementById('newEmpPhone').value.trim(),
    role: document.getElementById('newEmpRole').value,
    password: document.getElementById('newEmpPassword').value.trim()
  };

  const res = await API.post('/api/admin/employees', payload);
  if (res && res.success) {
    showToast('Staff Added', res.message, 'success');
    closeModal('addEmployeeModal');
    loadEmployees();
  } else {
    showToast('Creation Failed', res ? res.message : 'Error adding staff', 'error');
  }
}

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  if (confirm(`Change status to '${newStatus}' for this staff member?`)) {
    const res = await API.patch(`/api/admin/users/${userId}/status`, { status: newStatus });
    if (res && res.success) {
      showToast('Status Updated', res.message, 'success');
      loadEmployees();
    } else {
      showToast('Update Failed', res ? res.message : 'Error updating user status', 'error');
    }
  }
}

async function loadAuditLogs() {
  try {
    const data = await API.get('/api/admin/audit-logs');
    if (!data || !data.success) return;

    const tbody = document.getElementById('auditTableBody');
    if (data.audit_logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No audit events recorded.</td></tr>';
      return;
    }

    let html = '';
    data.audit_logs.forEach(l => {
      html += `
        <tr>
          <td>#${l.id}</td>
          <td>${l.created_at}</td>
          <td><span class="pill pill-info">${l.action}</span></td>
          <td>${l.user_name ? `${l.user_name} (${l.user_email})` : 'System'}</td>
          <td style="font-family: monospace;">${l.ip_address}</td>
          <td>${l.details || '-'}</td>
        </tr>
      `;
    });
    tbody.innerHTML = html;

  } catch (err) {
    console.error('Error loading audit logs:', err);
  }
}

async function loadAdminReports() {
  try {
    const data = await API.get('/api/admin/reports');
    if (!data || !data.success) return;

    // Top Accounts
    const topTbody = document.getElementById('topAccountsBody');
    let topHtml = '';
    (data.top_accounts || []).forEach(a => {
      topHtml += `
        <tr>
          <td style="font-family: monospace; font-weight: 700; color: #1e40af;">${a.account_number}</td>
          <td><strong>${a.customer_name}</strong></td>
          <td><span class="pill pill-neutral">${a.account_type}</span></td>
          <td style="font-weight: 700; color: #059669;">${formatCurrency(a.balance)}</td>
        </tr>
      `;
    });
    topTbody.innerHTML = topHtml || '<tr><td colspan="4">No data</td></tr>';

    // Large Transactions
    const lTxnTbody = document.getElementById('largeTxnsBody');
    let lHtml = '';
    (data.large_transactions || []).forEach(t => {
      lHtml += `
        <tr>
          <td style="font-family: monospace; font-weight: 700;">${t.transaction_ref}</td>
          <td><span class="pill pill-info">${t.transaction_type}</span></td>
          <td style="font-weight: 700; color: #dc2626;">${formatCurrency(t.amount)}</td>
          <td>${t.created_at}</td>
          <td>${t.description || '-'}</td>
        </tr>
      `;
    });
    lTxnTbody.innerHTML = lHtml || '<tr><td colspan="5">No data</td></tr>';

  } catch (err) {
    console.error('Error loading admin reports:', err);
  }
}

function setupEventListeners() {
  // Mobile menu close on click outside
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  });
}
