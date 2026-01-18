// user.js - LOGIKA USER DASHBOARD FINAL (REVISI LENGKAP DENGAN REKOMENDASI CUACA)
// =============================================

// --- Konfigurasi Global ---
let currentUser = null;
let currentToken = null;
let userLocation = null; 

// Pembelian Tiket State
let selectedWisata = null; 
let selectedDate = null;
let jumlahOrang = 1;
let selectedPaymentMethod = null;

// --- 1. Fungsi Utility API dan Notifikasi ---
async function apiCall(endpoint, options = {}) {
    if (typeof API_BASE === 'undefined') {
        console.error("API_BASE is not defined!");
        return { success: false, message: 'Configuration error: API endpoint not set.' };
    }
    
    let url = API_BASE + `api.php?action=${endpoint}`;
    
    const defaultOptions = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    const config = { ...defaultOptions, ...options };
    
    let bodyData = options.body || {};
    
    // ATUR ULANG METHOD DAN BODY UNTUK SEMUA USER/PRIVATE ACTIONS
    const needsPost = ['get_user_dashboard', 'get_user_tickets', 'get_user_history', 'get_user_reviews', 'get_user_favorites', 'toggle_favorite', 'save_user_profile', 'create_order', 'cancel_order'];
    
    if (needsPost.includes(endpoint) || (config.method.toUpperCase() === 'POST' && !['get_wisata', 'get_wisata_detail', 'get_wisata_forecast'].includes(endpoint))) {
        config.method = 'POST';
        if (currentToken) {
            bodyData.token = currentToken;
        }
        config.body = JSON.stringify(bodyData);
    }
    
    // Tambahkan parameter GET ke URL
    if (options.params) {
        Object.keys(options.params).forEach(key => {
            url += (url.includes('?') ? '&' : '?') + `${key}=${encodeURIComponent(options.params[key])}`;
        });
    }

    try {
        const response = await fetch(url, config);
        
        if (response.status === 401) {
            showNotification('Sesi berakhir. Silakan login kembali.', 'error');
            handleLogout();
            return { success: false, message: 'Sesi berakhir. Silakan login kembali.' };
        }
        
        const text = await response.text();
        try {
            const result = JSON.parse(text);
            return result;
        } catch (e) {
            console.error(`API call error on endpoint ${endpoint}: Failed to parse JSON. Response status: ${response.status}. Response text:`, text);
            if (response.status === 500) {
                 showNotification('API Error 500: Mohon cek log server PHP untuk detail kesalahan.', 'error');
            } else {
                 showNotification('Terjadi kesalahan koneksi server (Invalid Response).', 'error');
            }
            return { success: false, message: 'Terjadi kesalahan server (500). Cek log PHP.' };
        }

    } catch (error) {
        console.error('API call error:', error);
        showNotification('Terjadi kesalahan koneksi ke server.', 'error');
        return { success: false, message: 'Koneksi gagal.' };
    }
}

function showNotification(message, type = 'success') {
    console.log(`[NOTIF ${type.toUpperCase()}]: ${message}`);
    const notifEl = document.createElement('div');
    notifEl.className = `fixed top-4 right-4 z-[9999] p-4 rounded-xl shadow-2xl text-white font-semibold text-sm transition-all duration-300 transform translate-x-full ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`;
    notifEl.textContent = message;
    document.body.appendChild(notifEl);
    
    setTimeout(() => {
        notifEl.style.transform = 'translate-x-0';
    }, 10);
    
    setTimeout(() => {
        notifEl.style.transform = 'translate-x-full';
        setTimeout(() => notifEl.remove(), 300);
    }, 3000);
}

function formatRupiah(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount || 0);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius bumi dalam km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Jarak dalam km
}


// --- 2. Autentikasi & Routing ---
function checkAuthStatus() {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('auth_token');
    
    if (!user || !token) {
        window.location.href = 'login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(user);
        currentToken = token;
        
        const initial = currentUser.name.charAt(0).toUpperCase();
        document.getElementById('welcomeName').textContent = currentUser.name.split(' ')[0];
        document.getElementById('profileName').textContent = currentUser.name;
        document.getElementById('profileEmail').textContent = currentUser.email;
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userEmail').textContent = currentUser.email;
        document.getElementById('userAvatar').textContent = initial;
        document.getElementById('profileAvatar').textContent = initial;
        document.getElementById('sidebarUserName').textContent = currentUser.name;
        document.getElementById('sidebarUserEmail').textContent = currentUser.email;

        showPage('beranda');
    } catch (e) {
        handleLogout();
    }
}

function handleLogout() {
    localStorage.removeItem('user');
    localStorage.removeItem('auth_token');
    window.location.href = 'login.html';
}

function showPage(page) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    
    const targetSection = document.getElementById(page);
    const navItem = document.querySelector(`[data-section="${page}"]`);

    if (targetSection) {
        targetSection.classList.add('active');
        document.getElementById('pageTitle').textContent = navItem ? navItem.querySelector('span').textContent : 'Dashboard';
    }
    if (navItem) navItem.classList.add('active');

    if (page !== 'pembelian') {
        resetPurchaseState();
    }

    if (page === 'beranda') loadDashboardData();
    if (page === 'wisata') loadWisataList();
    if (page === 'tiket-saya') loadTiketSaya();
    if (page === 'profil') loadUserProfile();
    if (page === 'riwayat') loadRiwayat();
    if (page === 'favorit') loadFavorit();
    if (page === 'review') loadReview();
    if (page === 'pembelian') loadPilihWisataStep();
    if (page === 'bantuan') showNotification('Halaman Bantuan siap! Hubungi kontak yang tersedia.', 'info');
}

// --- 3. DASHBOARD LOGIC (BERANDA) ---
async function loadDashboardData() {
    const statsResult = await apiCall('get_user_dashboard');
    
    if (statsResult.success && statsResult.data) {
        const data = statsResult.data;
        document.getElementById('totalTiketCount').textContent = data.total_tiket;
        document.getElementById('activeTiketCount').textContent = data.active_tiket;
        document.getElementById('totalSpent').textContent = formatRupiah(data.total_spent);
        document.getElementById('favoriteCount').textContent = data.favorite_count;
    } else {
        document.getElementById('totalTiketCount').textContent = '0';
        document.getElementById('activeTiketCount').textContent = '0';
        document.getElementById('totalSpent').textContent = formatRupiah(0);
        document.getElementById('favoriteCount').textContent = '0';
    }
    
    loadPromoFeatures();
    loadRecentActivity();
    
    await getCurrentLocation();
    if (userLocation) {
        loadNearbyWisata();
        initMap(); 
    }
}

async function getCurrentLocation() {
    const locationTextEl = document.getElementById('userLocationText');
    const weatherEl = document.getElementById('currentWeather');
    locationTextEl.textContent = 'Mendeteksi lokasi...';

    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
            });
            
            userLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
            locationTextEl.textContent = `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`;
            
            // Mengambil cuaca aktual di lokasi pengguna
            const weatherResult = await apiCall('get_weather', { params: userLocation, method: 'GET' });
            if (weatherResult.main) {
                const temp = Math.round(weatherResult.main.temp);
                const desc = weatherResult.weather[0].description;
                const icon = getWeatherIcon(weatherResult.weather[0].main);
                weatherEl.innerHTML = `<div class="flex items-center space-x-3 text-lg"><i class="fas ${icon} text-yellow-300 text-3xl"></i><span>${temp}°C, ${desc}</span></div>`;
            } else {
                weatherEl.innerHTML = '<div class="text-sm">Gagal memuat cuaca.</div>';
            }

            return userLocation;

        } catch (error) {
            locationTextEl.textContent = 'Lokasi tidak dapat dideteksi.';
            weatherEl.innerHTML = '<div class="text-sm">Gagal mendeteksi lokasi.</div>';
            userLocation = { lat: -6.17511, lon: 106.865 }; 
            return null;
        }
    } else {
        locationTextEl.textContent = 'Geolocation tidak didukung browser.';
        userLocation = { lat: -6.17511, lon: 106.865 }; 
        return null;
    }
}

function getWeatherIcon(main) {
    switch (main.toLowerCase()) {
        case 'clear': return 'fa-sun';
        case 'clouds': return 'fa-cloud-sun';
        case 'rain': 
        case 'drizzle': return 'fa-cloud-rain';
        case 'thunderstorm': return 'fa-bolt';
        case 'snow': return 'fa-snowflake';
        default: return 'fa-cloud';
    }
}

async function loadPromoFeatures() {
    const promoResult = await apiCall('get_promo', { method: 'GET' });
    const container = document.getElementById('promoWisata');
    container.innerHTML = '';
    
    if (promoResult.success && promoResult.data && promoResult.data.length > 0 && container) {
        container.innerHTML = promoResult.data.slice(0, 2).map(promo => `
            <div class="p-4 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 transition shadow-sm">
                <div class="flex justify-between items-center mb-1">
                    <h4 class="font-bold text-lg text-orange-700">${promo.nama_promo}</h4>
                    <span class="text-xs px-2 py-0.5 rounded-full bg-orange-200 text-orange-800">${promo.jenis_diskon === 'persen' ? `${promo.nilai_diskon}%` : 'Diskon Harga'}</span>
                </div>
                <p class="text-sm text-gray-700 truncate">${promo.nama_wisata}</p>
                <p class="text-xs text-gray-500 mt-2">Berakhir: ${new Date(promo.tanggal_berakhir).toLocaleDateString()}</p>
                <button class="mt-3 text-sm bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition font-semibold">Klaim</button>
            </div>
        `).join('');
    } else if (container) {
        container.innerHTML = '<p class="text-gray-500 col-span-full py-4 text-center">Tidak ada promo aktif saat ini.</p>';
    }
}

async function loadRecentActivity() {
    const summaryContainer = document.getElementById('recentTiketSummary');
    summaryContainer.innerHTML = '<p class="text-gray-500 py-8 text-center text-sm">Memuat ringkasan pembelian...</p>';
    
    const tiketResult = await apiCall('get_user_tickets');
    const activityContainer = document.getElementById('recentActivities');
    activityContainer.innerHTML = '';

    if (tiketResult.success && tiketResult.data && tiketResult.data.length > 0) {
        const recent = tiketResult.data.slice(0, 3);
        activityContainer.innerHTML = recent.map(t => `
            <li class="text-sm text-gray-700 flex items-center p-2 rounded hover:bg-gray-50">
                <i class="fas fa-receipt ${t.status === 'paid' ? 'text-green-500' : 'text-blue-500'} mr-3 w-4"></i> 
                ${t.status === 'paid' ? 'Pesan' : 'Digunakan'} ${t.jumlah_tiket} tiket **${t.wisata_name}**.
            </li>
        `).join('');
        summaryContainer.innerHTML = `<p class="text-gray-500 py-4 text-center text-sm">Anda memiliki **${recent.length}** transaksi terakhir.</p>`;
    } else {
        activityContainer.innerHTML = '<p class="text-gray-500 py-4 text-center text-sm">Belum ada aktivitas transaksi.</p>';
        summaryContainer.innerHTML = `<p class="text-gray-500 py-4 text-center text-sm">Belum ada ringkasan pembelian.</p>`;
    }
}


// --- 4. MAP & NEARBY WISATA ---

let mapInstance = null;
async function initMap() {
    if (!userLocation) return;
    
    if (mapInstance) {
        mapInstance.remove();
    }
    
    mapInstance = L.map('map').setView([userLocation.lat, userLocation.lon], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
    
    // Marker Lokasi User (Red)
    L.marker([userLocation.lat, userLocation.lon], { icon: new L.DivIcon({ className: 'red-dot-marker', html: '<div class="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-md"></div>' }) }).addTo(mapInstance)
        .bindPopup('Lokasi Anda').openPopup();

    // Load Wisata Markers
    const wisataResult = await apiCall('get_wisata');
    if (wisataResult.success && wisataResult.data) {
        wisataResult.data.forEach(w => {
            if (w.latitude && w.longitude) {
                const lat = parseFloat(w.latitude);
                const lon = parseFloat(w.longitude);
                if (!isNaN(lat) && !isNaN(lon)) {
                    const iconColor = w.is_favorite ? 'text-red-500' : 'text-blue-500';
                    L.marker([lat, lon]).addTo(mapInstance)
                        .bindPopup(`
                            <b>${w.nama}</b><br>
                            ${formatRupiah(w.harga_tiket)}<br>
                            <button onclick="selectWisataForPurchase(${w.id})" class="text-blue-500 font-semibold mt-1">Pesan Tiket</button>
                            <button onclick="toggleFavorite(${w.id})" class="ml-2 text-sm ${iconColor}"><i class="fas fa-heart"></i></button>
                        `);
                }
            }
        });
    }
}


async function loadNearbyWisata() {
    const container = document.getElementById('nearbyWisata');
    container.innerHTML = '<div class="text-center py-4"><div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div><p class="text-gray-500 text-sm">Mencari wisata terdekat...</p></div>';

    const wisataResult = await apiCall('get_wisata');
    
    if (wisataResult.success && wisataResult.data && userLocation) {
        const wisataDenganJarak = wisataResult.data
            .filter(w => w.latitude && w.longitude)
            .map(w => ({
                ...w,
                distance: calculateDistance(
                    userLocation.lat, userLocation.lon,
                    parseFloat(w.latitude), parseFloat(w.longitude)
                )
            }))
            .sort((a, b) => a.distance - b.distance);
            
        const nearby = wisataDenganJarak.slice(0, 5);
        
        container.innerHTML = nearby.map(w => `
            <div class="flex items-center space-x-4 p-3 rounded-xl hover:bg-gray-50 transition border border-gray-100">
                <img src="${w.gambar_url}" alt="${w.nama}" class="w-16 h-16 object-cover rounded-lg flex-shrink-0">
                <div class="flex-1">
                    <h5 class="font-semibold text-gray-800">${w.nama}</h5>
                    <p class="text-xs text-gray-500">${w.lokasi} (${w.distance.toFixed(1)} km)</p>
                    <p class="text-sm font-bold text-blue-600">${formatRupiah(w.harga_tiket)}</p>
                </div>
                <button onclick="selectWisataForPurchase(${w.id})" class="text-blue-500 hover:text-blue-700 flex-shrink-0">
                    <i class="fas fa-arrow-right"></i>
                </button>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-gray-500 py-4 text-center">Gagal memuat data wisata atau lokasi tidak terdeteksi.</p>';
    }
}


// --- 5. PAGE LOADERS & FINALIZATION (Revisi loadWisataList untuk Filter) ---

async function loadWisataList() {
    const container = document.getElementById('wisataList');
    container.innerHTML = `<div class="col-span-full text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div><p class="text-gray-500 text-sm">Memuat daftar wisata...</p></div>`;

    // Ambil nilai filter dari UI
    const search = document.getElementById('searchWisata').value.trim();
    const kategori = document.getElementById('filterKategori').value;
    const harga = document.getElementById('filterHarga').value;
    
    // Kirim filter sebagai parameter GET ke API
    const params = {};
    if (search) params.search = search;
    if (kategori) params.kategori = kategori;
    if (harga) params.harga = harga; 

    const wisataData = await apiCall('get_wisata', { params: params });
    
    if (wisataData.success && wisataData.data && container) {
        displayWisata(wisataData.data, container);
    } else if (container) {
        container.innerHTML = '<p class="text-gray-500 col-span-full py-8 text-center">Tidak ada wisata tersedia saat ini atau tidak cocok dengan filter.</p>';
    }
}

function displayWisata(data, container) {
    if (data.length === 0) {
         container.innerHTML = '<p class="text-gray-500 col-span-full py-8 text-center">Tidak ada wisata yang cocok dengan filter.</p>';
         return;
    }
    
    container.innerHTML = data.map(w => `
        <div class="bg-white rounded-xl shadow-md overflow-hidden card-hover border border-gray-100 relative">
            <img src="${w.gambar_url}" alt="${w.nama}" class="w-full h-40 object-cover">
            <button onclick="toggleFavorite(${w.id})" class="absolute top-3 right-3 p-2 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 transition shadow-md">
                <i id="fav-icon-${w.id}" class="fas fa-heart ${w.is_favorite ? 'text-red-500' : 'text-gray-400'}"></i>
            </button>
            <div class="p-4">
                <h5 class="font-bold text-lg text-gray-800">${w.nama}</h5>
                <p class="text-sm text-gray-600 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${w.lokasi}</p>
                <p class="text-xl font-bold text-blue-600">${formatRupiah(w.harga_tiket)}</p>
                <button onclick="selectWisataForPurchase(${w.id})" class="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold">Pesan Tiket</button>
            </div>
        </div>
    `).join('');
}

async function toggleFavorite(wisataId) {
    const icon = document.getElementById(`fav-icon-${wisataId}`);
    if (icon) icon.classList.add('fa-spin', 'text-yellow-500');

    const result = await apiCall('toggle_favorite', {
        method: 'POST',
        body: { wisata_id: wisataId }
    });
    
    if (icon) icon.classList.remove('fa-spin', 'text-yellow-500');

    if (result.success) {
        showNotification(result.message, 'success');
        if (icon) {
            if (result.action === 'added') {
                icon.classList.remove('text-gray-400');
                icon.classList.add('text-red-500', 'animate-bounce');
            } else {
                icon.classList.remove('text-red-500', 'animate-bounce');
                icon.classList.add('text-gray-400');
            }
        }
        
        loadDashboardData(); 
        if (document.getElementById('favorit')?.classList.contains('active')) {
            loadFavorit(); 
        } else if (document.getElementById('wisata')?.classList.contains('active')) {
            loadWisataList(); 
        }
    } else {
        showNotification(result.message || 'Gagal mengubah status favorit.', 'error');
    }
}

async function loadTiketSaya() {
    const container = document.getElementById('daftarTiket');
    container.innerHTML = `<div class="text-center py-8">Memuat data...</div>`;
    
    const tiketData = await apiCall('get_user_tickets');
    
    if (tiketData.success && tiketData.data && tiketData.data.length > 0) {
        container.innerHTML = tiketData.data.map(t => `
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm p-6" data-status="${t.status}">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="font-bold text-xl text-gray-800">${t.wisata_name}</h4>
                        <p class="text-gray-600">
                            <i class="fas fa-calendar-alt mr-2"></i>
                            ${new Date(t.tanggal_berkunjung).toLocaleDateString('id-ID', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            })}
                        </p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-sm font-semibold ${
                        t.status === 'paid' ? 'bg-green-100 text-green-800' :
                        t.status === 'used' ? 'bg-blue-100 text-blue-800' : 
                        t.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }">
                        ${t.status === 'paid' ? 'Aktif' : 
                          t.status === 'used' ? 'Terkunci' : 
                          t.status === 'cancelled' ? 'Dibatalkan' : 'Pending'}
                    </span>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-600">Kode Tiket</p>
                        <p class="font-mono font-bold text-lg text-blue-600">${t.kode_tiket}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-600">Jumlah Orang</p>
                        <p class="font-semibold">${t.jumlah_tiket} orang</p>
                    </div>
                </div>

                <div class="flex space-x-3">
                    <button onclick="showQRCode('${t.kode_tiket}', '${t.wisata_name}', ${t.jumlah_tiket})" 
                            class="flex-1 bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition font-semibold ${t.status !== 'paid' ? 'opacity-50 cursor-not-allowed' : ''}"
                            ${t.status !== 'paid' ? 'disabled' : ''}>
                        <i class="fas fa-qrcode mr-2"></i>Tampilkan QR
                    </button>
                    ${t.status === 'paid' && new Date(t.tanggal_berkunjung) >= new Date(new Date().setHours(0,0,0,0)) ? `<button onclick="handleCancelOrder(${t.id}, '${t.wisata_name}')" 
                            class="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition font-semibold">
                        <i class="fas fa-times-circle mr-2"></i>Batalkan
                    </button>` : `<button disabled class="flex-1 bg-gray-400 text-white py-2 rounded-lg cursor-not-allowed font-semibold">
                        <i class="fas fa-times-circle mr-2"></i>
                        ${t.status === 'cancelled' ? 'Dibatalkan' : 'Tidak Dapat Dibatalkan'}
                    </button>`}
                </div>
            </div>
        `).join('');
        
        filterTickets('all');
    } else {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-ticket-alt text-gray-300 text-5xl mb-4"></i>
                <p class="text-gray-500 text-lg">Belum ada tiket</p>
                <p class="text-gray-400 text-sm mt-2">Pesan tiket pertama Anda sekarang</p>
                <button onclick="showPage('pembelian')" class="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-semibold">
                    Pesan Tiket Sekarang
                </button>
            </div>
        `;
    }
}

function filterTickets(status) {
    document.querySelectorAll('#daftarTiket > div').forEach(ticketEl => {
        const ticketStatus = ticketEl.dataset.status;
        if (status === 'all' || 
            (status === 'active' && ticketStatus === 'paid') ||
            (status === 'used' && ticketStatus === 'used')) {
            ticketEl.style.display = 'block';
        } else {
            ticketEl.style.display = 'none';
        }
    });
    
    document.querySelectorAll('.filter-tiket').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-200', 'text-gray-700');
        if (btn.dataset.status === status) {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-gray-200', 'text-gray-700');
        }
    });
}

async function handleCancelOrder(id, name) {
    if (confirm(`Apakah Anda yakin ingin membatalkan tiket untuk ${name}? Pembatalan dapat dikenakan biaya administrasi.`)) {
        const result = await apiCall('cancel_order', {
            method: 'POST',
            body: { tiket_id: id }
        });
        if (result.success) {
            showNotification(result.message, 'success');
            loadTiketSaya(); 
            loadDashboardData(); 
        } else {
            showNotification(result.message || 'Gagal membatalkan tiket.', 'error');
        }
    }
}

async function loadRiwayat() {
    const container = document.getElementById('riwayatTransaksi');
    container.innerHTML = `<div class="text-center py-8">Memuat riwayat transaksi...</div>`;

    const riwayatData = await apiCall('get_user_history');
    
    if (riwayatData.success && riwayatData.data && riwayatData.data.length > 0) {
        container.innerHTML = riwayatData.data.map(r => `
            <div class="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center border border-gray-200">
                <div class="flex items-center space-x-3">
                    <i class="fas fa-exchange-alt text-xl ${r.status === 'paid' ? 'text-green-500' : r.status === 'cancelled' ? 'text-red-500' : 'text-yellow-500'}"></i>
                    <div>
                        <p class="font-semibold text-gray-800">${r.wisata_name} - #${r.kode_tiket}</p>
                        <p class="text-sm text-gray-500">Tanggal Transaksi: ${new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="font-bold ${r.status === 'cancelled' ? 'text-red-600' : 'text-blue-600'}">${formatRupiah(r.total_harga)}</p>
                    <span class="text-xs px-2 py-0.5 rounded-full ${r.status === 'paid' ? 'bg-green-100 text-green-800' : r.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${r.status.toUpperCase()}
                    </span>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-gray-500 py-8 text-center">Tidak ada riwayat transaksi.</p>';
    }
}

async function loadFavorit() {
    const container = document.getElementById('favoritContainer');
    container.innerHTML = `<div class="text-center py-8">Memuat wisata favorit...</div>`;
    
    const favoritData = await apiCall('get_user_favorites');
    
    if (favoritData.success && favoritData.data && favoritData.data.length > 0) {
        container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">` + favoritData.data.map(f => `
            <div class="bg-white rounded-xl shadow-md overflow-hidden card-hover border border-gray-100 relative">
                <img src="${f.gambar_url}" alt="${f.wisata_name}" class="w-full h-40 object-cover">
                 <button onclick="toggleFavorite(${f.id})" class="absolute top-3 right-3 p-2 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 transition shadow-md">
                    <i id="fav-icon-${f.id}" class="fas fa-heart text-red-500"></i>
                </button>
                <div class="p-4">
                    <h5 class="font-bold text-lg text-gray-800">${f.wisata_name}</h5>
                    <p class="text-sm text-gray-600 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${f.lokasi}</p>
                    <p class="text-xl font-bold text-blue-600">${formatRupiah(f.harga_tiket)}</p>
                    <button onclick="selectWisataForPurchase(${f.id})" class="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold">Pesan Tiket</button>
                </div>
            </div>
        `).join('') + `</div>`;
    } else {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-heart text-gray-300 text-5xl mb-4"></i>
                <p class="text-lg mb-2">Belum ada wisata favorit</p>
                <p class="text-sm mb-6">Tambahkan wisata ke favorit untuk mengaksesnya dengan mudah</p>
                <button id="exploreFavorit" class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold" onclick="showPage('wisata')">
                    <i class="fas fa-umbrella-beach mr-2"></i> Jelajahi Wisata
                </button>
            </div>
        `;
    }
}

async function loadReview() {
    const container = document.getElementById('reviewContainer');
    container.innerHTML = `<div class="text-center py-8">Memuat review...</div>`;
    
    const reviewData = await apiCall('get_user_reviews');
    
    if (reviewData.success && reviewData.data && reviewData.data.length > 0) {
         container.innerHTML = reviewData.data.map(r => `
            <div class="bg-white rounded-xl shadow-sm p-4 border border-gray-200 mb-4">
                <div class="flex items-center mb-2">
                    <div class="text-yellow-400 mr-2">${'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}</div>
                    <p class="font-semibold text-lg">${r.wisata_name}</p>
                </div>
                <p class="text-gray-700 text-sm">${r.review_text}</p>
                <p class="text-xs text-gray-500 mt-2">Ditulis pada: ${new Date(r.created_at).toLocaleDateString()}</p>
            </div>
        `).join('');
    } else {
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-star text-gray-300 text-5xl mb-4"></i>
                <p class="text-lg mb-2">Belum ada review</p>
                <p class="text-sm">Bagikan pengalaman Anda setelah mengunjungi wisata</p>
            </div>
        `;
    }
}


// --- 6. PEMBELIAN TIKET LOGIC (STEP-BY-STEP) ---

function resetPurchaseState() {
    selectedWisata = null;
    selectedDate = null;
    jumlahOrang = 1;
    selectedPaymentMethod = null;
    document.getElementById('jumlahOrangCount').textContent = 1;
    const tanggalBerangkatEl = document.getElementById('tanggalBerangkat');
    if(tanggalBerangkatEl) tanggalBerangkatEl.value = '';

    updatePurchaseStep(1);
    document.getElementById('step1').classList.remove('hidden');
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.add('hidden');
    document.getElementById('step4').classList.add('hidden');
    
    document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
}

function updatePurchaseStep(step) {
    const totalSteps = 4;
    document.getElementById('progressBar').style.width = `${(step - 1) / (totalSteps - 1) * 100}%`;

    for (let i = 1; i <= totalSteps; i++) {
        const indicator = document.getElementById(`stepIndicator${i}`);
        const number = indicator.querySelector('.step-number');
        const text = indicator.querySelector('p');

        indicator.classList.remove('active', 'completed');
        number.classList.remove('bg-blue-600', 'bg-gray-300', 'bg-green-600', 'text-white');
        number.classList.add('bg-gray-300', 'text-white');
        text.classList.remove('text-blue-600', 'text-gray-500');
        text.classList.add('text-gray-500');

        if (i < step) {
            indicator.classList.add('completed');
            number.classList.remove('bg-gray-300');
            number.classList.add('bg-green-600');
        } else if (i === step) {
            indicator.classList.add('active');
            number.classList.remove('bg-gray-300');
            number.classList.add('bg-blue-600');
            text.classList.add('text-blue-600');
        }
    }
}

async function loadPilihWisataStep() {
    updatePurchaseStep(1);
    const container = document.getElementById('pilihWisataList');
    container.innerHTML = `<div class="col-span-full text-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div><p class="text-gray-500 text-sm">Memuat daftar wisata...</p></div>`;

    const wisataData = await apiCall('get_wisata');
    if (wisataData.success && wisataData.data && container) {
        container.innerHTML = wisataData.data.map(w => `
            <div class="bg-white rounded-xl shadow-md overflow-hidden card-hover border border-gray-100 cursor-pointer" onclick="selectWisataForPurchase(${w.id})">
                <img src="${w.gambar_url}" alt="${w.nama}" class="w-full h-40 object-cover">
                <div class="p-4">
                    <h5 class="font-bold text-lg text-gray-800">${w.nama}</h5>
                    <p class="text-sm text-gray-600 mb-2"><i class="fas fa-map-marker-alt mr-1"></i> ${w.lokasi}</p>
                    <p class="text-xl font-bold text-blue-600">${formatRupiah(w.harga_tiket)}</p>
                    <button class="mt-3 w-full bg-blue-100 text-blue-600 py-2 rounded-lg font-semibold hover:bg-blue-200 transition">Pilih Wisata</button>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-gray-500 col-span-full py-8 text-center">Gagal memuat daftar wisata.</p>';
    }
}

async function selectWisataForPurchase(id) {
    const result = await apiCall('get_wisata_detail', { params: { id: id } });
    
    if (result.success && result.data) {
        selectedWisata = result.data;
        jumlahOrang = 1; 

        document.getElementById('selectedWisataName').textContent = selectedWisata.nama;
        document.getElementById('selectedWisataLocation').textContent = selectedWisata.lokasi;
        document.getElementById('selectedWisataPrice').textContent = formatRupiah(selectedWisata.harga_tiket);
        document.getElementById('jumlahOrangCount').textContent = jumlahOrang;
        document.getElementById('tanggalBerangkat').min = new Date().toISOString().split('T')[0];

        // LOGIKA MEMUAT CUACA AKTUAL DI LOKASI WISATA SAAT INI (PREVIEW AWAL)
        const weatherEl = document.getElementById('weatherPreview');
        const weatherContainerEl = document.getElementById('weatherPreviewContainer');
        
        if (weatherEl && weatherContainerEl) {
            weatherEl.innerHTML = `<div class="flex items-center space-x-3 text-gray-500">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Memuat cuaca aktual di ${selectedWisata.lokasi}...</span>
            </div>`;
            
            if (selectedWisata.latitude && selectedWisata.longitude) {
                // Panggil API weather (actual) untuk preview awal
                const weatherResult = await apiCall('get_weather', { 
                    params: { lat: selectedWisata.latitude, lon: selectedWisata.longitude }, 
                    method: 'GET' 
                });
                displayWeatherPreview(weatherEl, weatherResult, selectedWisata.lokasi);
            } else {
                 weatherEl.innerHTML = `<div class="text-red-500">Koordinat wisata tidak tersedia.</div>`;
            }
        }
        
        document.getElementById('step1').classList.add('hidden');
        document.getElementById('step2').classList.remove('hidden');
        updatePurchaseStep(2);
    } else {
        showNotification('Gagal memuat detail wisata.', 'error');
    }
}

// FUNGSI BARU: MEMBERIKAN REKOMENDASI BERDASARKAN CUACA
function getWeatherRecommendation(mainCode, description, temp) {
    let recommendation = { message: "", type: "info" }; // Default Blue

    // Logika Kritis (Warning / Bahaya)
    if (mainCode.toLowerCase() === 'rain' || mainCode.toLowerCase() === 'drizzle' || mainCode.toLowerCase() === 'thunderstorm') {
        recommendation.message = `⚠️ **Waspada Hujan/Badai!** Perjalanan disarankan untuk dipikirkan ulang. Resiko kegiatan air tinggi.`;
        recommendation.type = "error"; // Red
    } 
    // Logika Menengah (Info / Hati-hati)
    else if (mainCode.toLowerCase() === 'clouds' || mainCode.toLowerCase() === 'mist') {
        recommendation.message = "🌤️ **Berawan:** Kondisi nyaman, tidak terlalu panas. Tetap bawa perlindungan kulit.";
        recommendation.type = "warning"; // Yellow
    }
    // Logika Terbaik (Success)
    else if (mainCode.toLowerCase() === 'clear') {
        recommendation.message = "✅ **Cuaca Ideal!** Kondisi sempurna untuk semua aktivitas bahari. Nikmati hari Anda!";
        recommendation.type = "success"; // Green
    } 
    
    // Tambahan untuk suhu ekstrem (Opsional)
    if (temp > 32) {
         recommendation.message += " (Sangat Panas! Pastikan hidrasi yang cukup.)";
         if (recommendation.type === "info") recommendation.type = "warning";
    }

    if (recommendation.message === "") {
        recommendation.message = `ℹ️ Cuaca ${description.toLowerCase()}. Persiapkan sesuai kebutuhan.`;
    }
    
    // Tentukan kelas CSS berdasarkan tipe
    const classMap = {
        success: 'bg-green-100 text-green-800 border-green-300',
        warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        error: 'bg-red-100 text-red-800 border-red-300',
        info: 'bg-blue-100 text-blue-800 border-blue-300',
    };

    recommendation.cssClass = classMap[recommendation.type] + ' mt-4';
    return recommendation;
}


// FUNGSI REVISI: Mengambil dan menampilkan prakiraan cuaca (FIXED LOADING)
async function getForecastData(date) {
    if (!selectedWisata || !date || !selectedWisata.latitude || !selectedWisata.longitude) return;

    const weatherEl = document.getElementById('weatherPreview');
    // Tampilkan spinner
    weatherEl.innerHTML = '<div class="flex items-center space-x-3 text-gray-500"><i class="fas fa-spinner fa-spin"></i><span>Memuat prakiraan cuaca...</span></div>';

    try {
        const forecastResult = await apiCall('get_wisata_forecast', { 
            params: { 
                lat: selectedWisata.latitude, 
                lon: selectedWisata.longitude,
                date: date 
            }, 
            method: 'GET' 
        });
        
        console.log('Forecast API Response:', forecastResult);

        if (forecastResult.success && forecastResult.data) {
            displayWeatherPreview(weatherEl, forecastResult.data, selectedWisata.lokasi, date);
        } else {
            // Jika sukses: false (error dari backend), hapus spinner dan tampilkan pesan
            weatherEl.innerHTML = `<div class="text-sm text-red-500">${forecastResult.message || `Gagal memuat prakiraan untuk ${new Date(date).toLocaleDateString()}.`}</div>`;
        }
    } catch (jsError) {
        // Jika ada kesalahan JavaScript saat pemrosesan, hapus spinner dan tampilkan error
        console.error("JS Error in getForecastData:", jsError);
        weatherEl.innerHTML = `<div class="text-sm text-red-500">Kesalahan internal saat memproses data. Cek Console.</div>`;
    }
}

// FUNGSI REVISI: displayWeatherPreview (dengan perbaikan parsing data yang lebih aman)
function displayWeatherPreview(targetEl, weatherData, locationName, date = null) {
    try {
        let title = 'Cuaca Aktual Hari Ini';
        if (date) {
            title = `Prakiraan Cuaca Tgl: ${new Date(date).toLocaleDateString()}`;
        }
        
        // Parsing Data yang Lebih Aman
        // Menggunakan optional chaining untuk weatherData.main?.temp
        const tempValue = parseFloat(weatherData.temp || weatherData.main?.temp || 0);
        const temp = Math.round(tempValue);
        
        const desc = weatherData.description || weatherData.weather?.[0]?.description || 'Tidak diketahui';
        const mainCode = weatherData.main || weatherData.weather?.[0]?.main || 'Clouds'; 
        const icon = getWeatherIcon(mainCode);
        
        // Panggil fungsi rekomendasi baru
        const recommendation = getWeatherRecommendation(mainCode, desc, temp);

        // Buat HTML cuaca + rekomendasi (Diperbaiki agar rendering HTML tidak error)
        let htmlContent = `
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center">
                    <i class="fas ${icon} text-yellow-500 text-3xl mr-3"></i>
                    <div>
                        <p class="font-semibold text-xl text-gray-800">${temp}°C</p>
                        <p class="text-sm text-gray-600">${desc}</p>
                    </div>
                </div>
                <div class="text-right text-sm text-gray-500">
                    <p>${title}</p>
                    <p>di ${locationName}</p>
                </div>
            </div>
            
            <div class="p-3 rounded-lg border font-medium text-sm ${recommendation.cssClass}">
                ${recommendation.message}
            </div>
        `;

        targetEl.innerHTML = htmlContent;

    } catch (e) {
        console.error("Fatal Error during rendering weather:", e);
        targetEl.innerHTML = `<div class="text-sm text-red-500">Gagal merender data cuaca. ${e.message}</div>`;
    }
}


function proceedToPaymentStep() {
    selectedDate = document.getElementById('tanggalBerangkat').value;
    
    if (!selectedDate) {
        showNotification('Mohon pilih tanggal keberangkatan.', 'error');
        return;
    }
    
    if (jumlahOrang <= 0) {
        showNotification('Jumlah orang minimal 1.', 'error');
        return;
    }

    const totalHarga = selectedWisata.harga_tiket * jumlahOrang;

    document.getElementById('paymentWisataName').textContent = selectedWisata.nama;
    document.getElementById('paymentWisataLocation').textContent = selectedWisata.lokasi;
    document.getElementById('paymentWisataDate').textContent = `Tanggal: ${new Date(selectedDate).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    document.getElementById('paymentWisataPeople').textContent = `Jumlah: ${jumlahOrang} orang`;
    document.getElementById('paymentTotalHarga').textContent = formatRupiah(totalHarga);
    
    document.getElementById('step2').classList.add('hidden');
    document.getElementById('step3').classList.remove('hidden');
    updatePurchaseStep(3);
}

async function processPayment() {
    if (!selectedPaymentMethod) {
        showNotification('Mohon pilih metode pembayaran.', 'error');
        return;
    }

    const totalHarga = selectedWisata.harga_tiket * jumlahOrang;

    const orderData = {
        wisata_id: selectedWisata.id,
        tanggal_berkunjung: selectedDate,
        jumlah_tiket: jumlahOrang,
        total_harga: totalHarga,
        metode_pembayaran: selectedPaymentMethod
    };

    const processBtn = document.getElementById('processPayment');
    const originalText = processBtn.innerHTML;
    processBtn.disabled = true;
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Memproses...';


    const result = await apiCall('create_order', {
        method: 'POST',
        body: orderData
    });
    
    processBtn.disabled = false;
    processBtn.innerHTML = originalText;
    
    if (result.success) {
        document.getElementById('finalKodeTiket').textContent = result.data.kode_tiket;
        
        document.getElementById('step3').classList.add('hidden');
        document.getElementById('step4').classList.remove('hidden');
        updatePurchaseStep(4);
        
        showNotification(result.message, 'success');
        loadDashboardData(); 
    } else {
        showNotification(result.message || 'Gagal memproses pembayaran.', 'error');
    }
}


// --- 7. USER INTERACTION & MODALS ---

function showQRCode(kodeTiket, wisataName, jumlahOrang) {
    const container = document.getElementById('qrCodeContainer');
    const codeElement = document.getElementById('qrTiketCode');
    const infoElement = document.getElementById('qrTiketInfo');
    
    if (container && codeElement && infoElement) {
        container.innerHTML = '';
        
        if (typeof QRCode === 'undefined') {
            showNotification('Library QRCode.js tidak dimuat.', 'error');
            return;
        }

        const qrDiv = document.createElement('div');
        container.appendChild(qrDiv);
        
        new QRCode(qrDiv, {
            text: kodeTiket,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        codeElement.textContent = kodeTiket;
        infoElement.textContent = `${wisataName} • ${jumlahOrang} orang`;
        
        document.getElementById('qrModal').classList.remove('hidden');
    }
}

function closeQRModal() {
    document.getElementById('qrModal').classList.add('hidden');
}

async function handleSaveProfile(e) {
    e.preventDefault();
    const saveBtn = e.target.querySelector('button[type="submit"]');
    saveBtn.disabled = true;

    const data = {
        name: document.getElementById('inputNama').value.trim(),
        phone: document.getElementById('inputTelepon').value.trim(),
        address: document.getElementById('inputAlamat').value.trim()
    };

    if (!data.name) {
        showNotification('Nama wajib diisi.', 'error');
        saveBtn.disabled = false;
        return;
    }
    
    const result = await apiCall('save_user_profile', { method: 'POST', body: data });
    if (result.success) {
        showNotification(result.message, 'success');
        currentUser.name = data.name;
        localStorage.setItem('user', JSON.stringify(currentUser));
        checkAuthStatus(); 
    } else {
        showNotification(result.message || 'Gagal menyimpan profil.', 'error');
    }
    saveBtn.disabled = false;
}

async function loadUserProfile() {
    try {
        const profileData = await apiCall('get_user_profile');
        if (profileData.success && profileData.data) {
            const user = profileData.data;
            document.getElementById('inputNama').value = user.name || '';
            document.getElementById('inputEmail').value = user.email || '';
            document.getElementById('inputTelepon').value = user.phone || '';
            document.getElementById('inputAlamat').value = user.address || '';
            
            const avatarElement = document.getElementById('profileAvatar');
            if (avatarElement && user.name) {
                avatarElement.textContent = user.name.charAt(0).toUpperCase();
            }
        }
    } catch (error) {
        console.error('Profile load error:', error);
    }
}

function resetProfileForm() {
    loadUserProfile();
    showNotification('Form profil di-reset ke data awal.', 'info');
}

// --- 8. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    checkAuthStatus();
});

function initializeEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.section;
            showPage(page);
        });
    });
    
    document.querySelectorAll('.filter-tiket').forEach(btn => {
        btn.addEventListener('click', function() {
            filterTickets(this.dataset.status);
        });
    });

    document.getElementById('quickBuyTicket')?.addEventListener('click', () => showPage('pembelian'));
    document.getElementById('quickExplore')?.addEventListener('click', () => showPage('wisata'));
    document.getElementById('quickQRCode')?.addEventListener('click', () => showPage('tiket-saya'));
    document.getElementById('quickRefresh')?.addEventListener('click', () => {
        getCurrentLocation().then(() => {
            if (userLocation) {
                loadNearbyWisata();
                initMap(); 
            }
        });
    });

    document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
    document.getElementById('closeQrModal')?.addEventListener('click', closeQRModal);
    document.getElementById('profileForm')?.addEventListener('submit', handleSaveProfile);
    document.getElementById('resetProfile')?.addEventListener('click', resetProfileForm);
    document.getElementById('refreshLocation')?.addEventListener('click', () => {
        getCurrentLocation().then(() => {
            if (userLocation) {
                loadNearbyWisata();
                initMap(); 
            }
        });
    });

    document.getElementById('backToStep1')?.addEventListener('click', resetPurchaseState);
    document.getElementById('backToStep2')?.addEventListener('click', () => {
        document.getElementById('step3').classList.add('hidden');
        document.getElementById('step2').classList.remove('hidden');
        updatePurchaseStep(2);
    });
    
    document.getElementById('proceedToPayment')?.addEventListener('click', proceedToPaymentStep);
    document.getElementById('processPayment')?.addEventListener('click', processPayment);
    document.getElementById('lihatTiketSaya')?.addEventListener('click', () => showPage('tiket-saya'));
    document.getElementById('kembaliBeranda')?.addEventListener('click', () => showPage('beranda'));

    document.querySelectorAll('.counter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const action = this.dataset.action;
            if (action === 'increment') {
                jumlahOrang++;
            } else if (action === 'decrement' && jumlahOrang > 1) {
                jumlahOrang--;
            }
            document.getElementById('jumlahOrangCount').textContent = jumlahOrang;
        });
    });
    
    document.querySelectorAll('.payment-method').forEach(methodEl => {
        methodEl.addEventListener('click', function() {
            document.querySelectorAll('.payment-method').forEach(el => el.classList.remove('selected'));
            this.classList.add('selected');
            selectedPaymentMethod = this.dataset.method;
            showNotification(`Metode pembayaran: ${this.dataset.method} dipilih`, 'info');
        });
    });

    // Event listeners Filter dan Search (Diimplementasikan)
    const handleFilterChange = () => loadWisataList();
    document.getElementById('searchWisata')?.addEventListener('keyup', handleFilterChange);
    document.getElementById('filterKategori')?.addEventListener('change', handleFilterChange);
    document.getElementById('filterHarga')?.addEventListener('change', handleFilterChange);

    // Panggil fungsi getForecastData yang baru
    document.getElementById('tanggalBerangkat')?.addEventListener('change', function() {
        getForecastData(this.value);
    });
    
    // Event listeners untuk fitur yang belum diimplementasikan (Tetap placeholder notif)
    const notifMessage = 'Fitur ini memerlukan implementasi query database yang lebih dalam.';
    document.querySelectorAll('.filter-riwayat-status').forEach(btn => {
        btn.addEventListener('click', () => showNotification(notifMessage, 'info'));
    });
    document.getElementById('lihatSemuaPromo')?.addEventListener('click', () => showNotification('Fitur Lihat Semua Promo belum diimplementasikan.', 'info'));
    document.getElementById('liveChatButton')?.addEventListener('click', () => showNotification('Fitur Live Chat belum diimplementasikan.', 'info'));
}