// =================================================================
// File: assets/js/index.js (Versi Final dengan Promo & Search - REVISI FILTER BLOG)
// Deskripsi: Mengatur semua logika dinamis untuk halaman utama (index.html).
// =================================================================

// --- Variabel Global ---
let allWisataForSearch = []; // Menyimpan semua data wisata untuk fitur pencarian.


// =================================================================
// BAGIAN 1: FUNGSI-FUNGSI UTAMA (PENGAMBILAN DATA & STATUS UI)
// =================================================================

/**
 * Memeriksa status login dari localStorage dan memperbarui tampilan header.
 */
function checkAuthStatus() {
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('user_data') || '{}');
    const authSection = document.getElementById('authSection');
    const mobileAuthSection = document.getElementById('mobileAuthSection');

    if (!authSection || !mobileAuthSection) return;

    if (token && user.name) {
        authSection.innerHTML = `<div class="flex items-center space-x-4"><span class="font-medium text-gray-700">Halo, ${user.name}</span><a href="https://user.bluewavebanten.my.id/dashboard.html" class="bg-blue-600 text-white px-4 py-2 rounded-full font-semibold hover:bg-blue-700 transition"><i class="fas fa-tachometer-alt mr-2"></i>Dashboard</a></div>`;
        mobileAuthSection.innerHTML = `<a href="https://user.bluewavebanten.my.id/dashboard.html" class="bg-blue-600 text-white text-center py-3 rounded-lg block font-semibold hover:bg-blue-700 transition"><i class="fas fa-tachometer-alt mr-2"></i>Ke Dashboard</a>`;
    }
}

/**
 * Mengambil data dari API dengan penanganan error yang andal.
 * @param {string} action - Nama action untuk API.
 * @returns {Promise<Array>} - Array data dari API.
 */
async function fetchApiData(action) {
    const url = `https://bluewavebanten.my.id/api/api.php?action=${action}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);
        
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            return result.data;
        } else {
            console.warn(`API action '${action}' tidak mengembalikan data array yang valid.`);
            return [];
        }
    } catch (error) {
        console.error(`Gagal mengambil data untuk action '${action}':`, error);
        return [];
    }
}

/**
 * Fungsi utama yang mengorkestrasi pemuatan semua data untuk halaman utama.
 */
async function loadHomepageData() {
    // 1. Tampilkan spinner loading di semua bagian
    const featuredWisataEl = document.getElementById('featuredWisata');
    const featuredBlogEl = document.getElementById('featuredBlog');
    const featuredPromoEl = document.getElementById('featuredPromo'); 
    
    if (featuredWisataEl) featuredWisataEl.innerHTML = `<div class="col-span-3 text-center py-12"><div class="spinner mx-auto mb-4"></div><p class="text-gray-600">Memuat destinasi unggulan...</p></div>`;
    if (featuredBlogEl) featuredBlogEl.innerHTML = `<div class="col-span-3 text-center py-12"><div class="spinner mx-auto mb-4"></div><p class="text-gray-600">Memuat artikel terbaru...</p></div>`;
    if (featuredPromoEl) featuredPromoEl.innerHTML = `<div class="col-span-3 text-center py-12"><div class="spinner-white mx-auto mb-4"></div><p class="text-blue-200">Mencari penawaran terbaik...</p></div>`;

    // 2. Ambil semua data secara paralel
    const [wisataData, blogData, promoData] = await Promise.all([
        fetchApiData('get_wisata'),
        fetchApiData('get_blog'),
        fetchApiData('get_promo')
    ]);

    // 3. Simpan data wisata untuk fitur pencarian
    allWisataForSearch = wisataData;

    // 4. Perbarui semua elemen UI
    displayFeaturedDestinations(wisataData);
    
    // START REVISI: Menghapus filter status yang menyebabkan array blogData menjadi kosong.
    // Asumsi: API sudah memfilter artikel yang 'published'.
    displayFeaturedBlog(blogData);
    // END REVISI
    
    displayFeaturedPromo(promoData); 
    
    // 5. Perbarui statistik dinamis
    const totalWisataEl = document.getElementById('totalWisata');
    if (totalWisataEl) {
        totalWisataEl.textContent = wisataData.length;
    }
}


// =================================================================
// BAGIAN 2: FUNGSI-FUNGSI RENDERING (MENAMPILKAN KONTEN)
// =================================================================

function displayFeaturedDestinations(destinations) {
    const container = document.getElementById('featuredWisata');
    if (!container) return;
    if (destinations && destinations.length > 0) {
        container.innerHTML = destinations.slice(0, 3).map(dest => {
            const priceFormatted = (parseInt(dest.harga_tiket) || 0).toLocaleString('id-ID');
            const rating = dest.rating || 4.7;
            return `
                <div class="destination-card bg-white rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300" 
                     onclick="window.location.href='wisata-detail.html?id=${dest.id}'">
                    <div class="relative">
                        <img src="${dest.gambar_url || 'https://via.placeholder.com/600x400.png?text=BlueWave'}" alt="${dest.nama}" class="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105">
                        <div class="absolute top-4 left-4 bg-black/50 text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm border border-white/20">${dest.kategori}</div>
                        <div class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/60 to-transparent"></div>
                    </div>
                    <div class="p-5">
                        <div class="flex justify-between items-start gap-3 mb-2">
                            <h3 class="text-xl font-bold text-gray-800 line-clamp-2 group-hover:text-blue-600 transition-colors">${dest.nama}</h3>
                            <div class="flex-shrink-0 flex items-center bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md"><i class="fas fa-star text-xs text-yellow-300 mr-1.5"></i> <span>${rating}</span></div>
                        </div>
                        <p class="text-sm text-gray-500 mb-4 flex items-center"><i class="fas fa-map-marker-alt mr-2 opacity-70"></i> <span>${dest.lokasi}</span></p>
                        <div class="flex justify-between items-center pt-4 border-t border-gray-100 mt-4">
                            <div><span class="text-gray-500 text-xs">Mulai dari</span><p class="text-blue-600 font-bold text-lg leading-tight">Rp ${priceFormatted}</p></div>
                            <span class="text-blue-600 font-semibold text-sm group-hover:text-blue-800 transition-colors">Lihat Detail →</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = `<div class="col-span-3 text-center py-12 text-gray-500"><p>Gagal memuat destinasi unggulan atau belum ada data.</p></div>`;
    }
}

function displayFeaturedBlog(blogs) {
    const container = document.getElementById('featuredBlog');
    if (!container) return;
    if (blogs && blogs.length > 0) {
        container.innerHTML = blogs.slice(0, 3).map(blog => {
            
            // --- INI PERBAIKANNYA ---
            // Jika kategori NULL, gunakan "Info" sebagai fallback
            const kategori = (blog.kategori || 'Info').toUpperCase();
            // ------------------------

            return `
            <div class="blog-card bg-white rounded-2xl overflow-hidden cursor-pointer group shadow-lg hover:shadow-xl transition-all duration-300" onclick="window.location.href='blog-detail.html?id=${blog.id}'">
                <div class="relative overflow-hidden"><img src="${blog.gambar_url || 'https://via.placeholder.com/500x300.png?text=Blog'}" alt="${blog.judul}" class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"></div>
                <div class="p-6">
                    <span class="text-xs font-semibold text-blue-600">${kategori}</span>
                    <h3 class="text-xl font-bold text-gray-800 my-2 line-clamp-2 group-hover:text-blue-700">${blog.judul}</h3>
                    <p class="text-gray-600 text-sm mb-4 line-clamp-3">${blog.excerpt || ''}</p>
                    <span class="font-semibold text-blue-600 text-sm">Baca Selengkapnya →</span>
                </div>
            </div>
            `;
        }).join('');
    } else {
        container.innerHTML = `<div class="col-span-3 text-center py-12 text-gray-500"><p>Gagal memuat artikel terbaru atau belum ada data.</p></div>`;
    }
}

// Fungsi untuk menampilkan promo
function displayFeaturedPromo(promos) {
    const container = document.getElementById('featuredPromo');
    if (!container) return;
    if (promos && promos.length > 0) {
        container.innerHTML = promos.map(promo => {
            let diskonText = '';
            if (promo.jenis_diskon === 'persen') {
                diskonText = `Diskon ${promo.nilai_diskon}%`;
            } else if (promo.jenis_diskon === 'tetap') {
                diskonText = `Potongan Rp ${parseInt(promo.nilai_diskon).toLocaleString('id-ID')}`;
            }
            const tanggalAkhir = new Date(promo.tanggal_berakhir).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

            return `
                <div class="promo-card bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden group border border-white/20 transition hover:-translate-y-2 duration-300">
                    <img src="${promo.gambar_url || 'https://via.placeholder.com/600x400'}" alt="${promo.nama_promo}" class="w-full h-48 object-cover">
                    <div class="p-5 text-white">
                        <span class="inline-block bg-yellow-400 text-blue-900 text-sm font-bold px-4 py-1.5 rounded-full mb-3">${diskonText}</span>
                        <h3 class="text-xl font-bold line-clamp-2">${promo.nama_promo}</h3>
                        <p class="text-sm text-blue-200 mt-1">Untuk: ${promo.nama_wisata}</p>
                        <div class="mt-4 pt-4 border-t border-white/20 text-sm">
                            <p class="text-blue-200"><i class="far fa-clock mr-2"></i>Berakhir pada ${tanggalAkhir}</p>
                            <a href="#" class="mt-4 block w-full bg-white text-blue-600 font-bold py-3 text-center rounded-lg hover:bg-gray-200 transition">Lihat Detail Promo</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = `<div class="col-span-3 text-center py-12 text-blue-200"><p>Belum ada promo spesial yang tersedia saat ini.</p></div>`;
    }
}


// =================================================================
// BAGIAN 3: LOGIKA FITUR PENCARIAN (QUICK SEARCH)
// =================================================================

function displaySearchResults(results) {
    const searchResultsContainer = document.getElementById('searchResults');
    if (!searchResultsContainer) return;
    searchResultsContainer.innerHTML = '';
    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<div class="px-5 py-4 text-gray-500 italic">Destinasi tidak ditemukan...</div>';
    } else {
        searchResultsContainer.innerHTML = results.slice(0, 5).map(wisata => `
            <a href="wisata-detail.html?id=${wisata.id}" class="flex items-center px-5 py-4 hover:bg-gray-100 transition-colors border-b last:border-b-0">
                <img src="${wisata.gambar_url || 'https://via.placeholder.com/150'}" class="w-12 h-12 rounded-lg object-cover mr-4 flex-shrink-0">
                <div><p class="font-semibold text-gray-800 line-clamp-1">${wisata.nama}</p><p class="text-sm text-gray-500 line-clamp-1">${wisata.lokasi}</p></div>
            </a>
        `).join('');
    }
    searchResultsContainer.classList.remove('hidden');
}

function setupSearchFeature() {
    const searchInput = document.getElementById('searchInput');
    const searchResultsContainer = document.getElementById('searchResults');
    if (!searchInput || !searchResultsContainer) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (searchTerm.length < 2) {
            searchResultsContainer.classList.add('hidden');
            return;
        }
        const results = allWisataForSearch.filter(w => w.nama.toLowerCase().includes(searchTerm) || w.lokasi.toLowerCase().includes(searchTerm));
        displaySearchResults(results);
    });

    searchInput.addEventListener('blur', () => setTimeout(() => searchResultsContainer.classList.add('hidden'), 200));
}


// =================================================================
// BAGIAN 4: TITIK MASUK UTAMA APLIKASI (INITIALIZATION)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Periksa status otentikasi
    checkAuthStatus();

    // 2. Muat semua konten dinamis
    loadHomepageData(); 
    
    // 3. Siapkan fitur pencarian
    setupSearchFeature();
    
    // 4. Atur event listener untuk elemen UI lainnya
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const dropdownButton = document.getElementById('destinasiDropdown');
    const dropdownMenu = document.getElementById('destinasiMenu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }
    if (dropdownButton && dropdownMenu) {
        dropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });
    }
    
    // Penutup Menu Universal
    document.addEventListener('click', (e) => {
        if (mobileMenu && !mobileMenu.classList.contains('hidden') && mobileMenuBtn && !mobileMenuBtn.contains(e.target)) {
            mobileMenu.classList.add('hidden');
        }
        if (dropdownMenu && !dropdownMenu.classList.contains('hidden') && dropdownButton && !dropdownButton.contains(e.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });
});