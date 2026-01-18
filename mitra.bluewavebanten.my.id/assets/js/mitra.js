// mitra.js - VERSI FINAL (Perbaikan Bug Token & Implementasi Promo)
// ======================================================

// --- Konfigurasi dan State Global ---
const API_AUTH_BASE = 'https://bluewavebanten.my.id/api/'; 
const API_BASE = 'https://bluewavebanten.my.id/api/'; 

let currentUser = null;
let currentToken = null;
let isLoggedIn = false;
let myWisataData = null; 
let map = null;
let marker = null;
let currentEditingId = null; // Untuk Promo/Profil

// --- 1. Fungsi Utility API dan Notifikasi ---

async function apiCall(endpoint, options = {}) {
    let url = API_BASE + `api.php?action=${endpoint}`;
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    const config = { ...defaultOptions, ...options };
    
    // Tambahkan token ke body jika bukan GET
    let bodyData = options.body || {};
    if (config.method.toUpperCase() !== 'GET') {
        if (currentToken) {
            bodyData.token = currentToken;
        }
        config.body = JSON.stringify(bodyData);
    }
    
    // Kirim params ke URL (untuk GET_MY_TIKET, dll)
    if (options.params) {
        const urlParams = new URLSearchParams(options.params).toString();
        url += (url.includes('?') ? '&' : '?') + urlParams;
    }

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            console.warn('Sesi Token Kedaluwarsa. Membersihkan local storage.');
            localStorage.removeItem('bluewave_mitra_token'); 
            localStorage.removeItem('bluewave_mitra'); 
            showLogin();
            return { success: false, message: 'Unauthorized' };
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
             return await response.json();
        } else {
            const errorText = await response.text();
            console.error('Server returned non-JSON response:', errorText);
            return { success: false, message: 'Server error atau respons tidak valid.' };
        }

    } catch (error) {
        console.error('API call error:', error);
        return { success: false, message: 'Terjadi kesalahan koneksi ke server.' };
    }
}


function showNotification(message, type = 'success') {
    document.querySelectorAll('.notification').forEach(notif => notif.remove());
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount || 0);
}


// --- 2. Fungsi Autentikasi dan Routing Halaman ---

function checkAuthState() {
    const savedUser = localStorage.getItem('bluewave_mitra');
    const savedToken = localStorage.getItem('bluewave_mitra_token');
    
    if (savedUser && savedUser !== "undefined" && savedToken) {
        try {
            currentUser = JSON.parse(savedUser);
            currentToken = savedToken;
            isLoggedIn = true;
            showDashboard();
        } catch (e) {
            localStorage.removeItem('bluewave_mitra');
            localStorage.removeItem('bluewave_mitra_token');
            showLogin();
        }
    } else {
        localStorage.removeItem('bluewave_mitra');
        localStorage.removeItem('bluewave_mitra_token');
        showLogin();
    }
}
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    const loginBtn = document.getElementById('loginBtn');
    const loginSpinner = document.getElementById('loginSpinner');
    const loginText = document.getElementById('loginText');
    
    loginSpinner.style.display = 'inline-block';
    loginText.textContent = 'Memproses...';
    loginBtn.disabled = true;

    try {
        const response = await fetch(API_AUTH_BASE + 'auth.php?action=mitra_login', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();
        
        if (result.success) {
            if (!result.token || !result.user) {
                throw new Error('Token atau data user tidak diterima.'); 
            }

            currentUser = result.user;
            currentToken = result.token;
            
            localStorage.setItem('bluewave_mitra', JSON.stringify(currentUser));
            localStorage.setItem('bluewave_mitra_token', currentToken);
            isLoggedIn = true;
            
            showNotification('Login berhasil!', 'success');
            showDashboard();
        } else {
            showNotification(result.message || 'Login gagal!', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Terjadi kesalahan saat login: ' + error.message, 'error');
    } finally {
        loginSpinner.style.display = 'none';
        loginText.textContent = 'Masuk';
        loginBtn.disabled = false;
    }
}

// HANYA SATU FUNGSI handleLogout
function handleLogout(e) {
    if(e) e.preventDefault();

    apiCall('logout', { 
        method: 'POST',
        body: { user_id: currentUser?.id } 
    });
    
    localStorage.removeItem('bluewave_mitra');
    localStorage.removeItem('bluewave_mitra_token');
    
    currentUser = null;
    currentToken = null;
    isLoggedIn = false;
    showNotification('Anda telah logout', 'success');
    showLogin();
}

function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboardPage').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboardPage').style.display = 'block';
    
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
    }
    
    showPage('dashboard');
}

// --- FUNGSI SHOWPAGE (VERSI MITRA) ---
function showPage(page) {
    // 1. Reset nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }

    // 2. Sembunyiin semua
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // 3. Logika pindah halaman
    let pageId = `page-${page}`;
    if (page === 'profil') {
        pageId = 'page-profil-list';
    }
    if (page === 'promo') {
        pageId = 'page-promo-list';
    }


    // 4. Tunjukin section
    const pageElement = document.getElementById(pageId); 
    if (pageElement) {
        pageElement.classList.remove('hidden');
    }
    
    // 5. Ganti judul
    const pageTitleElement = document.getElementById('pageTitle');
    if (pageTitleElement) {
        pageTitleElement.textContent = navItem ? navItem.querySelector('span').textContent : 'Dashboard Mitra';
    }

    // 6. Tutup semua halaman editor
    const profilEdit = document.getElementById('page-profil-edit');
    if (profilEdit) profilEdit.classList.add('hidden');
    const promoEdit = document.getElementById('page-promo-edit');
    if (promoEdit) promoEdit.classList.add('hidden');


    // 7. Load data
    if (page === 'dashboard') loadDashboardData();
    if (page === 'validasi') loadTiket();
    if (page === 'laporan') {
        const laporanTable = document.getElementById('laporanTable');
        if (laporanTable) laporanTable.innerHTML = '<tr><td colspan="3" class="text-center">Pilih bulan untuk menampilkan laporan</td></tr>';
    }
    if (page === 'profil') loadProfil(true);
    if (page === 'promo') loadPromo();
}

function toggleUserDropdown() {
    document.getElementById('userDropdown').classList.toggle('show');
}


// --- 3. Fungsi Load Data & CRUD (VERSI MITRA) ---

// Dashboard Load
async function loadDashboardData() {
    try {
        const result = await apiCall('get_mitra_dashboard', { method: 'POST', body: {} });

        if (result.success && result.data) {
            const data = result.data;
            document.getElementById('count-tiket-hari-ini').textContent = data.tiket_hari_ini || '0';
            document.getElementById('count-tamu-checkin').textContent = data.tamu_checkin || '0';
            const pendapatan = data.pendapatan_bulan_ini ? parseInt(data.pendapatan_bulan_ini).toLocaleString('id-ID') : '0';
            document.getElementById('count-pendapatan-bulan').textContent = `Rp ${pendapatan}`;
            
            myWisataData = data.wisata_info;
            loadWeatherWidget();
            initializeMap();
        } else {
             showNotification(result.message || 'Gagal memuat ringkasan data.', 'error');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Widget Cuaca
async function loadWeatherWidget() {
    const widget = document.getElementById('weatherWidget');
    if (!myWisataData || !myWisataData.latitude || !myWisataData.longitude) {
        widget.innerHTML = 'Lokasi wisata belum diatur. Harap lengkapi profil Anda.';
        return;
    }
    widget.innerHTML = '<p class="text-center p-4">Memuat data cuaca...</p>'; 
    
    try {
        const lat = myWisataData.latitude;
        const lon = myWisataData.longitude;
        const weather = await apiCall('get_weather', { method: 'GET', params: { lat: lat, lon: lon } });
        
        if (weather.weather) {
            const tempRounded = Math.round(weather.main.temp);
            const descriptionCapitalized = weather.weather[0].description.charAt(0).toUpperCase() + weather.weather[0].description.slice(1);
            const mainDescription = weather.weather[0].description.toLowerCase();
            
            // --- LOGIKA PERINGATAN CUACA ---
            let warningStyle = `style="margin-top: 15px; padding: 10px; text-align: center; font-size: 0.9rem; border-radius: 8px; font-weight: 600;"`;
            let warningClass = ``;
            let warningText = ``;

            if (mainDescription.includes('hujan') || mainDescription.includes('badai') || mainDescription.includes('guntur')) {
                warningClass = `background-color: #fce7e7; color: #991b1b;`; // Merah
                warningText = `<i class="fas fa-umbrella-beach mr-2"></i> Peringatan: Cuaca buruk! Antisipasi pengunjung berkurang.`;
            } else if (mainDescription.includes('awan') || mainDescription.includes('mendung')) {
                warningClass = `background-color: #fffbeb; color: #b45309;`; // Kuning
                warningText = `<i class="fas fa-cloud mr-2"></i> Perhatian: Cuaca berawan. Pengunjung mungkin terpengaruh.`;
            } else {
                warningClass = `background-color: #d1fae5; color: #065f46;`; // Hijau
                warningText = `<i class="fas fa-sun mr-2"></i> Cuaca mendukung, operasional normal.`;
            }
            // --- AKHIR LOGIKA PERINGATAN ---

            widget.innerHTML = `
                <div>
                    <div style="display: flex; align-items: center; gap: 20px;">
                        <img src="https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png" alt="Weather icon">
                        <div>
                            <h3 style="font-size: 2rem; margin-bottom: 5px;">${tempRounded}&deg;C</h3> <p style="font-size: 1.1rem; color: var(--gray-600);">${descriptionCapitalized}</p>
                            <p style="color: var(--gray-700);">${myWisataData.nama}</p>
                        </div>
                    </div>
                    
                    <div ${warningStyle} style="${warningClass}">
                        ${warningText}
                    </div>
                </div>`;
        } else {
            widget.innerHTML = `<p class="text-center p-4 text-red-600">Gagal memuat cuaca. Cek API Key/Koneksi.</p>`;
        }
    } catch (error) {
        widget.innerHTML = `<p class="text-center p-4 text-red-600">Error koneksi ke API cuaca.</p>`;
    }
}

// TIKET FUNCTIONS - LOAD DATA
async function loadTiket() {
    const tiketTable = document.getElementById('tiketTable');
    if(tiketTable) tiketTable.innerHTML = '<tr><td colspan="5" class="text-center">Memuat data...</td></tr>';

    try {
        const result = await apiCall('get_my_tiket', { 
            method: 'POST',
            params: { tanggal: new Date().toISOString().split('T')[0] } 
        });
        
        if (result.success && Array.isArray(result.data)) {
            let html = '';
            if (result.data.length === 0) {
                html = '<tr><td colspan="5" class="text-center">Tidak ada booking tiket untuk hari ini</td></tr>';
            } else {
                html = result.data.map(tiket => `
                    <tr>
                        <td>${tiket.kode_tiket}</td>
                        <td>${new Date(tiket.tanggal_berkunjung).toLocaleDateString('id-ID')}</td>
                        <td>${tiket.jumlah_tiket}</td>
                        <td>
                            <span class="status-badge ${
                                tiket.status === 'paid' ? 'status-active' : 
                                tiket.status === 'pending' ? 'status-pending' : 
                                tiket.status === 'used' ? 'status-published' : 'status-inactive'
                            }">
                                ${tiket.status}
                            </span>
                        </td>
                        <td>
                            ${tiket.status === 'paid' ? `
                                <button class="btn btn-sm" onclick="validateSpecificTiket('${tiket.kode_tiket}')">
                                    <i class="fas fa-check"></i> Validasi
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
            }
            if(tiketTable) tiketTable.innerHTML = html;
        } else {
            showNotification(result.message || 'Gagal memuat data tiket.', 'error');
            if(tiketTable) tiketTable.innerHTML = '<tr><td colspan="5" class="text-center">Gagal memuat data</td></tr>';
        }
    } catch (error) {
        console.error('Error loading tiket:', error);
    }
}

// TIKET FUNCTIONS - VALIDASI
async function validateTiket() {
    const kodeTiket = document.getElementById('kodeTiket').value.trim();
    const resultDiv = document.getElementById('validationResult');
    
    if (!kodeTiket) {
        showNotification('Masukkan kode tiket terlebih dahulu', 'error');
        return;
    }
    
    resultDiv.classList.add('hidden');
    resultDiv.innerHTML = '';

    try {
        const result = await apiCall('validate_tiket', {
            method: 'POST',
            body: { kode_tiket: kodeTiket }
        });

        resultDiv.classList.remove('hidden');

        if (result.success) {
            resultDiv.innerHTML = `
                <div class="notification show success" style="transform: none; opacity: 1; max-width: 100%; border-left-color: var(--success); display:flex; align-items:center; gap: 10px;">
                    <i class="fas fa-check-circle"></i>
                    <span>
                        <strong>Tiket Berhasil Divalidasi</strong><br>
                        Kode: ${result.data.kode_tiket}<br>
                        Jumlah: ${result.data.jumlah_tiket} tiket
                    </span>
                </div>`;
            document.getElementById('kodeTiket').value = '';
            loadTiket(); 
            loadDashboardData(); 
        } else {
            resultDiv.innerHTML = `
                <div class="notification show error" style="transform: none; opacity: 1; max-width: 100%; border-left-color: var(--danger); display:flex; align-items:center; gap: 10px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>
                        <strong>Tiket Tidak Valid</strong><br>
                        ${result.message}
                    </span>
                </div>`;
        }
    } catch (error) {
        console.error('Error validating tiket:', error);
    }
}

async function validateSpecificTiket(kodeTiket) {
    document.getElementById('kodeTiket').value = kodeTiket;
    await validateTiket();
}

// LAPORAN FUNCTIONS
async function loadLaporan() {
    const filterBulan = document.getElementById('filterBulan').value;
    const laporanTable = document.getElementById('laporanTable');

    if (!filterBulan) {
        showNotification('Pilih bulan untuk menampilkan laporan', 'error');
        if(laporanTable) laporanTable.innerHTML = '<tr><td colspan="3" class="text-center">Pilih bulan untuk menampilkan laporan</td></tr>';
        return;
    }

    if(laporanTable) laporanTable.innerHTML = '<tr><td colspan="3" class="text-center"><span class="spinner"></span> Memuat laporan...</td></tr>';

    try {
        const result = await apiCall('get_my_laporan_bulanan', { 
            method: 'POST',
            params: { bulan: filterBulan } 
        });

        if (result.success && Array.isArray(result.data)) {
            const html = result.data.map(item => `
                <tr>
                    <td>${new Date(item.tanggal).toLocaleDateString('id-ID')}</td>
                    <td>${item.jumlah}</td>
                    <td>Rp ${parseInt(item.total).toLocaleString('id-ID')}</td>
                </tr>
            `).join('');

            if(laporanTable) laporanTable.innerHTML = html || '<tr><td colspan="3" class="text-center">Tidak ada transaksi berbayar di bulan ini.</td></tr>';
            
            showNotification('Laporan berhasil digenerate', 'success');
        } else {
             showNotification(result.message || 'Gagal memuat laporan.', 'error');
        }
    } catch (error) {
        console.error('Error loading laporan:', error);
    }
}

// --- FUNGSI PROFIL ---
async function loadProfil(isViewOnly = false) {
    try {
        const result = await apiCall('get_my_wisata', { method: 'POST', body: {} });
        
        if (result.success && result.data) {
            const wisata = result.data;
            myWisataData = wisata; 
            
            document.getElementById('wNama').value = wisata.nama || '';
            document.getElementById('wLokasi').value = wisata.lokasi || '';
            document.getElementById('wHarga').value = wisata.harga_tiket || '';
            document.getElementById('wGambar').value = wisata.gambar_url || '';
            document.getElementById('wDesc').value = wisata.deskripsi || '';
            document.getElementById('wFasilitas').value = wisata.fasilitas || '';
            document.getElementById('wTips').value = wisata.tips || '';
            
            const viewContainer = document.getElementById('page-profil-list').querySelector('.form-layout');
            if (viewContainer) {
                viewContainer.innerHTML = `
                    <div class="form-group"><label>Nama Wisata</label><input type="text" value="${wisata.nama || ''}" disabled></div>
                    <div class="form-group"><label>Lokasi</label><input type="text" value="${wisata.lokasi || ''}" disabled></div>
                    <div class="form-group"><label>Harga Tiket</label><input type="text" value="Rp ${parseInt(wisata.harga_tiket || 0).toLocaleString('id-ID')}" disabled></div>
                    <div class="form-group"><label>Deskripsi</label><textarea rows="4" disabled>${wisata.deskripsi || ''}</textarea></div>
                `;
            }
            
        } else {
            showNotification(result.message || 'Gagal memuat data profil.', 'error');
        }
    } catch (error) {
        console.error('Error loading profil:', error);
    }
}

function editProfil() {
    document.getElementById('profilFormTitle').textContent = 'Edit Profil Wisata';
    document.getElementById('page-profil-list').classList.add('hidden');
    document.getElementById('page-profil-edit').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'Edit Profil';
}

function closeProfil() {
    document.getElementById('page-profil-edit').classList.add('hidden');
    document.getElementById('page-profil-list').classList.remove('hidden');
    document.getElementById('pageTitle').textContent = 'Profil Wisata';
}

async function saveProfil() {
    const data = {
        harga_tiket: document.getElementById('wHarga').value,
        gambar_url: document.getElementById('wGambar').value,
        deskripsi: document.getElementById('wDesc').value,
        fasilitas: document.getElementById('wFasilitas').value,
        tips: document.getElementById('wTips').value
    };

    if (!data.harga_tiket) {
        showNotification('Harga tiket wajib diisi!', 'error');
        return;
    }

    try {
        const result = await apiCall('save_my_wisata', {
            method: 'POST',
            body: data 
        });

        if (result.success) {
            showNotification(result.message, 'success');
            closeProfil();
            loadProfil(true);
        } else {
            showNotification(result.message, 'error');
        }
    } catch (error) {
        console.error('Error saving profil:', error);
    }
}
// --- FUNGSI PETA BARU ---
function initializeMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || !myWisataData || !myWisataData.latitude) {
        return;
    }
    
    if (map) {
        map.remove();
        map = null;
    }
    
    const lat = parseFloat(myWisataData.latitude);
    const lon = parseFloat(myWisataData.longitude);

    if (isNaN(lat) || isNaN(lon)) {
        mapElement.innerHTML = '<p class="text-center text-gray-600 p-4">Koordinat lokasi belum diatur.</p>';
        return;
    }

    map = L.map('map').setView([lat, lon], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`<b>${myWisataData.nama}</b><br>Lokasi Wisata Anda.`)
        .openPopup();
}
// --- AKHIR FUNGSI PETA BARU ---


// --- PROMO FUNCTIONS (CRUD) ---

async function loadPromo() {
    const table = document.getElementById('promoTable');
    if (!table) return;
    table.innerHTML = '<tr><td colspan="5" class="text-center">Memuat data promo...</td></tr>';
    
    try {
        const result = await apiCall('get_my_promo', { method: 'POST', body: {} });

        if (result.success && Array.isArray(result.data)) {
            renderPromoTable(result.data);
        } else {
            throw new Error(result.message || 'Gagal memuat promo.');
        }
    } catch (error) {
        table.innerHTML = `<tr><td colspan="5" class="text-center error-message"><i class="fas fa-exclamation-triangle"></i> ${error.message}</td></tr>`;
    }
}

function renderPromoTable(promoList) {
    const table = document.getElementById('promoTable');
    if (!promoList || promoList.length === 0) {
        table.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada promo/bundling dibuat.</td></tr>';
        return;
    }
    table.innerHTML = promoList.map(promo => {
        const diskon = promo.jenis_diskon === 'persen' ? `${promo.nilai_diskon}%` : formatRupiah(promo.nilai_diskon);
        return `
            <tr>
                <td>${promo.nama_promo}</td>
                <td>${diskon}</td>
                <td>${new Date(promo.tanggal_berakhir).toLocaleDateString('id-ID')}</td>
                <td><span class="status-badge ${promo.status === 'active' ? 'status-active' : 'status-inactive'}">${promo.status}</span></td>
                <td>
                    <button class="btn btn-sm" onclick="editPromo(${promo.id})"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deletePromo(${promo.id})"><i class="fas fa-trash"></i> Hapus</button>
                </td>
            </tr>
        `;
    }).join('');
}

function newPromo() {
    currentEditingId = null; 
    document.getElementById('promoForm').reset();
    document.getElementById('promoFormTitle').textContent = 'Buat Bundling/Promo Baru';
    document.getElementById('page-promo-list').classList.add('hidden');
    document.getElementById('page-promo-edit').classList.remove('hidden');
}

function closePromo() {
    document.getElementById('page-promo-edit').classList.add('hidden');
    document.getElementById('page-promo-list').classList.remove('hidden');
    loadPromo();
}

async function editPromo(id) {
    // Memanggil action get_admin_promo dari api.php (yang sudah ada)
    try {
        const result = await apiCall('get_admin_promo', { params: { id: id }, method: 'GET' });
        
        if (result.success && result.data) {
            currentEditingId = id;
            document.getElementById('pNama').value = result.data.nama_promo;
            document.getElementById('pJenis').value = result.data.jenis_diskon;
            document.getElementById('pNilai').value = result.data.nilai_diskon;
            document.getElementById('pTanggal').value = result.data.tanggal_berakhir.split(' ')[0]; // Ambil hanya tanggal
            document.getElementById('pStatus').value = result.data.status;

            document.getElementById('promoFormTitle').textContent = 'Edit Promo';
            document.getElementById('page-promo-list').classList.add('hidden');
            document.getElementById('page-promo-edit').classList.remove('hidden');
        } else {
            showNotification('Data promo tidak ditemukan.', 'error');
        }
    } catch (error) {
        showNotification('Gagal memuat data edit.', 'error');
    }
}

async function savePromo() {
    const data = {
        nama_promo: document.getElementById('pNama').value,
        jenis_diskon: document.getElementById('pJenis').value,
        nilai_diskon: document.getElementById('pNilai').value,
        tanggal_berakhir: document.getElementById('pTanggal').value,
        status: document.getElementById('pStatus').value,
    };
    
    if (currentEditingId) data.id = currentEditingId;

    try {
        const result = await apiCall('save_my_promo', {
            method: 'POST',
            body: data 
        });

        if (result.success) {
            showNotification(result.message, 'success');
            closePromo();
        } else {
            showNotification(result.message || 'Gagal menyimpan promo.', 'error');
        }
    } catch (error) {
        showNotification('Gagal menyimpan promo.', 'error');
    }
}

async function deletePromo(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus promo ini?')) return;
    try {
        const result = await apiCall('delete_promo', {
            method: 'POST',
            body: { id: id }
        });
        if (result.success) {
            showNotification('Promo berhasil dihapus.', 'success');
            loadPromo();
        } else {
            showNotification(result.message || 'Gagal menghapus promo.', 'error');
        }
    } catch (error) {
        showNotification('Error koneksi saat menghapus promo.', 'error');
    }
}

// --- 5. Initialization ---

document.addEventListener('DOMContentLoaded', function() {
    checkAuthState();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    
    const userMenuBtn = document.getElementById('userMenuBtn');
    if (userMenuBtn) userMenuBtn.addEventListener('click', toggleUserDropdown);
    
    const logoutLink = document.getElementById('logoutLink');
    if (logoutLink) logoutLink.addEventListener('click', handleLogout);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            showPage(page);
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.user-menu')) {
            const dropdown = document.getElementById('userDropdown');
            if(dropdown) dropdown.classList.remove('show');
        }
    });
});