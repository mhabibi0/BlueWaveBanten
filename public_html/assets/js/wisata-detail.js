// --- Global Variables ---
let detailMap = null;

// --- 1. Fungsi Utilitas ---

/**
 * Mendapatkan ID destinasi dari URL (contoh: ?id=6).
 * @returns {number} ID Destinasi.
 */
function getWisataIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('id'));
}

/**
 * Menginisialisasi peta Leaflet, menandai lokasi wisata, dan menambahkan kontrol lokasi pengguna.
 * @param {number} lat - Latitude lokasi wisata.
 * @param {number} lon - Longitude lokasi wisata.
 * @param {string} namaWisata - Nama destinasi untuk popup marker.
 */
function initDetailMap(lat, lon, namaWisata) {
    if (typeof L === 'undefined') {
        console.error('Leaflet library belum dimuat. Peta tidak dapat ditampilkan.');
        return;
    }
    
    // 1. Inisialisasi Peta
    if (detailMap) {
        detailMap.remove(); 
    }
    detailMap = L.map('detailMap').setView([lat, lon], 13);
    
    // Menambahkan layer OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(detailMap);

    // 2. Tandai Lokasi Wisata
    const wisataMarker = L.marker([lat, lon]).addTo(detailMap);
    wisataMarker.bindPopup(`<b>${namaWisata}</b> (Destinasi Anda)`).openPopup();

    // 3. Tambahkan Kontrol Lokasi Pengguna (Tombol Bidik)
    L.control.locate({
        strings: {
            title: "Tampilkan lokasi saya"
        },
        locateOptions: {
            enableHighAccuracy: true
        },
        flyTo: true, 
        showPopup: true
    }).addTo(detailMap);

    // 4. Handle error jika gagal mendapatkan lokasi
    detailMap.on('locationerror', function(e) {
        console.warn(`Gagal mendapatkan lokasi: ${e.message}`);
        L.popup()
            .setLatLng(detailMap.getCenter())
            .setContent("Gagal menemukan lokasi Anda. Cek izin browser.")
            .openOn(detailMap);
    });
    
    // *** FIX PETA ABU-ABU ***
    // Memastikan peta mengukur dirinya sendiri setelah container DOM settle
    setTimeout(() => {
        detailMap.invalidateSize();
    }, 100); 
}

/**
 * Mengambil dan menampilkan data cuaca saat ini dari API.
 * @param {number} lat - Latitude.
 * @param {number} lon - Longitude.
 */
async function getWeatherData(lat, lon) {
    const url = `https://bluewavebanten.my.id/api/api.php?action=get_weather&lat=${lat}&lon=${lon}`;
    
    // Placeholder untuk UI saat memuat
    document.getElementById('weatherCondition').textContent = "Memuat...";
    document.getElementById('weatherTemp').textContent = "-";

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Gagal mengambil data cuaca');

        const weather = await response.json();

        // Asumsi data OpenWeatherMap
        const deskripsiCuaca = weather.weather[0].description.charAt(0).toUpperCase() + weather.weather[0].description.slice(1);
        const suhu = `${Math.round(weather.main.temp)}°C`;
        const kelembaban = `${weather.main.humidity}%`;
        const angin = `${weather.wind.speed} m/s`;

        document.getElementById('weatherCondition').textContent = deskripsiCuaca;
        document.getElementById('weatherTemp').textContent = suhu;
        document.getElementById('weatherHumidity').textContent = kelembaban;
        document.getElementById('weatherWind').textContent = angin;

    } catch (error) {
        console.error('Error fetching weather:', error);
        document.getElementById('weatherCondition').textContent = "Data tidak tersedia";
        document.getElementById('weatherTemp').textContent = "-";
        document.getElementById('weatherHumidity').textContent = "-";
        document.getElementById('weatherWind').textContent = "-";
    }
}


// --- 2. Fungsi Utama: Load Data Destinasi ---

async function loadWisataDetail() {
    const id = getWisataIdFromUrl();
    const loadingState = document.getElementById('loadingState');
    const detailContent = document.getElementById('detailContent');

    if (!id) {
        loadingState.innerHTML = '<h2 class="text-2xl font-bold text-red-600">ID Destinasi tidak ditemukan di URL.</h2>';
        return;
    }

    try {
        // Panggil API untuk mendapatkan detail destinasi
        const response = await fetch(`https://bluewavebanten.my.id/api/api.php?action=get_wisata&id=${id}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        const wisata = result.data; 

        if (!result.success || !wisata) {
            throw new Error(result.message || 'Data destinasi tidak ditemukan.');
        }

        // --- Isi Konten HTML ---
        
        document.getElementById('detailTitle').textContent = wisata.nama;
        document.getElementById('detailLocation').textContent = wisata.lokasi;
        document.getElementById('detailImage').src = wisata.gambar_url || 'placeholder.jpg';
        document.getElementById('detailDescription').innerHTML = wisata.deskripsi;
        document.getElementById('detailPrice').textContent = `Rp ${parseInt(wisata.harga_tiket).toLocaleString('id-ID')}`;
        
        // Data Statis/Dummy sementara
        document.getElementById('detailRating').textContent = "4.8";
        document.getElementById('detailViews').textContent = "1.5K+ dilihat";


        // --- Isi Fasilitas & Tips ---
        
        const fasilitasList = document.getElementById('detailFasilitas');
        const tipsList = document.getElementById('detailTips');
        
        // Memecah string Fasilitas 
        const fasilitasArray = wisata.fasilitas ? wisata.fasilitas.split(',').map(f => f.trim()).filter(f => f.length > 0) : ["Fasilitas belum terdata"];
        fasilitasList.innerHTML = fasilitasArray.map(f => `
            <li><i class="fas fa-check-circle text-green-500 mr-2"></i>${f}</li>
        `).join('');

        // Memecah string Tips
        const tipsArray = wisata.tips ? wisata.tips.split(',').map(t => t.trim()).filter(t => t.length > 0) : ["Tips belum terdata"];
        tipsList.innerHTML = tipsArray.map(t => `
            <li><i class="fas fa-lightbulb text-blue-500 mr-2"></i>${t}</li>
        `).join('');


        // --- Load Cuaca & Peta ---
        
        const lat = parseFloat(wisata.latitude);
        const lon = parseFloat(wisata.longitude);
        
        if (!isNaN(lat) && !isNaN(lon)) {
            getWeatherData(lat, lon);
            initDetailMap(lat, lon, wisata.nama);
        } else {
            console.warn("Koordinat peta tidak valid untuk destinasi ini.");
            document.getElementById('detailMap').innerHTML = `<div class="p-10 text-center text-gray-500">Data koordinat peta tidak tersedia.</div>`;
        }

        // Sembunyikan loading dan tampilkan konten
        loadingState.classList.add('hidden');
        detailContent.classList.remove('hidden');

    } catch (error) {
        console.error('Error saat memuat detail:', error);
        loadingState.innerHTML = `<h2 class="text-2xl font-bold text-red-600">Gagal Memuat Destinasi. Cek ID atau server API.</h2><p class="text-gray-600 mt-2">Detail: ${error.message}</p>`;
    }
}

// --- 3. Pemicu Utama ---

document.addEventListener('DOMContentLoaded', loadWisataDetail);