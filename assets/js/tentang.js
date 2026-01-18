// =================================================================
// File: assets/js/tentang.js (LENGKAP DAN AKTIF)
// =================================================================

// --- 1. Fungsi Umum & Status Auth ---
function checkAuthStatus() {
    const token = localStorage.getItem('auth_token');
    const user = JSON.parse(localStorage.getItem('user_data') || '{}');
    const authSection = document.getElementById('authSection');
    const mobileAuthSection = document.getElementById('mobileAuthSection');

    if (authSection && mobileAuthSection && token && user.name) {
        authSection.innerHTML = `<div class="flex items-center space-x-4"><span class="text-gray-700">Halo, ${user.name}</span><a href="dashboard.html" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition duration-300"><i class="fas fa-tachometer-alt mr-2"></i>Dashboard</a></div>`;
        mobileAuthSection.innerHTML = `<div class="space-y-3"><div class="text-center text-gray-700 font-medium">Halo, ${user.name}</div><a href="dashboard.html" class="bg-blue-600 text-white px-4 py-2 rounded-lg block text-center hover:bg-blue-700 transition duration-300"><i class="fas fa-tachometer-alt mr-2"></i>Dashboard</a></div>`;
    }
}

// --- 2. Fungsi Data & Rendering ---

function getStarIcons(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    let starsHtml = '';
    
    for (let i = 0; i < fullStars; i++) {
        starsHtml += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        starsHtml += '<i class="fas fa-star-half-alt"></i>';
    }
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
        starsHtml += '<i class="far fa-star"></i>'; 
    }
    return starsHtml;
}

async function loadAboutData() {
    try {
        // --- DATA DUMMY UNTUK TIM (4 Anggota Tim) ---
        const teamData = [
            { name: 'Muhammad Habibi', role: 'Full Stuck Engineer', bio: 'Full-stack developer yang memastikan platform berjalan lancar dan optimal.', image: 'https://bluewavebanten.my.id/assets/images/hbb.jpg', social: { linkedin: '#', twitter: '#', instagram: 'https://www.instagram.com/mhabibi0/' } },
            { name: 'Cinta Putri Maharani', role: 'Administration Head', bio: 'Mengelola administrasi dan memastikan koordinasi tim berjalan lancar.', image: 'https://bluewavebanten.my.id/assets/images/lopek.jpg', social: { linkedin: '#', twitter: '#', instagram: 'https://www.instagram.com/cn._.cinta/' } },
            { name: 'Muhammad Roman Rihardi', role: 'GIS Analyst & SystemDesigner', bio: 'Fokus pada analisis data spasial, pembuatan pemetaan digital, serta perancangan alur kerja sistem dan web untuk memastikan proses mudah dipahami.', image: 'https://bluewavebanten.my.id/assets/images/rmn.jpg', social: { linkedin: '#', twitter: '#', instagram: 'https://www.instagram.com/muhammadroman04/' } },
            { name: 'Zaskia Dwiki Utami', role: 'Design Graphics', bio: 'Mendesain visual dan memastikan identitas grafis tetap konsisten.', image: 'https://bluewavebanten.my.id/assets/images/kiaa.jpg', social: { linkedin: '#', twitter: '#', instagram: 'https://www.instagram.com/zaskia.dwiki/' } }
        ];

        // --- DATA DUMMY UNTUK FAQ ---
        const faqData = [
            { question: 'Apa itu BlueWave Banten?', answer: 'BlueWave Banten adalah platform digital yang menyajikan informasi lengkap destinasi wisata bahari di Provinsi Banten.' },
            { question: 'Apakah informasi di website ini terpercaya?', answer: 'Ya, semua informasi diverifikasi langsung oleh tim kami yang terdiri dari local expert dan travel enthusiast.' },
            { question: 'Bagaimana cara menjadi mitra BlueWave Banten?', answer: 'Silakan hubungi kami melalui formulir kontak di bawah atau kirim email ke partnership@bluewavebanten.my.id.' },
            { question: 'Apakah ada aplikasi mobile?', answer: 'Saat ini belum, tetapi pengembangan aplikasi mobile adalah fokus utama kami di tahun 2024.' }
        ];
        
        // Memastikan DOM sudah settle sebelum merender konten
        await new Promise(resolve => setTimeout(resolve, 50)); 

        displayTeamMembers(teamData);
        displayFAQ(faqData);

    } catch (error) {
        console.error('Fatal Error saat loading data About:', error);
        // Menampilkan pesan error jika gagal memuat data
        const defaultError = `<div class="col-span-3 text-center py-12 text-red-600">Gagal memuat data Tim/FAQ. Cek Console.</div>`;
        document.getElementById('teamMembers').innerHTML = defaultError;
        document.getElementById('faqList').innerHTML = defaultError;
    }
}

function displayTeamMembers(members) {
    const container = document.getElementById('teamMembers');
    if (!container) return;
    
    // Pastikan container memiliki kelas lg:grid-cols-4 jika 4 anggota
    if (members.length === 4) {
        container.classList.remove('lg:grid-cols-3');
        container.classList.add('lg:grid-cols-4');
    }
    
    if (members && members.length > 0) {
        container.innerHTML = members.map(member => `
            <div class="team-card bg-white rounded-2xl overflow-hidden text-center group shadow-lg hover:shadow-xl">
                <div class="relative overflow-hidden">
                    <img src="${member.image}" alt="${member.name}" class="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-6">
                        <div class="flex space-x-3">
                            <a href="${member.social.linkedin}" class="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors duration-200"><i class="fab fa-linkedin-in"></i></a>
                            <a href="${member.social.twitter}" class="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-blue-400 hover:text-white transition-colors duration-200"><i class="fab fa-twitter"></i></a>
                            <a href="${member.social.instagram}" class="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:bg-pink-600 hover:text-white transition-colors duration-200"><i class="fab fa-instagram"></i></a>
                        </div>
                    </div>
                </div>
                <div class="p-6">
                    <h3 class="text-xl font-bold text-gray-800 mb-2">${member.name}</h3>
                    <div class="text-blue-600 font-semibold mb-3">${member.role}</div>
                    <p class="text-gray-600 text-sm leading-relaxed">${member.bio}</p>
                </div>
            </div>
        `).join('');
    }
}

function displayFAQ(faqs) {
    const container = document.getElementById('faqList');
    if (!container) return;

    if (faqs && faqs.length > 0) {
        container.innerHTML = faqs.map(faq => `
            <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                <div class="flex items-start justify-between cursor-pointer" onclick="toggleFAQ(this)">
                    <h3 class="text-lg font-semibold text-gray-800 pr-4">${faq.question}</h3>
                    <i class="fas fa-chevron-down text-blue-600 mt-1 transition-transform duration-300"></i>
                </div>
                <div class="faq-answer mt-4 hidden">
                    <p class="text-gray-600 leading-relaxed">${faq.answer}</p>
                </div>
            </div>
        `).join('');
    }
}

function toggleFAQ(element) {
    const answer = element.nextElementSibling;
    const icon = element.querySelector('i');
    answer.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');
}

// --- 3. Fungsi Contact Form (Implementasi Final) ---
const handleContactForm = async function(e) {
    e.preventDefault();
    const contactForm = e.target;
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    // --- Ambil Data Formulir ---
    const formData = new FormData(contactForm);
    const dataToSend = {
        name: formData.get('Nama Lengkap'), // Mapping 'Nama Lengkap' ke 'name'
        email: formData.get('Email'),
        subject: formData.get('Subjek'),
        message: formData.get('Pesan')
    };

    // Validasi dasar
    if (!dataToSend.name || !dataToSend.email || !dataToSend.subject || !dataToSend.message) {
        alert("Semua field harus diisi.");
        return;
    }

    submitBtn.innerHTML = '<div class="spinner mr-2"></div> Mengirim...';
    submitBtn.disabled = true;
    
    let isSuccess = false;
    let serverMessage = '';

    try {
        // ASUMSI: API endpoint untuk menyimpan data ke contact_submissions
        const response = await fetch('https://bluewavebanten.my.id/api/api.php?action=send_contact_form', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSend), 
        });
        
        if (!response.ok) {
            // Coba baca teks response untuk debugging error 500
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const result = await response.json();
        serverMessage = result.message || 'Pesan berhasil terkirim.';

        if (result.success) {
            isSuccess = true;
        }

    } catch (error) {
        serverMessage = 'Kesalahan saat koneksi ke server. Mohon coba lagi.';
        console.error('Contact form error:', error);
    }
    
    // --- Feedback Visual ---
    
    if (isSuccess) {
        submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Terkirim!';
        submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-red-600', 'hover:bg-red-700');
        submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        alert('Sukses! ' + serverMessage);
        contactForm.reset();
    } else {
        submitBtn.innerHTML = '<i class="fas fa-exclamation-triangle mr-2"></i> Gagal!';
        submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-green-600', 'hover:bg-green-700');
        submitBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        alert('Gagal! ' + serverMessage);
    }
    
    // Kembalikan tombol ke keadaan awal setelah 3 detik
    setTimeout(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'bg-red-600', 'hover:bg-red-700');
        submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    }, 3000);
};


// --- 4. Pemicu Utama (DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', function() {
    
    loadAboutData();
    checkAuthStatus();
    
    // Pemicu Mobile Menu
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }
    
    // Pemicu Dropdown Header
    const dropdownButton = document.getElementById('destinasiDropdown');
    const dropdownMenu = document.getElementById('destinasiMenu');

    if (dropdownButton) {
        dropdownButton.addEventListener('click', (event) => {
            event.stopPropagation(); 
            dropdownMenu.classList.toggle('hidden');
        });
    }

    // Pemicu Form Kontak
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        // Memicu event handler saat form disubmit
        contactForm.addEventListener('submit', handleContactForm);
    }

    // Penutup Menu Universal
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('mobileMenu');
        const button = document.getElementById('mobileMenuBtn');
        if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
            menu.classList.add('hidden');
        }

        const dropdownMenu = document.getElementById('destinasiMenu');
        const dropdownButton = document.getElementById('destinasiDropdown');
        if (dropdownMenu && dropdownButton && !dropdownMenu.classList.contains('hidden') && !dropdownButton.contains(event.target) && !event.target.closest('#destinasiDropdown')) {
            dropdownMenu.classList.add('hidden');
        }
    });

});