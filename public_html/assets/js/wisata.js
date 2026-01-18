// =============================================================
// File: assets/js/wisata.js (REVISI FINAL LENGKAP: FIX LAYOUT BUTTON MONITORING)
// =============================================================

// --- Variabel Global ---
let allWisata = [];
let filteredWisata = [];
let allMonitoringData = {}; 
let currentPage = 1;
const itemsPerPage = 9;

// Peta & Layer
let wisataMap = null;
let mangroveMap = null; 
let pesisirMap = null; 
let markerClusterGroup = null;

let mangroveLayerGroup = null; 
let pesisirLayerGroup = null; 

let markers = {}; 

// Status Inisialisasi
let isWisataTabInitialized = false;
let isMonitoringTabInitialized = false;

// Ikon Peta
const defaultIcon = new L.Icon.Default();
const highlightedIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// =============================================================
// --- KLASIFIKASI MONITORING (WARNA & LABEL) ---
// =============================================================

const classificationColors = {
    // Warna untuk skema 5 kelas (digunakan untuk Mangrove dan Pesisir)
    1: { color: '#dc2626', label: 'Skor 1: Sangat Rendah' }, 
    2: { color: '#f97316', label: 'Skor 2: Rendah' },      
    3: { color: '#facc15', label: 'Skor 3: Sedang' },      
    4: { color: '#22c55e', label: 'Skor 4: Tinggi' },     
    5: { color: '#16a34a', label: 'Skor 5: Sangat Tinggi' }
};

// Daftar file JSON di server Anda
const allJsonFiles = [
    'EVI_Easter_Point_Kabsa.json', 'EVI_Karangantu.json', 'EVI_Pulau_Panaitan.geojson',
    'EVI_pulau_Panjang.json', 'EVI_Ujung_Kulon.json', 'evicagaralam.json',
    'evipesisirpantai.json', 'PesisirAtas_j.geojson', 'PesisirBaawahh_j.geojson',
    'Pulau_sangiang_j.json', 'Pulau_tunda.json', 'PulauPanaitan_J.geojson',
    'UjungKulon_J.json'
];

// --- KAMUS LABEL CUSTOM BARU (SESUAI PERMINTAAN USER) ---
const fileLabelMap = {
    'EVI_Easter_Point_Kabsa.json': 'Mangrove Daerah Easter Point Kab. Serang',
    'EVI_Karangantu.json': 'Wisata Mangrove Pancer Karangantu',
    'EVI_Pulau_Panaitan.geojson': 'Mangrove Pulau Panaitan',
    'EVI_pulau_Panjang.json': 'Mangrove Pulau Panjang',
    'EVI_Ujung_Kulon.json': 'Mangrove Ujung Kulon',
    'evicagaralam.json': 'Mangrove Cagar Alam Pulau Dua Serang',
    'evipesisirpantai.json': 'Mangrove Pesisir Barat Banten',
    'PesisirAtas_j.geojson': 'Pesisir Utara Banten',
    'PesisirBaawahh_j.geojson': 'Pesisir Selatan Banten',
    'Pulau_sangiang_j.json': 'Pulau Sangiang',
    'Pulau_tunda.json': 'Pulau Tunda',
    'PulauPanaitan_J.geojson': 'Pulau Panaitan',
    'UjungKulon_J.json': 'Perairan Ujung Kulon'
};

// Pengelompokan file
const mangroveFiles = allJsonFiles.filter(file => file.toLowerCase().includes('evi'));
const pesisirFiles = allJsonFiles.filter(file => !file.toLowerCase().includes('evi'));

// =============================================================
// --- INISIALISASI UTAMA & LOGIKA TAB ---
// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    setupGlobalEventListeners();
    handleHashChange(); 
});

// Setup event listener global (header, nav, modal, dll)
function setupGlobalEventListeners() {
    // Navigasi Hash (Tab)
    window.addEventListener('hashchange', handleHashChange);
    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.getElementById('mobileMenu').classList.add('hidden');
        });
    });

    // Header Dropdown
    const dropdownBtn = document.getElementById('destinasiDropdown');
    const dropdownMenu = document.getElementById('destinasiMenu');
    if (dropdownBtn) {
        dropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });
    }
    document.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.classList.add('hidden');
    });

    // Mobile Menu
    document.getElementById('mobileMenuBtn').addEventListener('click', () => {
        document.getElementById('mobileMenu').classList.toggle('hidden');
    });

    // Tombol Scroll-to-Top (FAB)
    const fab = document.querySelector('.fab'); 
    if (fab) {
        window.addEventListener('scroll', () => {
            fab.style.display = (window.scrollY > 300) ? 'flex' : 'none';
        });
        fab.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // Tombol Close Modal
    const closeModalButton = document.querySelector('.modal button[onclick="closeModal()"]');
    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeModal);
    }
    document.getElementById('wisataModal').addEventListener('click', (e) => {
        if (e.target.id === 'wisataModal') closeModal();
    });
}

// Fungsi utama untuk routing Tab
function handleHashChange() {
    const hash = window.location.hash || '#wisata'; // Default ke #wisata
    
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    
    // Perbarui Tampilan Navigasi Aktif
    document.querySelectorAll('.tab-link').forEach(link => {
        if (link.getAttribute('href') === hash) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    if (hash === '#monitoring') {
        document.getElementById('monitoringContent').classList.remove('hidden');
        document.title = 'Monitoring Potensi Wisata - BlueWave Banten';
        if (!isMonitoringTabInitialized) {
            initMonitoringTab();
        } else {
            setTimeout(() => { 
                if (mangroveMap) mangroveMap.invalidateSize(); 
                if (pesisirMap) pesisirMap.invalidateSize();
            }, 100);
        }
    } else {
        document.getElementById('wisataContent').classList.remove('hidden');
        document.title = 'Destinasi Wisata Bahari - BlueWave Banten';
        if (!isWisataTabInitialized) {
            initWisataTab();
        } else {
            setTimeout(() => { if (wisataMap) wisataMap.invalidateSize(); }, 100);
        }
    }
}

// =============================================================
// --- BAGIAN 1: LOGIKA TAB "WISATA BAHARI" ---
// =============================================================

async function initWisataTab() {
    if (isWisataTabInitialized) return;
    
    console.log("Inisialisasi Tab Wisata Bahari...");
    setupWisataEventListeners();
    allWisata = await loadAllWisataData();
    
    updateCategoryStats(allWisata); 
    initWisataMap();
    filterGrid(); 
    
    isWisataTabInitialized = true;
}

function setupWisataEventListeners() {
    document.getElementById('sortFilter').addEventListener('change', filterGrid);
    document.getElementById('loadMoreBtn').addEventListener('click', () => {
        currentPage++;
        renderWisataGrid();
    });
}

async function loadAllWisataData() {
    const grid = document.getElementById('wisataGrid');
    const loadingHtml = `<div class="col-span-full text-center py-12"><div class="spinner mx-auto mb-4"></div><p class="text-gray-600">Memuat destinasi wisata...</p></div>`;
    if (grid) grid.innerHTML = loadingHtml;

    try {
        const response = await fetch('/api/api.php?action=get_wisata');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
            console.log("Berhasil memuat data wisata:", result.data.length);
            return result.data.map(item => ({ 
                ...item, 
                harga_tiket: parseInt(item.harga_tiket || 0),
                rating: parseFloat(item.rating) || 4.5 
            }));
        }
        throw new Error('Format data tidak valid');
    } catch (error) {
        console.error("Gagal memuat data wisata:", error);
        grid.innerHTML = `<div class="col-span-full text-red-500 text-center font-semibold">Gagal memuat data.</div>`;
        return [];
    }
}

function updateCategoryStats(data) {
    const counts = { pantai: 0, pulau: 0, resort: 0, ekowisata: 0, pelabuhan: 0 };
    let totalRating = 0;

    data.forEach(w => {
        const kat = (w.kategori || '').toLowerCase();
        if (kat.includes('pantai')) counts.pantai++;
        if (kat.includes('pulau')) counts.pulau++;
        if (kat.includes('resort')) counts.resort++;
        if (kat.includes('ekowisata') || kat.includes('mangrove')) counts.ekowisata++;
        if (kat.includes('pelabuhan')) counts.pelabuhan++;
        totalRating += (w.rating || 0);
    });

    document.getElementById('totalDestinasi').textContent = data.length;
    document.getElementById('avgRating').textContent = (totalRating / data.length).toFixed(1);
    document.getElementById('statCountPantai').textContent = counts.pantai;
    document.getElementById('statCountPulau').textContent = counts.pulau;
    
    document.getElementById('countPantai').textContent = `${counts.pantai} Destinasi`;
    document.getElementById('countPulau').textContent = `${counts.pulau} Destinasi`;
    document.getElementById('countResort').textContent = `${counts.resort} Destinasi`;
    document.getElementById('countMangrove').textContent = `${counts.ekowisata} Destinasi`;
    document.getElementById('countPelabuhan').textContent = `${counts.pelabuhan} Destinasi`;
}

function filterGrid() {
    const sortValue = document.getElementById('sortFilter').value;
    let tempWisata = [...allWisata]; 

    switch (sortValue) {
        case 'rating': tempWisata.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
        case 'price_low': tempWisata.sort((a, b) => a.harga_tiket - b.harga_tiket); break;
        case 'price_high': tempWisata.sort((a, b) => b.harga_tiket - a.harga_tiket); break;
        case 'name': default: tempWisata.sort((a, b) => a.nama.localeCompare(b.nama));
    }
    
    filteredWisata = tempWisata;
    currentPage = 1; 
    renderWisataGrid();
    updateWisataMapMarkers(filteredWisata);
}

// =============================================================
// --- PERBAIKAN RENDER KARTU WISATA (LEBIH INTERAKTIF) ---
// =============================================================
function renderWisataGrid() {
    const grid = document.getElementById('wisataGrid');
    const resultCountEl = document.getElementById('resultCount');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    
    const itemsToShow = filteredWisata.slice(0, currentPage * itemsPerPage);
    
    if (currentPage === 1) grid.innerHTML = ''; 
    
    if (itemsToShow.length === 0 && currentPage === 1) {
         grid.innerHTML = `<div class="col-span-full text-center text-gray-500">Tidak ada destinasi ditemukan.</div>`;
    } else {
        const newItems = filteredWisata.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        
        // Menggunakan kelas kustom dari wisata.css (bukan Tailwind)
        grid.innerHTML += newItems.map(item => {
            const priceFormatted = (item.harga_tiket || 0).toLocaleString('id-ID');
            return `
                <div id="card-${item.id}" class="wisata-card">
                    <a class="card-image-link" onclick="openModal(${item.id})">
                        <img src="${item.gambar_url || 'https://via.placeholder.com/400x300.png'}" alt="${item.nama}" class="card-image">
                        <div class="card-kategori">${item.kategori}</div>
                        <div class="card-rating">${item.rating} ★</div>
                    </a>
                    <div class="p-5">
                        <h3 class="card-title" onclick="openModal(${item.id})">${item.nama}</h3>
                        <p class="card-location"><i class="fas fa-map-marker-alt mr-2"></i>${item.lokasi}</p>
                        
                        <div class="flex justify-between items-center mt-4">
                            <p class="card-price">Rp ${priceFormatted}</p>
                            <button onclick="openModal(${item.id})" class="card-button">
                                Detail <i class="fas fa-arrow-right ml-1 text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }
    
    addCardEventListeners();
    resultCountEl.textContent = `Menampilkan ${itemsToShow.length} dari ${filteredWisata.length} destinasi`;
    loadMoreContainer.style.display = itemsToShow.length >= filteredWisata.length ? 'none' : 'block';
}

function initWisataMap() {
    if (wisataMap) return;
    wisataMap = L.map('wisataMap').setView([-6.20, 106.00], 9);
    
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    });
    const imageryLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    const baseMaps = { "Peta Jalan": osmLayer, "Citra Satelit": imageryLayer };
    
    osmLayer.addTo(wisataMap);
    L.control.layers(baseMaps, null, { collapsed: true }).addTo(wisataMap);
    
    markerClusterGroup = L.markerClusterGroup();
    wisataMap.addLayer(markerClusterGroup);
    L.control.locate().addTo(wisataMap);
    setTimeout(() => wisataMap.invalidateSize(), 100);
}

function updateWisataMapMarkers(items) {
    if (!markerClusterGroup) return;
    markerClusterGroup.clearLayers();
    markers = {}; 
    
    items.forEach(item => {
        if (item.latitude && item.longitude) {
            const marker = L.marker([parseFloat(item.latitude), parseFloat(item.longitude)], { icon: defaultIcon });
            marker.bindPopup(`<b>${item.nama}</b><br><a href="#" onclick="openModal(${item.id}); return false;">Lihat Detail</a>`);
            markers[item.id] = marker;
            markerClusterGroup.addLayer(marker);
        }
    });
}

// =============================================================
// --- BAGIAN 2: LOGIKA MODAL & INTERAKSI PETA (WISATA) ---
// =============================================================

function addCardEventListeners() {
    document.querySelectorAll('.wisata-card').forEach(card => {
        card.addEventListener('mouseenter', () => highlightMarker(card.id, true));
        card.addEventListener('mouseleave', () => highlightMarker(card.id, false));
    });
}

function highlightMarker(cardId, shouldHighlight) {
    const id = cardId.split('-')[1];
    const marker = markers[id];
    if (!marker) return;

    marker.setIcon(shouldHighlight ? highlightedIcon : defaultIcon);
    if (shouldHighlight) {
        if (markerClusterGroup.getVisibleParent(marker) !== wisataMap) {
             markerClusterGroup.zoomToShowLayer(marker, () => marker.openPopup());
        } else {
             marker.openPopup();
        }
    } else {
        marker.closePopup();
    }
}

async function openModal(wisataId) {
    const modal = document.getElementById('wisataModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Reset isi modal
    document.getElementById('modalTitle').textContent = 'Memuat...';
    document.getElementById('modalLocation').textContent = '...';
    document.getElementById('modalRating').textContent = '...';
    document.getElementById('modalViews').textContent = '...';
    document.getElementById('modalImage').src = 'https://via.placeholder.com/600x400.png?text=Memuat+Gambar...';
    document.getElementById('modalDescription').textContent = '...';
    document.getElementById('modalPrice').textContent = '...';
    document.getElementById('modalFasilitas').innerHTML = '<li>Memuat...</li>';
    document.getElementById('modalTips').innerHTML = '<li>Memuat...</li>';

    try {
        const response = await fetch(`/api/api.php?action=get_wisata&id=${wisataId}`);
        if (!response.ok) throw new Error('Data detail tidak ditemukan');
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        const data = result.data;
        
        document.getElementById('modalTitle').textContent = data.nama;
        document.getElementById('modalLocation').textContent = data.lokasi;
        document.getElementById('modalRating').textContent = `${data.rating || 4.5} ★`;
        document.getElementById('modalViews').textContent = `${(data.views || 1000).toLocaleString('id-ID')} views`;
        document.getElementById('modalImage').src = data.gambar_url || 'https_via.placeholder.com/600x400.png';
        document.getElementById('modalDescription').textContent = data.deskripsi;
        document.getElementById('modalPrice').textContent = `Rp ${(parseInt(data.harga_tiket) || 0).toLocaleString('id-ID')}`;
        
        let fasilitas = ['Tidak ada data fasilitas'];
        if (data.fasilitas) {
            try { fasilitas = JSON.parse(data.fasilitas); } catch (e) { fasilitas = data.fasilitas.split(','); }
        }
        let tips = ['Tidak ada data tips'];
         if (data.tips) {
            try { tips = JSON.parse(data.tips); } catch (e) { tips = data.tips.split(','); }
        }
        
        document.getElementById('modalFasilitas').innerHTML = fasilitas.map(f => `<li><i class="fas fa-check text-green-500 mr-2"></i>${f.trim()}</li>`).join('');
        document.getElementById('modalTips').innerHTML = tips.map(t => `<li><i class="fas fa-lightbulb text-yellow-500 mr-2"></i>${t.trim()}</li>`).join('');

        if (data.latitude && data.longitude) {
            fetchWeatherData(data.latitude, data.longitude);
        } else {
            document.getElementById('modalWeather').innerHTML = '<p>Data cuaca tidak tersedia.</p>';
        }

    } catch (error) {
        console.error("Gagal membuka modal:", error);
        document.getElementById('modalTitle').textContent = 'Gagal Memuat Data';
        document.getElementById('modalDescription').textContent = 'Terjadi kesalahan saat mengambil detail destinasi.';
    }
}

async function fetchWeatherData(lat, lon) {
    const weatherContainer = document.getElementById('modalWeather');
    const safetyContainer = document.getElementById('weatherSafety');
    weatherContainer.innerHTML = '<div class="spinner mx-auto"></div>';
    safetyContainer.innerHTML = '';
    
    const url = `/api/api.php?action=get_weather&lat=${lat}&lon=${lon}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Gagal memuat cuaca');
        const data = await response.json(); 
        if (data.cod != 200) throw new Error(data.message || 'Gagal memuat data cuaca');

        weatherContainer.innerHTML = `
            <div class="flex justify-between items-center py-2 border-b border-blue-100">
                <span class="text-gray-700">Cuaca:</span>
                <span class="font-semibold text-blue-600 flex items-center">
                    <img src="https://openweathermap.org/img/wn/${data.weather[0].icon}.png" class="w-6 h-6 mr-1" alt="icon">
                    ${data.weather[0].description}
                </span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-blue-100">
                <span class="text-gray-700">Suhu:</span>
                <span class="font-semibold text-blue-600">${data.main.temp.toFixed(1)} °C</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-blue-100">
                <span class="text-gray-700">Kelembaban:</span>
                <span class="font-semibold text-blue-600">${data.main.humidity} %</span>
            </div>
            <div class="flex justify-between items-center py-2">
                <span class="text-gray-700">Angin:</span>
                <span class="font-semibold text-blue-600">${data.wind.speed.toFixed(1)} m/s</span>
            </div>
        `;

        if (data.wind.speed > 10 || data.weather[0].main === 'Rain' || data.weather[0].main === 'Thunderstorm') {
            safetyContainer.className = 'mt-4 p-3 rounded-lg text-center font-semibold bg-red-100 text-red-700';
            safetyContainer.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i>Kondisi Cuaca Buruk. Harap berhati-hati.';
        } else {
            safetyContainer.className = 'mt-4 p-3 rounded-lg text-center font-semibold bg-green-100 text-green-700';
            safetyContainer.innerHTML = '<i class="fas fa-check-circle mr-2"></i>Kondisi Cuaca Aman untuk Berwisata.';
        }
    } catch (error) {
        console.error("Error fetching weather:", error);
        weatherContainer.innerHTML = `<p class="text-red-500 text-sm">${error.message}</p>`;
    }
}

function closeModal() {
    document.getElementById('wisataModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// =============================================================
// --- BAGIAN 3: LOGIKA TAB "MONITORING WISATA" ---
// =============================================================

function initMonitoringTab() {
    if (isMonitoringTabInitialized) return;
    
    console.log("Inisialisasi Tab Monitoring (Revisi 5 Kelas)...");
    
    initMonitoringMap('mangroveMap');
    initMonitoringMap('pesisirMap');
    
    generateMonitoringControls('mangroveLayerControls', 'mangrove');
    renderMonitoringLegend('mangroveLegend', 'mangrove');

    generateMonitoringControls('pesisirLayerControls', 'pesisir');
    renderMonitoringLegend('pesisirLegend', 'pesisir');
    
    isMonitoringTabInitialized = true;
}

function initMonitoringMap(mapId) {
    let targetMap = null;
    let targetLayerGroup = null;
    
    const bantenCenter = [-6.4, 106.0]; 
    const initialZoom = 9;

    if (mapId === 'mangroveMap') {
        if (mangroveMap) return;
        targetMap = L.map(mapId).setView(bantenCenter, initialZoom);
        mangroveMap = targetMap;
        mangroveLayerGroup = L.layerGroup().addTo(mangroveMap);
        targetLayerGroup = mangroveLayerGroup;
    } else if (mapId === 'pesisirMap') {
        if (pesisirMap) return;
        targetMap = L.map(mapId).setView(bantenCenter, initialZoom);
        pesisirMap = targetMap;
        pesisirLayerGroup = L.layerGroup().addTo(pesisirMap);
        targetLayerGroup = pesisirLayerGroup;
    } else {
        return;
    }

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' });
    const imageryLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri' });
    
    osmLayer.addTo(targetMap); 
    const baseMaps = { "Peta Jalan": osmLayer, "Citra Satelit": imageryLayer };
    L.control.layers(baseMaps, null, { collapsed: true }).addTo(targetMap);
    L.control.locate().addTo(targetMap);
    
    setTimeout(() => targetMap.invalidateSize(), 100); 
}

function getAnalysisExplanation(skor) {
    let explanation = '';
    let status = '';
    
    skor = parseInt(skor);
    
    switch (skor) {
        case 5:
            status = 'Optimal';
            explanation = 'Area ini menunjukkan **potensi kelayakan tertinggi** (Optimal) untuk pengembangan ekowisata bahari. Kondisi biofisik dan aksesibilitas berada pada tingkat optimal. Direkomendasikan untuk pengembangan segera dengan perencanaan infrastruktur pendukung yang ramah lingkungan dan berkelanjutan.';
            break;
        case 4:
            status = 'Sangat Layak';
            explanation = 'Area ini sangat layak dikembangkan, memerlukan sedikit intervensi atau perbaikan minor pada aspek tertentu. Potensi sumber daya alamnya tinggi dan siap untuk dieksploitasi secara berkelanjutan dengan pengawasan ketat.';
            break;
        case 3:
            status = 'Layak';
            explanation = 'Area ini memiliki kelayakan sedang. Pengembangan bisa dilakukan dengan fokus pada peningkatan kualitas sumber daya dan pengelolaan risiko, seperti mitigasi abrasi atau perbaikan fasilitas dasar. Membutuhkan studi kelayakan yang lebih mendalam dan bertahap.';
            break;
        case 2:
            status = 'Kurang Layak';
            explanation = 'Area ini kurang disarankan untuk pengembangan ekowisata tanpa intervensi besar. Faktor pembatas utama (degradasi lingkungan atau akses sulit) perlu diatasi secara signifikan sebelum investasi dimulai.';
            break;
        case 1:
        default:
            status = 'Tidak Layak';
            explanation = 'Area ini **tidak direkomendasikan** untuk pengembangan ekowisata dalam waktu dekat. Risiko kerusakan lingkungan, bahaya alam, atau keterbatasan akses dan fasilitas sangat tinggi. Prioritas utama adalah restorasi ekosistem atau perlindungan kawasan.';
            break;
    }
    
    return { status, explanation };
}

function renderMonitoringLegend(containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = ''; 
    
    const colors = classificationColors; 
    
    Object.keys(colors).sort((a, b) => b - a).forEach(skor => { 
        const { color, label } = colors[skor];
        const { status } = getAnalysisExplanation(skor);
        
        const legendItem = document.createElement('div');
        legendItem.className = 'flex items-center space-x-3';
        legendItem.innerHTML = `
            <div class="w-4 h-4 rounded" style="background-color: ${color}; border: 1px solid #ccc;"></div>
            <span class="text-sm text-gray-700">${label} (${status})</span>
        `;
        container.appendChild(legendItem);
    });
}


function generateMonitoringControls(containerId, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; 
    
    let targetFiles = (type === 'mangrove') ? mangroveFiles : pesisirFiles;
    let targetMapId = (type === 'mangrove') ? 'mangroveMap' : 'pesisirMap';
    let targetLayerId = (type === 'mangrove') ? 'mangroveLayerGroup' : 'pesisirLayerGroup';
    
    const groupName = (type === 'mangrove') ? 'Semua Zona Mangrove' : 'Semua Zona Pesisir';

    // 1. Tombol untuk Grup Besar (Semua)
    const groupButton = document.createElement('button');
    groupButton.className = `layer-control-btn all-btn px-4 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all duration-200 text-sm w-full`;
    groupButton.dataset.category = groupName;
    groupButton.textContent = groupName;
    
    groupButton.addEventListener('click', function() {
        document.querySelectorAll(`#${containerId} .layer-control-btn`).forEach(btn => btn.classList.remove('active', 'bg-blue-600', 'text-white'));
        this.classList.add('active', 'bg-blue-600', 'text-white');
        fetchAndDisplayLayers(targetFiles, targetMapId, targetLayerId, type);
    });
    container.appendChild(groupButton);
    
    // 2. Tombol untuk Setiap File Individu
    const fileListContainer = document.createElement('div');
    // **REVISI SPACING**: gap-2 dan p-3 untuk tampilan yang tidak dempet
    fileListContainer.className = 'flex flex-col gap-2 mt-3 max-h-56 overflow-y-auto p-3 border border-gray-200 rounded-lg bg-white shadow-inner'; 
    
    targetFiles.forEach(fileName => {
        const displayLabel = fileLabelMap[fileName] || fileName;
        
        const fileButton = document.createElement('button');
        // REVISI TAMPILAN UTAMA: py-2 untuk tinggi yang cukup, w-full agar tombol memenuhi container, HILANGKAN 'truncate'.
        fileButton.className = `layer-control-btn px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-blue-100 hover:text-blue-800 transition text-left w-full`; 
        fileButton.dataset.category = fileName;
        fileButton.textContent = displayLabel; 
        
        fileButton.addEventListener('click', function() {
             document.querySelectorAll(`#${containerId} .layer-control-btn`).forEach(btn => {
                btn.classList.remove('active', 'bg-blue-600', 'text-white');
                if (!btn.classList.contains('all-btn')) {
                    btn.classList.add('bg-gray-100', 'text-gray-700');
                    btn.classList.remove('bg-blue-600', 'text-white');
                }
             });
             this.classList.add('active', 'bg-blue-600', 'text-white');
             this.classList.remove('bg-gray-100', 'text-gray-700'); 
             fetchAndDisplayLayers([fileName], targetMapId, targetLayerId, type);
        });
        fileListContainer.appendChild(fileButton);
    });
    
    container.appendChild(fileListContainer);
    
    // Set tombol pertama (Grup Besar) sebagai aktif default
    const defaultButton = container.querySelector('.all-btn');
    if (defaultButton) defaultButton.click();
}


// FETCH SEMUA FILE JSON DALAM SATU KLIK (TETAP SAMA)
async function fetchAndDisplayLayers(fileList, mapId, layerId, type) {
    const targetMap = (mapId === 'mangroveMap') ? mangroveMap : pesisirMap;
    const targetLayerGroup = (layerId === 'mangroveLayerGroup') ? mangroveLayerGroup : pesisirLayerGroup;
    
    if (!targetLayerGroup) return;
    targetLayerGroup.clearLayers();
    
    const mapContainer = document.getElementById(mapId);
    let loader = document.getElementById(`loader-${mapId}`);
    if (!loader) {
        loader = document.createElement('div');
        loader.id = `loader-${mapId}`;
        loader.className = 'map-loader'; 
        loader.innerHTML = '<div class="spinner"></div><p style="color:black; background:white; padding:5px; border-radius:5px;">Memuat data layer...</p>';
        mapContainer.appendChild(loader);
    }
    if (loader) loader.style.display = 'block'; 

    let allFeatures = [];

    for (const fileName of fileList) {
        const cacheKey = fileName;
        
        try {
            if (!allMonitoringData[cacheKey]) {
                const response = await fetch(`/file_json/${fileName}?v=1.2`);
                if (!response.ok) throw new Error(`Gagal memuat ${fileName}`);
                allMonitoringData[cacheKey] = await response.json(); 
            }
            
            const features = allMonitoringData[cacheKey].features;
            if (features) {
                allFeatures = allFeatures.concat(features);
            }
            
        } catch (error) {
            console.error(`Error loading ${fileName}:`, error);
        }
    }
    
    if (loader) loader.style.display = 'none';
    displayMonitoringFeatures(allFeatures, targetMap, targetLayerGroup, type);
}

// RENDER POLIGON KE PETA (BARU)
function displayMonitoringFeatures(features, targetMap, targetLayerGroup, type) {
    if (!features || features.length === 0) {
        console.warn("Tidak ada 'features' untuk ditampilkan.");
        L.marker(targetMap.getCenter(), {opacity: 0}).addTo(targetLayerGroup)
           .bindPopup("Tidak ada data layer yang dimuat untuk kategori ini.").openPopup();
        return;
    }
    
    let bounds = []; 

    features.forEach(feature => {
        const { properties, geometry } = feature;
        if (!properties || !geometry) return;
        
        const skor = parseInt(properties.gridcode) || 1; 
        
        // Ambil warna dan penjelasan profesional
        const colorConfig = classificationColors[skor] || classificationColors[1];
        const color = colorConfig.color;
        const { status, explanation } = getAnalysisExplanation(skor);
        
        const layer = L.geoJSON(feature, {
            style: {
                color: color,
                fillColor: color,
                fillOpacity: 0.65, 
                weight: 1.5 
            }
        });
        
        // POPUP DENGAN PENJELASAN YANG LEBIH PROFESIONAL
        const popupContent = `
            <div class="font-sans text-sm p-1">
                <h4 class="font-bold text-base mb-2 border-b pb-1">Detail Analisis Spasial</h4>
                <div class="space-y-1 text-sm">
                    <p><strong>Klasifikasi:</strong> ${type === 'mangrove' ? 'EVI (Vegetasi)' : 'Lyzenga (Substrate)'}</p>
                    <p><strong>ID Grid Area:</strong> ${properties.Id || properties.FID || 'N/A'}</p>
                    <p><strong>Skor Kelayakan (1-5):</strong> <span class="font-bold" style="color: ${color};">${skor} (${status})</span></p>
                </div>
                <hr class="my-2 border-gray-200">
                <p class="text-sm font-medium">Rekomendasi Analisis:</p>
                <p class="text-xs text-gray-700 italic">${explanation}</p>
            </div>
        `;
        layer.bindPopup(popupContent);
        
        targetLayerGroup.addLayer(layer);
        
        try {
             bounds.push(layer.getBounds());
        } catch (e) {
            console.warn("Gagal mendapatkan bounds untuk satu fitur:", feature);
        }
    });
    
    // Fit peta ke batas poligon
    if (bounds.length > 0) {
        targetMap.fitBounds(L.latLngBounds(bounds).pad(0.1));
    }
}