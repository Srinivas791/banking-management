// Authentication Portal Logic

function selectRole(role) {
  document.querySelectorAll('.role-tab').forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-role') === role);
  });
  document.getElementById('loginRole').value = role;
}

function fillDemo(role) {
  selectRole(role);
  const emailInput = document.getElementById('loginEmail');
  const pwdInput = document.getElementById('loginPassword');

  if (role === 'admin') {
    emailInput.value = 'admin@bank.com';
    pwdInput.value = 'Admin@123';
  } else if (role === 'employee') {
    emailInput.value = 'employee@bank.com';
    pwdInput.value = 'Employee@123';
  } else {
    emailInput.value = 'john.doe@gmail.com';
    pwdInput.value = 'Customer@123';
  }
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.style.color = '#38bdf8';
  } else {
    input.type = 'password';
    btn.style.color = '#94a3b8';
  }
}

function toggleAuthMode(mode) {
  const loginView = document.getElementById('loginView');
  const registerView = document.getElementById('registerView');
  const alertBox = document.getElementById('authAlert');
  alertBox.style.display = 'none';

  if (mode === 'register') {
    loginView.style.display = 'none';
    registerView.style.display = 'block';
  } else {
    loginView.style.display = 'block';
    registerView.style.display = 'none';
  }
}

function showAuthAlert(message, type = 'error') {
  const alertBox = document.getElementById('authAlert');
  alertBox.textContent = message;
  alertBox.className = `auth-alert ${type}`;
  alertBox.style.display = 'block';
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const role = document.getElementById('loginRole').value;
  const btn = document.getElementById('loginSubmitBtn');

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Authenticating...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });
    const data = await res.json();

    if (data.success) {
      showAuthAlert('Authentication successful! Loading dashboard...', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 700);
    } else {
      showAuthAlert(data.message || 'Login failed.');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Authenticate & Access Dashboard';
    }
  } catch (err) {
    showAuthAlert('Network error occurred. Please check server connectivity.');
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Authenticate & Access Dashboard';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const full_name = document.getElementById('regFullName').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const address = document.getElementById('regAddress').value.trim();
  const city = document.getElementById('regCity').value.trim();
  const occupation = document.getElementById('regOccupation').value.trim();
  const initial_deposit = parseFloat(document.getElementById('regDeposit').value) || 1000;
  const btn = document.getElementById('registerSubmitBtn');

  btn.disabled = true;
  btn.textContent = 'Generating Bank Account...';

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name, phone, email, password, address, city, occupation, initial_deposit
      })
    });
    const data = await res.json();

    if (data.success) {
      showAuthAlert(data.message, 'success');
      setTimeout(() => {
        toggleAuthMode('login');
        fillDemo('customer');
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPassword').value = password;
      }, 1500);
    } else {
      showAuthAlert(data.message || 'Registration failed.');
      btn.disabled = false;
      btn.textContent = 'Create Account & Generate Bank Number';
    }
  } catch (err) {
    showAuthAlert('Network error occurred during registration.');
    btn.disabled = false;
    btn.textContent = 'Create Account & Generate Bank Number';
  }
}
