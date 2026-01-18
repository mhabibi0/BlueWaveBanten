// auth.js - FIXED FOR USER PANEL (DATA VIEW ONLY)
// =============================================

const API_BASE = 'https://bluewavebanten.my.id/api/';

// Utility Functions
function showAuthNotification(message, type = 'success') {
    const container = document.querySelector('.auth-card .p-8');
    if (!container) return;

    document.querySelectorAll('.auth-notification').forEach(notif => notif.remove());

    const notification = document.createElement('div');
    notification.className = `auth-notification p-3 rounded-lg text-sm font-medium mt-4 ${
        type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    const form = container.querySelector('form');
    if (form) {
        container.insertBefore(notification, form);
    } else {
        container.appendChild(notification);
    }

    setTimeout(() => notification.remove(), 5000);
}

function updateButtonState(btnId, isLoading, defaultText) {
    const btn = document.getElementById(btnId);
    // Cari span dengan ID 'btnText' di dalam atau di luar tombol (sesuai HTML)
    const textSpan = btn?.querySelector('#btnText') || document.getElementById('btnText');
    // Cari div dengan ID 'btnLoading' di dalam atau di luar tombol (sesuai HTML)
    const loadingDiv = btn?.querySelector('#btnLoading') || document.getElementById('btnLoading');

    if (btn && textSpan && loadingDiv) {
        btn.disabled = isLoading;
        if (isLoading) {
            textSpan.textContent = 'Memproses...';
            loadingDiv.classList.remove('hidden');
        } else {
            textSpan.textContent = defaultText;
            loadingDiv.classList.add('hidden');
        }
    }
}

// Password Toggle
function initPasswordToggle() {
    const toggles = [
        { btn: 'togglePassword', input: 'password' },
        { btn: 'toggleConfirmPassword', input: 'confirmPassword' }
    ];
    
    toggles.forEach(({ btn, input }) => {
        const toggleBtn = document.getElementById(btn);
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                const passwordInput = document.getElementById(input);
                const icon = this.querySelector('i');
                if (!passwordInput) return;
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.className = 'fas fa-eye-slash';
                } else {
                    passwordInput.type = 'password';
                    icon.className = 'fas fa-eye';
                }
            });
        }
    });
}

// Login Handler - SIMPLIFIED
async function handleUserLogin(e) {
    e.preventDefault();
    updateButtonState('loginBtn', true, 'Masuk');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showAuthNotification('Email dan password harus diisi!', 'error');
        updateButtonState('loginBtn', false, 'Masuk');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}auth.php?action=user_login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        console.log('🔐 Login Response:', result);

        if (result.success && result.token) {
            // SIMPLE DATA STORAGE - hanya simpan yang essential
            localStorage.setItem('auth_token', result.token);
            
            // Format user data yang konsisten
            const userData = {
                id: result.user?.id || result.user_data?.id || 1,
                name: result.user?.name || result.user_data?.name || email.split('@')[0],
                email: email,
                role: 'user'
            };
            
            localStorage.setItem('user', JSON.stringify(userData));
            
            showAuthNotification('Login berhasil!', 'success');
            
            // Redirect langsung tanpa delay
            window.location.href = 'index.html';
            
        } else {
            // Cek apakah response.message ada, jika tidak, gunakan pesan default
            const errorMessage = result.message || 'Login gagal. Periksa email dan password.';
            throw new Error(errorMessage);
        }
        
    } catch (error) {
        console.error('❌ Login Error:', error);
        showAuthNotification(error.message, 'error');
        updateButtonState('loginBtn', false, 'Masuk');
    }
}

// Register Handler
async function handleRegister(e) {
    e.preventDefault();
    updateButtonState('registerBtn', true, 'Buat Akun');

    const nama = document.getElementById('nama').value.trim();
    const email = document.getElementById('email').value.trim();
    const telepon = document.getElementById('telepon').value.trim();
    const alamat = document.getElementById('alamat').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!nama || !email || !password) {
        showAuthNotification('Nama, email, dan password harus diisi!', 'error');
        updateButtonState('registerBtn', false, 'Buat Akun');
        return;
    }

    if (password.length < 6) {
        showAuthNotification('Password minimal 6 karakter!', 'error');
        updateButtonState('registerBtn', false, 'Buat Akun');
        return;
    }

    if (password !== confirmPassword) {
        showAuthNotification('Password tidak cocok!', 'error');
        updateButtonState('registerBtn', false, 'Buat Akun');
        return;
    }

    const data = { nama, email, telepon, alamat, password };
    
    try {
        const response = await fetch(`${API_BASE}auth.php?action=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();

        if (result.success) {
            showAuthNotification('Registrasi berhasil! Silakan login.', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            throw new Error(result.message || 'Registrasi gagal.');
        }

    } catch (error) {
        showAuthNotification(error.message, 'error');
    } finally {
        updateButtonState('registerBtn', false, 'Buat Akun');
    }
}

// Check Auth Status - FIXED: No auto-redirect
function checkExistingAuth() {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('auth_token');
    const currentPage = window.location.pathname;
    
    // Hanya redirect jika di halaman auth dan sudah login
    const isAuthPage = currentPage.includes('login.html') || currentPage.includes('register.html');
    
    if (user && token && isAuthPage) {
        console.log('🔄 Redirecting to dashboard...');
        // Redirect tanpa delay (langsung)
        window.location.href = 'index.html';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Auth system initializing...');
    checkExistingAuth();
    initPasswordToggle();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleUserLogin);
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});