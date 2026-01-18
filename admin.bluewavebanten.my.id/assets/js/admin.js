// admin.js - VERSI LENGKAP FINAL (Revisi Tampilan & UX)
// ================================================

// KONFIGURASI
const CONFIG = {
    API_BASE: 'https://bluewavebanten.my.id',
    APP_NAME: 'BlueWave Banten Admin',
    VERSION: '3.0.1' // Versi diperbarui setelah revisi
};

// STATE MANAGEMENT
const AppState = {
    currentUser: null,
    currentToken: null,
    isLoggedIn: false,
    currentEditingId: null,
    allWisata: []
};

// =============================================
// 1. CORE UTILITIES
// =============================================

/**
 * Universal API Call Function
 */
async function apiCall(action, data = {}) {
    const normalizedAction = action.replace(/\s+/g, '_');
    
    let url = `${CONFIG.API_BASE}/api/api.php?action=${normalizedAction}`;
    let method = 'POST';

    const publicActions = ['get_wisata', 'get_blog', 'get_weather', 'get_promo'];
    
    if (publicActions.includes(normalizedAction)) {
        method = 'GET';
        if (data.id) {
            url += `&id=${data.id}`;
        }
    }
    
    if (normalizedAction === 'get_tiket') {
        const params = new URLSearchParams();
        if (data.tanggal) params.append('tanggal', data.tanggal);
        if (data.status) params.append('status', data.status);
        
        delete data.tanggal;
        delete data.status;
        
        const paramString = params.toString();
        if (paramString) {
            url += `&${paramString}`;
        }
    }

    const config = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (!publicActions.includes(normalizedAction)) {
        const cleanToken = validateAndCleanToken(AppState.currentToken);
        if (!cleanToken) {
            showNotification('Token tidak valid. Silakan login kembali.', 'error');
            handleLogout();
            return { success: false, message: 'Token tidak valid' };
        }
        data.token = cleanToken;
        config.body = JSON.stringify(data);
    } else if (method === 'GET') {
        // Tidak ada body untuk GET
    } else {
        config.body = JSON.stringify(data);
    }
    
    console.log(`🔍 API Call: ${config.method} ${url}`, data);
    
    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            console.error('🔴 401 Unauthorized');
            showNotification('Sesi berakhir. Silakan login kembali.', 'error');
            handleLogout();
            return { success: false, message: 'Unauthorized', status: 401 };
        }
        
        const result = await response.json();

        if (!response.ok) {
            const errorMessage = result.message || `HTTP ${response.status}: ${response.statusText}`;
            console.error(`🔴 HTTP ${response.status}:`, errorMessage);
            throw new Error(errorMessage);
        }
        
        console.log(`🟢 API Response:`, result);
        return result;
        
    } catch (error) {
        console.error(`🔴 API Error (${normalizedAction}):`, error);
        let notifMessage = error.message;
        if (error.message.includes('Failed to fetch')) {
            notifMessage = 'Koneksi ke server gagal. Periksa koneksi internet.';
        } else if (error.message.includes('JSON')) {
            notifMessage = 'Respon server tidak valid (bukan JSON).';
        }
        showNotification(notifMessage, 'error');
        return { success: false, message: error.message };
    }
}

/**
 * Show notification
 */
function showNotification(message, type = 'success') {
    document.querySelectorAll('.notification').forEach(notif => notif.remove());
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-triangle',
        warning: 'exclamation-circle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

/**
 * Format Rupiah
 */
function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount || 0);
}

/**
 * Validate and clean token
 */
function validateAndCleanToken(token) {
    if (!token) return null;
    let cleanToken = token;
    if (cleanToken.startsWith('JWT.JWT.')) {
        cleanToken = cleanToken.replace('JWT.JWT.', 'JWT.');
    }
    if (cleanToken.startsWith('"JWT.')) {
        cleanToken = cleanToken.replace(/^"|"$/g, '');
    }
    if (cleanToken.startsWith('JWT.')) {
        cleanToken = cleanToken.replace('JWT.', '');
    }
    return cleanToken;
}

// =============================================
// 2. AUTHENTICATION SYSTEM
// =============================================

function checkAuthState() {
    const savedUser = localStorage.getItem('bluewave_admin');
    const savedToken = localStorage.getItem('bluewave_token');
    
    console.log('🔐 Checking auth state:', { hasUser: !!savedUser, hasToken: !!savedToken });
    
    if (savedUser && savedToken) {
        try {
            AppState.currentUser = JSON.parse(savedUser);
            AppState.currentToken = validateAndCleanToken(savedToken);
            AppState.isLoggedIn = true;
            verifyTokenValidity();
        } catch (error) {
            console.error('❌ Auth state error:', error);
            clearAuthData();
            showLogin();
        }
    } else {
        console.log('🔐 No saved auth data');
        showLogin();
    }
}

async function verifyTokenValidity() {
    try {
        const result = await apiCall('get_dashboard_summary');
        if (result.success) {
            console.log('✅ Token valid');
            showDashboard();
        } else {
            console.log('❌ Token invalid');
            showNotification('Sesi telah berakhir. Silakan login kembali.', 'error');
            clearAuthData();
            showLogin();
        }
    } catch (error) {
        console.error('❌ Token verification error:', error);
        clearAuthData();
        showLogin();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) {
        showNotification('Username dan password harus diisi!', 'error');
        return;
    }
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    loginBtn.disabled = true;
    loginText.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    
    try {
        const response = await fetch(`${CONFIG.API_BASE}/api/auth.php?action=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();

        if (!response.ok) {
            let errorMessage = result.message || `HTTP ${response.status}: ${response.statusText}`;
            throw new Error(errorMessage);
        }
        
        if (result.success && result.token) {
            let cleanToken = result.token;
            AppState.currentUser = result.user_data;
            AppState.currentToken = cleanToken;
            AppState.isLoggedIn = true;
            localStorage.setItem('bluewave_admin', JSON.stringify(AppState.currentUser));
            localStorage.setItem('bluewave_token', AppState.currentToken);
            showNotification(`Selamat datang, ${AppState.currentUser.name || 'Admin'}!`, 'success');
            setTimeout(showDashboard, 1000);
        } else {
            throw new Error(result.message || 'Login gagal!');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification(`${error.message}`, 'error');
    } finally {
        loginBtn.disabled = false;
        loginText.textContent = 'Masuk';
    }
}

function handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        clearAuthData();
        showNotification('Anda telah logout', 'success');
        showLogin();
    }
}

function clearAuthData() {
    localStorage.removeItem('bluewave_admin');
    localStorage.removeItem('bluewave_token');
    AppState.currentUser = null;
    AppState.currentToken = null;
    AppState.isLoggedIn = false;
    console.log('✅ Auth data cleared');
}

// =============================================
// 3. PAGE MANAGEMENT
// =============================================

function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboardPage').style.display = 'none';
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();
}

function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'block';
    if (AppState.currentUser) {
        document.getElementById('userName').textContent = AppState.currentUser.name || 'Admin';
    }
    showPage('dashboard');
}

function showPage(page) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const activeNav = document.querySelector(`[data-page="${page}"]`);
    if (activeNav) activeNav.classList.add('active');
    
    document.querySelectorAll('.content-section').forEach(section => section.classList.add('hidden'));
    
    const pageId = `page-${page}-list`;
    const targetPage = document.getElementById(pageId) || document.getElementById(`page-${page}`);
    
    if (targetPage) {
        targetPage.classList.remove('hidden');
    } else {
        console.warn(`Page element not found: ${page}`);
    }
    
    updatePageTitle(page);
    loadPageData(page);
}

function updatePageTitle(page) {
    const titles = {
        dashboard: 'Dashboard',
        wisata: 'Manajemen Wisata',
        blog: 'Manajemen Blog',
        mitra: 'Manajemen Mitra',
        tiket: 'Transaksi Tiket',
        promo: 'Promo & Event',
        laporan: 'Laporan & Analytics'
    };
    const titleElement = document.getElementById('pageTitle');
    if (titleElement) titleElement.textContent = titles[page] || 'Dashboard';
}

function loadPageData(page) {
    switch (page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'wisata':
            loadWisata();
            break;
        case 'blog':
            loadBlog();
            break;
        case 'mitra':
            loadMitra();
            break;
        case 'tiket':
            loadTiket();
            break;
        case 'promo':
            loadPromo();
            break;
        case 'laporan':
            loadLaporan();
            break;
    }
}

// =============================================
// 4. DASHBOARD FUNCTIONS
// =============================================

async function loadDashboardData() {
    try {
        const activityTable = document.getElementById('activityTable');
        if (activityTable) activityTable.innerHTML = '<tr><td colspan="4" class="text-center">Memuat data...</td></tr>';

        const summaryResult = await apiCall('get_dashboard_summary');
        if (summaryResult.success) {
            updateSummaryCards(summaryResult.data);
        } else {
            throw new Error(summaryResult.message || 'Gagal memuat data dashboard');
        }
        
        const activitiesResult = await apiCall('get_activities');
        if (activitiesResult.success) {
            updateActivityTable(activitiesResult.data);
        } else {
            updateActivityTable([]);
        }

    } catch (error) {
        console.error('Dashboard load error:', error);
        showNotification('Gagal memuat data dashboard: ' + error.message, 'error');
        updateSummaryCards(null);
    }
}

function updateSummaryCards(data) {
    if (!data) data = {};
    const elements = {
        'count-wisata': data.wisata_count || 0,
        'count-mitra': data.mitra_count || 0,
        'count-tiket': data.tiket_hari_ini || 0,
        'count-blog': data.blog_count || 0,
        'count-pendapatan': formatRupiah(data.pendapatan_bulan_ini || 0)
    };
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
}

function updateActivityTable(activities) {
    const table = document.getElementById('activityTable');
    if (!table) return;
    if (!activities || activities.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="text-center">Tidak ada aktivitas terbaru</td></tr>';
        return;
    }
    table.innerHTML = activities.map(activity => `
        <tr>
            <td>${new Date(activity.created_at).toLocaleString('id-ID')}</td>
            <td>${activity.user_name || 'System'}</td>
            <td><span class="status-badge status-info">${activity.activity}</span></td>
            <td>${activity.detail || '-'}</td>
        </tr>
    `).join('');
}

// =============================================
// 5. WISATA MANAGEMENT
// =============================================

async function loadWisata() {
    const table = document.getElementById('wisataTable');
    if (!table) return;
    table.innerHTML = '<tr><td colspan="6" class="text-center">Memuat data wisata...</td></tr>';
    
    try {
        const result = await apiCall('get_admin_wisata');
        if (result.success) {
            AppState.allWisata = result.data;
            renderWisataTable(result.data);
        } else {
            throw new Error(result.message || 'Gagal memuat data wisata');
        }
    } catch (error) {
        console.error('Load wisata error:', error);
        table.innerHTML = `<tr><td colspan="6" class="text-center error-message"><i class="fas fa-exclamation-triangle"></i> ${error.message}</td></tr>`;
    }
}

function renderWisataTable(wisataList) {
    const table = document.getElementById('wisataTable');
    if (!wisataList || wisataList.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada data wisata</td></tr>';
        return;
    }
    table.innerHTML = wisataList.map(wisata => `
        <tr>
            <td>
                <div class="wisata-info">
                    <img src="${wisata.gambar_url || 'https://via.placeholder.com/100'}" alt="${wisata.nama}" class="wisata-thumb" onerror="this.src='https://via.placeholder.com/100'">
                    <span>${wisata.nama || '-'}</span>
                </div>
            </td>
            <td><span class="status-badge status-info">${wisata.kategori || '-'}</span></td>
            <td>${wisata.lokasi || '-'}</td>
            <td>${formatRupiah(wisata.harga_tiket)}</td>
            <td><span class="status-badge ${wisata.is_active == 1 ? 'status-active' : 'status-inactive'}">${wisata.is_active == 1 ? 'Aktif' : 'Nonaktif'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-edit" onclick="AdminApp.editWisata(${wisata.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="AdminApp.deleteWisata(${wisata.id})" title="Hapus"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function newWisata() {
    AppState.currentEditingId = null;
    clearWisataForm();
    document.getElementById('wisataFormTitle').textContent = 'Tambah Wisata Baru';
    showEditPage('wisata');
}

function closeWisata() {
    closeEditPage('wisata');
}

function clearWisataForm() {
    const form = document.getElementById('wisataForm');
    if (form) form.reset();
    document.getElementById('wStatus').value = '1';

    // UX: Sembunyikan preview saat form di-reset
    const previewContainer = document.getElementById('wGambarPreviewContainer');
    if (previewContainer) previewContainer.style.display = 'none';
}

async function editWisata(id) {
    try {
        const result = await apiCall('get_admin_wisata', { id: id });
        if (result.success && result.data) {
            AppState.currentEditingId = id;
            populateWisataForm(result.data);
            document.getElementById('wisataFormTitle').textContent = 'Edit Wisata';
            showEditPage('wisata');
        } else {
            throw new Error(result.message || 'Data wisata tidak ditemukan');
        }
    } catch (error) {
        console.error('Edit wisata error:', error);
        showNotification(error.message, 'error');
    }
}

function populateWisataForm(wisata) {
    const fields = {
        'wNama': wisata.nama, 'wKategori': wisata.kategori, 'wLokasi': wisata.lokasi,
        'wHarga': wisata.harga_tiket, 'wGambar': wisata.gambar_url, 'wDesc': wisata.deskripsi,
        'wFasilitas': wisata.fasilitas, 'wTips': wisata.tips, 'wLatitude': wisata.latitude,
        'wLongitude': wisata.longitude, 'wStatus': wisata.is_active
    };
    Object.entries(fields).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value || '';
    });

    // UX: Tampilkan preview gambar
    const previewImg = document.getElementById('wGambarPreview');
    const previewContainer = document.getElementById('wGambarPreviewContainer');
    
    if (wisata.gambar_url) {
        previewImg.src = wisata.gambar_url;
        previewContainer.style.display = 'block';
    } else {
        previewContainer.style.display = 'none';
        previewImg.src = '';
    }
}

async function saveWisata() {
    if (!validateWisataForm()) return;
    const formData = {
        nama: document.getElementById('wNama').value.trim(),
        kategori: document.getElementById('wKategori').value,
        lokasi: document.getElementById('wLokasi').value.trim(),
        harga_tiket: parseInt(document.getElementById('wHarga').value) || 0,
        gambar_url: document.getElementById('wGambar').value.trim(),
        deskripsi: document.getElementById('wDesc').value.trim(),
        fasilitas: document.getElementById('wFasilitas').value.trim(),
        tips: document.getElementById('wTips').value.trim(),
        latitude: document.getElementById('wLatitude').value.trim() || null,
        longitude: document.getElementById('wLongitude').value.trim() || null,
        is_active: parseInt(document.getElementById('wStatus').value)
    };
    if (AppState.currentEditingId) formData.id = AppState.currentEditingId;
    
    try {
        const result = await apiCall('save_wisata', formData);
        if (result.success) {
            showNotification(result.message || 'Wisata berhasil disimpan', 'success');
            closeEditPage('wisata');
            loadWisata();
            loadDashboardData();
        } else {
            throw new Error(result.message || 'Gagal menyimpan wisata');
        }
    } catch (error) {
        console.error('Save wisata error:', error);
        showNotification(error.message, 'error');
    }
}

function validateWisataForm() {
    const requiredFields = ['wNama', 'wKategori', 'wLokasi', 'wHarga'];
    let isValid = true;
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = '#e74c3c';
        } else {
            field.style.borderColor = '';
        }
    });
    if (!isValid) showNotification('Harap lengkapi semua field yang wajib diisi!', 'error');
    return isValid;
}

async function deleteWisata(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus wisata ini? Ini tidak bisa dibatalkan.')) return;
    try {
        const result = await apiCall('delete_wisata', { id: id }); 
        if (result.success) {
            showNotification('Wisata berhasil dihapus', 'success');
            loadWisata();
            loadDashboardData();
        } else {
            throw new Error(result.message || 'Gagal menghapus wisata');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}


// =============================================
// 6. TIKET MANAGEMENT
// =============================================

async function loadTiket() {
    const table = document.getElementById('tiketTable');
    table.innerHTML = '<tr><td colspan="7" class="text-center">Memuat data tiket...</td></tr>';
    
    // Mengambil nilai dari filter
    const tanggal = document.getElementById('filterTanggal').value;
    const status = document.getElementById('filterStatus').value;
    
    const filterData = {};
    if (tanggal) filterData.tanggal = tanggal;
    if (status) filterData.status = status;

    try {
        const result = await apiCall('get_tiket', filterData);
        if (result.success) {
            renderTiketTable(result.data);
        } else {
            throw new Error(result.message || 'Gagal memuat data tiket');
        }
    } catch (error) {
        console.error('Load tiket error:', error);
        table.innerHTML = `<tr><td colspan="7" class="text-center error-message"><i class="fas fa-exclamation-triangle"></i> ${error.message}</td></tr>`;
    }
}

function renderTiketTable(tiketList) {
    const table = document.getElementById('tiketTable');
    if (!tiketList || tiketList.length === 0) {
        table.innerHTML = '<tr><td colspan="7" class="text-center">Belum ada data tiket</td></tr>';
        return;
    }
    table.innerHTML = tiketList.map(tiket => `
        <tr>
            <td>${tiket.kode_tiket || '-'}</td>
            <td>${tiket.wisata_nama || '-'}</td>
            <td>${new Date(tiket.tanggal_berkunjung).toLocaleDateString('id-ID')}</td>
            <td>${tiket.jumlah_tiket || 0}</td>
            <td>${formatRupiah(tiket.total_harga)}</td>
            <td><span class="status-badge status-${tiket.status}">${tiket.status || 'unknown'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-validate" onclick="AdminApp.validateTiket('${tiket.kode_tiket}')" ${tiket.status !== 'paid' ? 'disabled' : ''}>
                        <i class="fas fa-check"></i> Validasi
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function validateTiket() {
    const kodeTiket = document.getElementById('kodeTiket').value;
    if (!kodeTiket) {
        showNotification('Masukkan kode tiket', 'error');
        return;
    }

    try {
        const result = await apiCall('validate_tiket', { kode_tiket: kodeTiket });
        if (result.success) {
            showNotification('Tiket berhasil divalidasi', 'success');
            loadTiket(); // Muat ulang daftar tiket
            document.getElementById('kodeTiket').value = ''; // Kosongkan input
        } else {
            throw new Error(result.message || 'Gagal memvalidasi tiket');
        }
    } catch (error) {
        console.error('Validate tiket error:', error);
        showNotification(error.message, 'error');
    }
}

// =============================================
// 7. BLOG MANAGEMENT
// =============================================

async function loadBlog() {
    const table = document.getElementById('blogTable');
    if (!table) return;
    table.innerHTML = '<tr><td colspan="5" class="text-center">Memuat data artikel...</td></tr>';
    
    try {
        const result = await apiCall('get_admin_blog');
        if (result.success) {
            renderBlogTable(result.data);
        } else {
            throw new Error(result.message || 'Gagal memuat artikel');
        }
    } catch (error) {
        table.innerHTML = `<tr><td colspan="5" class="text-center error-message"><i class="fas fa-exclamation-triangle"></i> ${error.message}</td></tr>`;
    }
}

function renderBlogTable(blogList) {
    const table = document.getElementById('blogTable');
    if (!blogList || blogList.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada artikel</td></tr>';
        return;
    }
    table.innerHTML = blogList.map(blog => `
        <tr>
            <td>${blog.judul || '-'}</td>
            <td>${blog.penulis_name || 'N/A'}</td>
            <td>
                <span class="status-badge status-${blog.status}">
                    ${blog.status}
                </span>
            </td>
            <td>${new Date(blog.created_at).toLocaleDateString('id-ID')}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-edit" onclick="AdminApp.editBlog(${blog.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="AdminApp.deleteBlog(${blog.id})" title="Hapus"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function newBlog() {
    AppState.currentEditingId = null;
    clearBlogForm();
    document.getElementById('blogFormTitle').textContent = 'Tulis Artikel Baru';
    showEditPage('blog');
}

function closeBlog() {
    closeEditPage('blog');
}

function clearBlogForm() {
    const form = document.getElementById('blogForm');
    if (form) form.reset();
    document.getElementById('bStatus').value = 'published';
}

async function editBlog(id) {
    try {
        const result = await apiCall('get_admin_blog', { id: id });
        if (result.success && result.data) {
            AppState.currentEditingId = id;
            document.getElementById('bJudul').value = result.data.judul;
            document.getElementById('bKategori').value = result.data.kategori;
            document.getElementById('bKonten').value = result.data.konten;
            document.getElementById('bExcerpt').value = result.data.excerpt;
            document.getElementById('bGambar').value = result.data.gambar_url;
            document.getElementById('bStatus').value = result.data.status;
            document.getElementById('blogFormTitle').textContent = 'Edit Artikel';
            showEditPage('blog');
        } else {
            throw new Error('Gagal memuat data artikel');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function saveBlog() {
    const formData = {
        judul: document.getElementById('bJudul').value,
        kategori: document.getElementById('bKategori').value,
        konten: document.getElementById('bKonten').value,
        excerpt: document.getElementById('bExcerpt').value,
        gambar_url: document.getElementById('bGambar').value,
        status: document.getElementById('bStatus').value
    };
    if (AppState.currentEditingId) formData.id = AppState.currentEditingId;
    
    try {
        const result = await apiCall('save_blog', formData);
        if (result.success) {
            showNotification(result.message, 'success');
            closeEditPage('blog');
            loadBlog();
            loadDashboardData();
        } else {
            throw new Error(result.message || 'Gagal menyimpan artikel');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteBlog(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus artikel ini?')) return;
    try {
        const result = await apiCall('delete_blog', { id: id });
        if (result.success) {
            showNotification(result.message, 'success');
            loadBlog();
            loadDashboardData();
        } else {
            throw new Error(result.message || 'Gagal menghapus artikel');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// =============================================
// 8. MITRA MANAGEMENT
// =============================================

async function loadMitra() {
    const table = document.getElementById('mitraTable');
    if (!table) return;
    table.innerHTML = '<tr><td colspan="5" class="text-center">Memuat data mitra...</td></tr>';
    
    try {
        const [mitraResult, wisataResult] = await Promise.all([
            apiCall('get_mitra'),
            apiCall('get_admin_wisata')
        ]);

        if (mitraResult.success) {
            renderMitraTable(mitraResult.data);
        } else {
            throw new Error(mitraResult.message || 'Gagal memuat data mitra');
        }
        
        if (wisataResult.success) {
            AppState.allWisata = wisataResult.data;
            populateWisataDropdown('mWisataId');
        }

    } catch (error) {
        table.innerHTML = `<tr><td colspan="5" class="text-center error-message"><i class="fas fa-exclamation-triangle"></i> ${error.message}</td></tr>`;
    }
}

function renderMitraTable(mitraList) {
    const table = document.getElementById('mitraTable');
    if (!mitraList || mitraList.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada data mitra</td></tr>';
        return;
    }
    table.innerHTML = mitraList.map(mitra => `
        <tr>
            <td>${mitra.nama_mitra || '-'}</td>
            <td>${mitra.username || '-'}</td>
            <td>${mitra.wisata_nama || '<span class="status-badge status-inactive">Belum terhubung</span>'}</td>
            <td><span class="status-badge ${mitra.layanan === 'active' ? 'status-active' : 'status-inactive'}">${mitra.layanan === 'active' ? 'Aktif' : 'Tidak Aktif'}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-edit" onclick="AdminApp.editMitra(${mitra.id})" title="Edit"><i class="fas fa-edit"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function newMitra() {
    AppState.currentEditingId = null;
    clearMitraForm();
    document.getElementById('mitraFormTitle').textContent = 'Tambah Mitra Baru';
    document.getElementById('mPassword').placeholder = "Wajib diisi";
    showEditPage('mitra');
}

function closeMitra() {
    closeEditPage('mitra');
}

function clearMitraForm() {
    const form = document.getElementById('mitraForm');
    if (form) form.reset();
    document.getElementById('mStatus').value = '1';
}

async function editMitra(id) {
    try {
        const result = await apiCall('get_mitra', { id: id });
        if (result.success && result.data) {
            AppState.currentEditingId = id;
            document.getElementById('mNama').value = result.data.nama_mitra;
            document.getElementById('mUsername').value = result.data.username;
            document.getElementById('mWisataId').value = result.data.wisata_id || "";
            // REVISI: Konversi 'layanan' dari DB ke '1'/'0' untuk form
            document.getElementById('mStatus').value = result.data.layanan === 'active' ? '1' : '0';
            document.getElementById('mPassword').placeholder = "Kosongkan jika tidak ingin diubah";
            document.getElementById('mitraFormTitle').textContent = 'Edit Mitra';
            showEditPage('mitra');
        } else {
            throw new Error('Gagal memuat data mitra');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function saveMitra() {
    const formData = {
        nama_mitra: document.getElementById('mNama').value,
        username: document.getElementById('mUsername').value,
        password: document.getElementById('mPassword').value,
        wisata_id: document.getElementById('mWisataId').value || null,
        is_active: parseInt(document.getElementById('mStatus').value) // 'is_active' (1/0) akan dikonversi di API
    };
    
    if (AppState.currentEditingId) {
        formData.id = AppState.currentEditingId;
    } else {
        if (!formData.password) {
            showNotification('Password wajib diisi untuk mitra baru!', 'error');
            return;
        }
    }
    
    try {
        const result = await apiCall('save_mitra', formData);
        if (result.success) {
            showNotification(result.message, 'success');
            closeEditPage('mitra');
            loadMitra();
            loadDashboardData();
        } else {
            throw new Error(result.message || 'Gagal menyimpan data mitra');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function populateWisataDropdown(elementId) {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Pilih Wisata --</option>';
    AppState.allWisata.forEach(wisata => {
        const option = document.createElement('option');
        option.value = wisata.id;
        option.textContent = wisata.nama;
        select.appendChild(option);
    });
}


// =============================================
// 9. PROMO MANAGEMENT
// =============================================

async function loadPromo() {
    const table = document.getElementById('promoTable');
    if (!table) return;
    table.innerHTML = '<tr><td colspan="6" class="text-center">Memuat data promo...</td></tr>';
    
    try {
        const [promoResult, wisataResult] = await Promise.all([
            apiCall('get_admin_promo'),
            apiCall('get_admin_wisata')
        ]);

        if (promoResult.success) {
            renderPromoTable(promoResult.data);
        } else {
            throw new Error(promoResult.message || 'Gagal memuat data promo');
        }
        
        if (wisataResult.success) {
            AppState.allWisata = wisataResult.data;
            populateWisataDropdown('pWisataId');
        }

    } catch (error) {
        table.innerHTML = `<tr><td colspan="6" class="text-center error-message"><i class="fas fa-exclamation-triangle"></i> ${error.message}</td></tr>`;
    }
}

function renderPromoTable(promoList) {
    const table = document.getElementById('promoTable');
    if (!promoList || promoList.length === 0) {
        table.innerHTML = '<tr><td colspan="6" class="text-center">Belum ada data promo</td></tr>';
        return;
    }
    table.innerHTML = promoList.map(promo => {
        let diskon = promo.jenis_diskon === 'persen' ? `${promo.nilai_diskon}%` : formatRupiah(promo.nilai_diskon);
        return `
            <tr>
                <td>${promo.nama_promo}</td>
                <td>${promo.wisata_nama || 'Semua Wisata'}</td>
                <td><span class="status-badge status-pending">${diskon}</span></td>
                <td>${new Date(promo.tanggal_berakhir).toLocaleDateString('id-ID')}</td>
                <td><span class="status-badge ${promo.status === 'active' ? 'status-active' : 'status-inactive'}">${promo.status}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-edit" onclick="AdminApp.editPromo(${promo.id})" title="Edit"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-danger" onclick="AdminApp.deletePromo(${promo.id})" title="Hapus"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function newPromo() {
    AppState.currentEditingId = null;
    clearPromoForm();
    document.getElementById('promoFormTitle').textContent = 'Tambah Promo Baru';
    showEditPage('promo');
}

function closePromo() {
    closeEditPage('promo');
}

function clearPromoForm() {
    const form = document.getElementById('promoForm');
    if (form) form.reset();
    document.getElementById('pJenis').value = 'persen';
    document.getElementById('pStatus').value = 'active';
}

async function editPromo(id) {
    try {
        const result = await apiCall('get_admin_promo', { id: id });
        if (result.success && result.data) {
            AppState.currentEditingId = id;
            document.getElementById('pNama').value = result.data.nama_promo;
            document.getElementById('pWisataId').value = result.data.wisata_id || "";
            document.getElementById('pJenis').value = result.data.jenis_diskon;
            document.getElementById('pNilai').value = result.data.nilai_diskon;
            document.getElementById('pTanggal').value = result.data.tanggal_berakhir;
            document.getElementById('pStatus').value = result.data.status;
            document.getElementById('promoFormTitle').textContent = 'Edit Promo';
            showEditPage('promo');
        } else {
            throw new Error('Gagal memuat data promo');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function savePromo() {
    const formData = {
        nama_promo: document.getElementById('pNama').value,
        wisata_id: document.getElementById('pWisataId').value || null,
        jenis_diskon: document.getElementById('pJenis').value,
        nilai_diskon: document.getElementById('pNilai').value,
        tanggal_berakhir: document.getElementById('pTanggal').value,
        status: document.getElementById('pStatus').value
    };
    
    if (AppState.currentEditingId) formData.id = AppState.currentEditingId;
    
    try {
        const result = await apiCall('save_promo', formData);
        if (result.success) {
            showNotification(result.message, 'success');
            closeEditPage('promo');
            loadPromo();
        } else {
            throw new Error(result.message || 'Gagal menyimpan promo');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deletePromo(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus promo ini?')) return;
    try {
        const result = await apiCall('delete_promo', { id: id });
        if (result.success) {
            showNotification(result.message, 'success');
            loadPromo();
        } else {
            throw new Error(result.message || 'Gagal menghapus promo');
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// =============================================
// 10. LAPORAN
// =============================================

async function loadLaporan() {
    const bulanInput = document.getElementById('filterBulan');
    const bulan = bulanInput.value; // Format: YYYY-MM

    if (!bulan) {
        showNotification('Silakan pilih bulan terlebih dahulu', 'error');
        return;
    }

    const table = document.getElementById('laporanTable');
    if (!table) return;
    table.innerHTML = '<tr><td colspan="4" class="text-center">Memuat data laporan...</td></tr>';

    try {
        const result = await apiCall('get_laporan_penjualan', { bulan: bulan });
        if (result.success) {
            renderLaporanTable(result.data);
        } else {
            throw new Error(result.message || 'Gagal memuat laporan');
        }
    } catch (error) {
        table.innerHTML = `<tr><td colspan="4" class="text-center error-message"><i class="fas fa-exclamation-triangle"></i> ${error.message}</td></tr>`;
        document.getElementById('laporanTotalPendapatan').textContent = 'Rp 0';
    }
}


function renderLaporanTable(laporanData) {
    const table = document.getElementById('laporanTable');
    let totalPendapatan = 0;

    if (!laporanData || laporanData.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="text-center">Tidak ada data penjualan untuk bulan ini.</td></tr>';
        document.getElementById('laporanTotalPendapatan').textContent = 'Rp 0';
        return;
    }

    table.innerHTML = laporanData.map(item => {
        totalPendapatan += parseFloat(item.total_pendapatan);
        return `
            <tr>
                <td>${new Date(item.tanggal).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                <td>${item.wisata_nama || 'N/A'}</td>
                <td>${item.total_tiket}</td>
                <td>${AdminApp.formatRupiah(item.total_pendapatan)}</td>
            </tr>
        `;
    }).join('');

    // Update total pendapatan
    document.getElementById('laporanTotalPendapatan').textContent = AdminApp.formatRupiah(totalPendapatan);
}
// =============================================
// 11. HELPER FUNCTIONS
// =============================================

function showEditPage(type) {
    document.querySelectorAll('[id$="-list"]').forEach(page => page.classList.add('hidden'));
    document.querySelectorAll('[id$="-edit"]').forEach(page => page.classList.add('hidden'));
    
    const editPage = document.getElementById(`page-${type}-edit`);
    if (editPage) {
        editPage.classList.remove('hidden');
    }
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = AppState.currentEditingId ? 
            `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}` : 
            `Tambah ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    }
}

function closeEditPage(type) {
    const editPage = document.getElementById(`page-${type}-edit`);
    const listPage = document.getElementById(`page-${type}-list`);
    
    if (editPage) editPage.classList.add('hidden');
    if (listPage) listPage.classList.remove('hidden');
    
    AppState.currentEditingId = null;
    updatePageTitle(type);
}

// =============================================
// 12. INITIALIZATION
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Dashboard Initializing...');
    initializeEventListeners();
    checkAuthState();
    checkFontAwesomeLoaded();
    console.log('✅ Admin Dashboard Initialized');
});

function initializeEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) logoutLink.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });
    
    const navItems = document.querySelectorAll('.nav-item');
    const sidebar = document.querySelector('.sidebar');

    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            if (page) showPage(page);
            
            // Tutup sidebar di mobile setelah navigasi
            if (window.innerWidth <= 768) {
                if (sidebar) sidebar.classList.remove('open');
            }
        });
    });
    
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', () => userDropdown.classList.toggle('show'));
        document.addEventListener('click', (e) => {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });
    }

    // Mobile Menu Toggle Logic
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const mainContent = document.querySelector('.main-content');
    
    if (menuToggleBtn && sidebar && mainContent) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
        
        // Tutup sidebar jika mengklik di luar sidebar (di main-content) saat terbuka
        mainContent.addEventListener('click', (e) => {
             if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                if (!e.target.closest('.sidebar')) { 
                    sidebar.classList.remove('open');
                }
            }
        });
    }
}

function checkFontAwesomeLoaded() {
    setTimeout(() => {
        const testIcon = document.createElement('i');
        testIcon.className = 'fas fa-test';
        testIcon.style.display = 'none';
        document.body.appendChild(testIcon);
        const computedStyle = window.getComputedStyle(testIcon, '::before');
        const content = computedStyle.content;
        if (content === 'none' || content === '') {
            console.warn('❌ Font Awesome failed to load, using fallback');
            document.body.classList.add('font-awesome-failed');
        } else {
            console.log('✅ Font Awesome loaded successfully');
        }
        document.body.removeChild(testIcon);
    }, 1000);
}

// =============================================
// 13. GLOBAL EXPORT
// =============================================
window.AdminApp = {
    apiCall, showNotification, formatRupiah, loadDashboardData, loadWisata, loadBlog, loadMitra,
    loadTiket, loadPromo, loadLaporan, handleLogin, handleLogout, checkAuthState,
    newWisata, saveWisata, editWisata, deleteWisata, closeWisata,
    validateTiket,
    newBlog, saveBlog, editBlog, deleteBlog, closeBlog,
    newMitra, saveMitra, editMitra, closeMitra,
    newPromo, savePromo, editPromo, deletePromo, closePromo,
    config: CONFIG,
    state: AppState
};