// =================================================================
// File: assets/js/blog.js (REVISI AKHIR: SINKRONISASI KATEGORI ADMIN & LOAD MORE)
// =================================================================

// --- Variabel Global ---
let allArticles = []; // Menyimpan semua artikel dari API
let currentFilteredData = []; // Data yang sedang difilter/ditampilkan saat ini
let currentPage = 0; // Halaman saat ini untuk fitur Load More
const articlesPerPage = 6; // Jumlah artikel yang ditampilkan per load

// Daftar kategori dari Dashboard Admin (SUMBER KEBENARAN)
const ADMIN_CATEGORIES = ['Wisata', 'Tips', 'Berita', 'Promo', 'Kuliner'];

// =================================================================
// BAGIAN 1: PEMANGGILAN API & PENGAMBILAN DATA
// =================================================================

/**
 * Mengambil semua data blog dari API dan menanganinya.
 */
async function loadAllBlogData() {
    const articlesGrid = document.getElementById('articlesGrid');
    const popularArticlesContainer = document.getElementById('popularArticles');
    const categoriesListContainer = document.getElementById('categoriesList');
    
    const loadingHtml = `<div class="col-span-full text-center py-12"><div class="spinner mx-auto mb-4"></div><p class="text-gray-600">Memuat artikel...</p></div>`;
    if (articlesGrid) articlesGrid.innerHTML = loadingHtml.replace('col-span-full', 'col-span-2');
    if (popularArticlesContainer) popularArticlesContainer.innerHTML = loadingHtml.replace('col-span-full', '');
    if (categoriesListContainer) categoriesListContainer.innerHTML = loadingHtml.replace('col-span-full', '');

    try {
        const response = await fetch('https://bluewavebanten.my.id/api/api.php?action=get_blog');
        if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
            
            // Map data: pastikan status published dan kategori sesuai/didefaultkan ke 'Wisata'
            return result.data.map(article => ({ 
                ...article, 
                status: 'published',
                kategori: (article.kategori && ADMIN_CATEGORIES.includes(article.kategori.trim())) 
                          ? article.kategori.trim() 
                          : 'Wisata'
            }));
        } else {
            throw new Error(result.message || 'Format data dari API tidak valid.');
        }
    } catch (error) {
        console.error('Gagal memuat data blog:', error);
        if (articlesGrid) {
             articlesGrid.innerHTML = `<div class="col-span-2 text-center py-12 text-red-500">
                <p class="font-semibold">Gagal memuat artikel dari server.</p>
                <p class="text-sm">Silakan coba lagi nanti.</p>
            </div>`;
        }
        return [];
    }
}


// =================================================================
// BAGIAN 2: FUNGSI-FUNGSI UNTUK MERENDER KONTEN (TAMPILAN)
// =================================================================

function displayFeaturedArticle(articles) {
    if (articles.length === 0) return;
    const featured = articles[0]; 
    
    const h2 = document.querySelector('.featured-article h2');
    const p = document.querySelector('.featured-article p');
    const authorSpan = document.getElementById('featuredArticleAuthor');
    const dateSpan = document.getElementById('featuredArticleDate');
    const img = document.querySelector('.featured-article img');
    const button = document.querySelector('.featured-article button');

    if (h2) h2.textContent = featured.judul || 'Judul Tidak Tersedia';
    if (p) p.textContent = featured.excerpt || 'Baca lebih lanjut untuk menemukan detail menarik...';
    if (authorSpan) authorSpan.textContent = featured.penulis_name || 'Admin BlueWave';
    if (dateSpan) dateSpan.textContent = featured.created_at ? new Date(featured.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Tanggal Tidak Tersedia';
    if (img) img.src = featured.gambar_url || 'https://via.placeholder.com/800x400.png?text=BlueWave+Banten';
    if (button) button.onclick = () => window.location.href = `blog-detail.html?id=${featured.id}`;
}

/**
 * Menampilkan daftar artikel di grid utama, mendukung Load More.
 */
function displayArticles(articles, reset = true) {
    const container = document.getElementById('articlesGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (!container) return;

    if (reset) {
        currentFilteredData = articles;
        currentPage = 0;
        container.innerHTML = '';
        if (loadMoreBtn) loadMoreBtn.classList.remove('hidden');
    }
    
    const start = currentPage * articlesPerPage;
    const end = start + articlesPerPage;
    const articlesToDisplay = currentFilteredData.slice(start, end);

    if (reset && currentFilteredData.length === 0) {
        container.innerHTML = '<div class="col-span-2 text-center py-12 text-gray-500">Tidak ada artikel yang cocok dengan kriteria Anda.</div>';
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        return;
    }
    
    const newHtml = articlesToDisplay.map(article => {
        const kategori = article.kategori.toUpperCase(); 
        const fullContent = article.excerpt || article.konten || ''; 
        const deskripsi = fullContent.substring(0, 100) + (fullContent.length > 100 ? '...' : '');

        return `
            <div class="article-card bg-white rounded-2xl shadow-lg overflow-hidden group transition hover:shadow-xl cursor-pointer" 
                 onclick="window.location.href='blog-detail.html?id=${article.id}'">
                <div class="relative overflow-hidden">
                    <img src="${article.gambar_url || 'https://via.placeholder.com/500x300.png?text=Blog+Image'}" alt="${article.judul}" class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300">
                </div>
                <div class="p-6">
                    <span class="text-xs font-semibold text-blue-600">${kategori}</span>
                    <h3 class="text-lg font-bold text-gray-800 my-2 line-clamp-2 group-hover:text-blue-700">
                        ${article.judul}
                    </h3>
                    <p class="text-gray-600 text-sm mb-4 line-clamp-3">
                        ${deskripsi}
                    </p>
                    <span class="font-semibold text-blue-600 text-sm">Baca Selengkapnya →</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML += newHtml;

    currentPage++;
    const totalLoaded = currentPage * articlesPerPage;
    if (loadMoreBtn) {
        if (totalLoaded >= currentFilteredData.length) {
            loadMoreBtn.classList.add('hidden');
        } else {
            loadMoreBtn.classList.remove('hidden');
            loadMoreBtn.onclick = () => displayArticles(currentFilteredData, false); 
        }
    }
}


function displayPopularArticles(articles) {
    const container = document.getElementById('popularArticles');
    if (!container) return;

    const popular = articles.slice(0, 3);

    if (popular.length > 0) {
        container.innerHTML = popular.map(article => `
            <div class="flex items-start space-x-3 group cursor-pointer" onclick="window.location.href='blog-detail.html?id=${article.id}'">
                <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <img src="${article.gambar_url || 'https://via.placeholder.com/150'}" alt="${article.judul}" class="w-full h-full object-cover">
                </div>
                <div>
                    <h4 class="font-semibold text-gray-800 group-hover:text-blue-600 transition text-sm leading-tight line-clamp-2">
                        ${article.judul}
                    </h4>
                    <p class="text-gray-500 text-xs mt-1">${article.created_at ? new Date(article.created_at).toLocaleDateString('id-ID') : 'N/A'}</p>
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-gray-500 text-sm">Tidak ada artikel populer saat ini.</p>';
    }
}

/**
 * Menghitung dan menampilkan jumlah artikel per kategori di sidebar.
 */
function displayCategories(articles) {
    const container = document.getElementById('categoriesList');
    if (!container) return;

    const publishedArticles = articles.filter(a => a.status === 'published');
    
    const categoryCounts = {};
    publishedArticles.forEach(article => {
        const cat = article.kategori; 
        
        if (cat) { 
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
    });

    const categories = ADMIN_CATEGORIES.sort(); 
    
    if (categories.length > 0) {
        container.innerHTML = categories.map(cat => `
            <div class="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0 cursor-pointer" onclick="filterByCategory('${cat}')">
                <span class="text-gray-700 hover:text-blue-600 transition">${cat}</span>
                <span class="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold">${categoryCounts[cat] || 0}</span>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<p class="text-gray-500 text-sm">Tidak ada kategori yang tersedia.</p>';
    }
}

// =================================================================
// BAGIAN 3: LOGIKA FILTERING, PENCARIAN, DAN EVENT HANDLERS
// =================================================================

/**
 * Memfilter artikel berdasarkan kategori yang dipilih dan menampilkannya kembali.
 */
function filterByCategory(category) {
    const publishedArticles = allArticles.filter(a => a.status === 'published'); 
    let filteredData;
    
    if (category === 'Semua Artikel') {
        filteredData = publishedArticles;
    } else {
        filteredData = publishedArticles.filter(article => 
            article.kategori.toLowerCase() === category.toLowerCase()
        );
    }
    
    displayArticles(filteredData, true);

    const targetCategory = category.toLowerCase();
    
    // Update tampilan tombol filter yang aktif
    document.querySelectorAll('.filter-btn').forEach(button => {
        const buttonCategory = button.textContent.trim().replace(/[\u{1F300}-\u{1F64F}]/gu, '').trim().toLowerCase(); 
        
        if (buttonCategory === targetCategory || (targetCategory === 'semua artikel' && buttonCategory === 'semua artikel')) {
            button.classList.add('active', 'bg-blue-600', 'text-white');
            button.classList.remove('bg-white', 'text-gray-700', 'border-2', 'border-gray-200', 'hover:border-blue-500');
        } else {
            button.classList.remove('active', 'bg-blue-600', 'text-white');
            button.classList.add('bg-white', 'text-gray-700', 'border-2', 'border-gray-200', 'hover:border-blue-500');
        }
    });
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = (searchInput ? searchInput.value.toLowerCase() : '').trim();
    
    if (searchTerm.length < 2 && searchTerm.length !== 0) {
        alert("Masukkan minimal 2 karakter untuk pencarian.");
        return;
    }

    const publishedArticles = allArticles.filter(a => a.status === 'published');
    
    const filtered = publishedArticles.filter(article => {
        const title = (article.judul || '').toLowerCase();
        const excerpt = (article.excerpt || '').toLowerCase();
        const content = (article.konten || '').toLowerCase(); 
        
        return title.includes(searchTerm) || excerpt.includes(searchTerm) || content.includes(searchTerm);
    });
    
    displayArticles(filtered, true);
    filterByCategory('Semua Artikel'); 
}

/**
 * Handle fungsi berlangganan/newsletter ke API.
 */
async function handleNewsletter() {
    const emailInput = document.getElementById('newsletterEmailInput');
    const submitBtn = document.getElementById('newsletterSubmitBtn');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        alert('Mohon masukkan alamat email yang valid.');
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Memproses...';
    submitBtn.disabled = true;

    try {
        // Asumsi API endpoint untuk menyimpan email ke newsletter_subscribers
        const response = await fetch('https://bluewavebanten.my.id/api/api.php?action=subscribe_newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        
        // Cek apakah response OK sebelum mencoba parse JSON
        if (!response.ok) {
            // Coba baca teks response untuk debugging error 500
            const errorText = await response.text();
            throw new Error(`Server Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();

        if (result.success) {
            alert(`Sukses! ${email} telah terdaftar. Terima kasih!`);
            if (emailInput) emailInput.value = '';
        } else {
            alert(`Gagal: ${result.message || 'Email mungkin sudah terdaftar.'}`);
        }
        
    } catch (error) {
        console.error('API Newsletter Error:', error);
        alert('Terjadi kesalahan server saat mendaftar. Silakan coba lagi. Detail: ' + error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}


/**
 * Mengatur semua event listener untuk interaksi pengguna.
 */
function setupEventListeners() {
    // Mobile Menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => mobileMenu.classList.toggle('hidden'));
    }

    // Dropdown Header
    const dropdownButton = document.getElementById('destinasiDropdown');
    const dropdownMenu = document.getElementById('destinasiMenu');
    if (dropdownButton) {
        dropdownButton.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownMenu.classList.toggle('hidden');
        });
    }

    // Penutup Menu Universal (jika klik di luar)
    document.addEventListener('click', (event) => {
        if (mobileMenu && !mobileMenu.classList.contains('hidden') && mobileMenuBtn && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
        if (dropdownMenu && !dropdownMenu.classList.contains('hidden') && dropdownButton && !dropdownButton.contains(event.target)) {
            dropdownMenu.classList.add('hidden');
        }
    });

    // Pemicu Progress Bar saat scroll
    window.addEventListener('scroll', () => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (window.pageYOffset / docHeight) * 100;
        const progressBar = document.getElementById('readingProgress');
        if (progressBar) progressBar.style.width = `${scrollPercent}%`;
    });

    // Pemicu Tombol Filter Kategori
    // Tombol di HTML harus disesuaikan dengan ADMIN_CATEGORIES
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            const category = this.textContent.trim().replace(/[\u{1F300}-\u{1F64F}]/gu, '').trim(); 
            filterByCategory(category);
        });
    });

    // Pemicu Kotak Pencarian (Search Box)
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.querySelector('.search-box button');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') performSearch();
        });
    }
    if (searchButton) searchButton.addEventListener('click', performSearch);
    
    // Pemicu Tombol Newsletter di Sidebar
    const newsletterSubmitBtn = document.getElementById('newsletterSubmitBtn');
    if (newsletterSubmitBtn) {
        newsletterSubmitBtn.addEventListener('click', handleNewsletter);
    }
    
    // Pemicu Tombol Subscribe (simulasi)
    const subscribeBtn = document.getElementById('subscribeBtn');
    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => alert('Fitur Subscribe/RSS sedang dikembangkan.'));
    }
}


// =================================================================
// BAGIAN 4: TITIK MASUK UTAMA APLIKASI (INITIALIZATION)
// =================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Ambil semua data dari API terlebih dahulu.
    allArticles = await loadAllBlogData();

    // Gunakan semua data yang diterima karena API sudah memfilter yang 'published'.
    const publishedArticles = allArticles; 
    
    // 3. Render semua komponen halaman dengan data yang sudah siap.
    if (publishedArticles.length > 0) {
        displayFeaturedArticle(publishedArticles);
        // Tampilkan 6 artikel pertama saja (reset = true)
        displayArticles(publishedArticles, true); 
        displayPopularArticles(publishedArticles);
    } else {
        const articlesGrid = document.getElementById('articlesGrid');
        if (articlesGrid) articlesGrid.innerHTML = '<div class="col-span-2 text-center py-12 text-gray-500">Tidak ada artikel yang dapat ditampilkan saat ini.</div>';
    }
    
    // Kategori dihitung dari semua artikel
    displayCategories(allArticles);
    
    // 4. Setelah semua konten dirender, atur semua event listener.
    setupEventListeners();
});