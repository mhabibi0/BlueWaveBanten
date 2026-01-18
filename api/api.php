<?php
// api.php - VERSI FINAL REVISI (FIX CURL ISSUE)
// ======================================================

require_once 'config.php';

try {
    $conn = getDBConnection();
    
    $action = $_GET['action'] ?? '';
    $input = file_get_contents('php://input');
    $data = json_decode($input, true) ?? [];

    // KODE LOGGING DETAIL EXCEPTION (Disederhanakan untuk menghindari Notice)
    // Blok ini akan dihapus/dilewati untuk fokus pada router utama

    // Public actions (no token required)
    $publicActions = ['get_wisata', 'get_blog', 'get_weather', 'get_promo', 'get_wisata_detail', 'subscribe_newsletter', 'send_contact_form', 'get_wisata_forecast'];
    
    if (in_array($action, $publicActions)) {
        handlePublicAction($conn, $action, $data);
    } else {
        handlePrivateAction($conn, $action, $data);
    }

} catch (Exception $e) {
    // KODE LOGGING DETAIL EXCEPTION SAAT RUNTIME
    error_log(
        "API RUNTIME EXCEPTION: " . $e->getMessage() . 
        " on line " . $e->getLine() . 
        " in file " . $e->getFile() . 
        "\nStack Trace: " . $e->getTraceAsString()
    );
    // END LOGGING

    $code = $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
    sendJsonResponse(null, [
        'success' => false,
        'message' => 'API Error: ' . $e->getMessage()
    ], $code);
}

// =============================================
//  PUBLIC ACTIONS
// =============================================
function handlePublicAction($conn, $action, $data) {
    switch ($action) {
        case 'get_wisata':
        case 'get_wisata_detail':
            $token_from_body = $data['token'] ?? null;
            getWisataData($conn, $token_from_body, $data);
            break;
        case 'get_blog':
            getBlogData($conn);
            break;
        case 'get_weather':
            getWeatherData($data);
            break;
        case 'get_promo':
            getPromoData($conn);
            break;
        case 'subscribe_newsletter':
            subscribeNewsletter($conn, $data);
            break;
        case 'send_contact_form':
            sendContactForm($conn, $data);
            break;
        case 'get_wisata_forecast':
            getWisataForecast($data);
            break;
        default:
            throw new Exception('Action publik tidak dikenali', 404);
    }
}

function sendContactForm($conn, $data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }

    $name = trim($data['name'] ?? '');
    $email = trim($data['email'] ?? '');
    $subject = trim($data['subject'] ?? '');
    $message = trim($data['message'] ?? '');

    if (empty($name) || empty($email) || empty($subject) || empty($message)) {
        throw new Exception('Semua field wajib diisi', 400);
    }

    $stmt = $conn->prepare("INSERT INTO contact_submissions (name, email, subject, message, created_at) VALUES (?, ?, ?, ?, NOW())");
    $stmt->bind_param("ssss", $name, $email, $subject, $message);

    if ($stmt->execute()) {
        sendJsonResponse($conn, [
            'success' => true,
            'message' => 'Pesan kontak berhasil terkirim. Kami akan segera menghubungi Anda.'
        ], 200);
    } else {
        error_log("Gagal menyimpan pesan kontak: " . $stmt->error);
        throw new Exception('Gagal menyimpan pesan ke database.', 500);
    }
}

// REVISI: Menambahkan penanganan filter (search, kategori, harga)
function getWisataData($conn, $token_from_body = null, $data = []) {
    $id = $_GET['id'] ?? ($data['id'] ?? null);
    $user_id = 0;
    
    // Ambil parameter filter dari GET/data
    $search = $_GET['search'] ?? null;
    $kategori = $_GET['kategori'] ?? null;
    $harga = $_GET['harga'] ?? null; 

    if ($token_from_body) {
        $auth = verifyToken($token_from_body);
        if ($auth['authenticated'] && $auth['role'] === 'user') $user_id = $auth['user_id'];
    }
    
    if ($id) {
        $stmt = $conn->prepare("SELECT id, nama, kategori, lokasi, harga_tiket, gambar_url, deskripsi, latitude, longitude, fasilitas, tips FROM wisata WHERE id = ? AND is_active = 1");
        if (!$stmt) throw new Exception("Database prepare error: " . $conn->error, 500);
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        if (!$item) throw new Exception('Data wisata tidak ditemukan', 404);
        
        if ($user_id > 0) {
            $fav_check = $conn->prepare("SELECT id FROM favorit WHERE user_id = ? AND wisata_id = ?");
            if ($fav_check) {
                $fav_check->bind_param("ii", $user_id, $id);
                $fav_check->execute();
                $item['is_favorite'] = $fav_check->get_result()->num_rows > 0;
                $fav_check->close();
            } else {
                $item['is_favorite'] = false;
            }
        } else {
             $item['is_favorite'] = false;
        }
        
        sendJsonResponse($conn, ['success' => true, 'data' => $item]);
    } else {
        // Logika untuk GET LIST dengan Filter
        $sql = "SELECT id, nama, kategori, lokasi, harga_tiket, gambar_url, latitude, longitude FROM wisata WHERE is_active = 1";
        $params = [];
        $types = "";

        if ($search) {
            $sql .= " AND (nama LIKE ? OR lokasi LIKE ? OR kategori LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $types .= "sss";
        }
        if ($kategori) {
            $sql .= " AND kategori = ?";
            $params[] = $kategori;
            $types .= "s";
        }
        if ($harga) {
            list($min, $max) = explode('-', $harga);
            if (is_numeric($min) && is_numeric($max)) {
                $sql .= " AND harga_tiket BETWEEN ? AND ?";
                $params[] = (float)$min;
                $params[] = (float)$max;
                $types .= "dd";
            }
        }

        $sql .= " ORDER BY nama ASC";

        if (!empty($params)) {
            $stmt = $conn->prepare($sql);
            if (!$stmt) throw new Exception("Database prepare error for filter: " . $conn->error, 500);
            $stmt->bind_param($types, ...$params); 
            $stmt->execute();
            $result = $stmt->get_result();
        } else {
            $result = $conn->query($sql);
        }

        if (!$result) {
             error_log("Gagal mengambil daftar wisata: " . $conn->error);
             sendJsonResponse($conn, ['success' => true, 'data' => []]);
        }
        $items_raw = $result->fetch_all(MYSQLI_ASSOC);
        
        $items = [];
        // Logika Favorit
        if ($user_id > 0) {
            $fav_result = $conn->query("SELECT wisata_id FROM favorit WHERE user_id = $user_id");
            $favorites = [];
            if ($fav_result) {
                while($row = $fav_result->fetch_assoc()) {
                    $favorites[$row['wisata_id']] = true;
                }
            }
            
            foreach ($items_raw as $item) {
                $item['is_favorite'] = isset($favorites[$item['id']]);
                $items[] = $item;
            }
        } else {
            foreach ($items_raw as $item) {
                $item['is_favorite'] = false;
                $items[] = $item;
            }
        }

        sendJsonResponse($conn, ['success' => true, 'data' => $items]);
    }
}

function getBlogData($conn) {
    $id = $_GET['id'] ?? null;
    if ($id) {
        $stmt = $conn->prepare("SELECT bp.*, au.name as penulis_name FROM blog_posts bp LEFT JOIN admin_users au ON bp.penulis_id = au.id WHERE bp.id = ? AND bp.status = 'published'");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        if (!$item) throw new Exception('Artikel tidak ditemukan', 404);
        sendJsonResponse($conn, ['success' => true, 'data' => $item]);
    } else {
        $result = $conn->query("SELECT bp.id, bp.judul, bp.excerpt, bp.gambar_url, bp.created_at, au.name as penulis_name FROM blog_posts bp LEFT JOIN admin_users au ON bp.penulis_id = au.id WHERE bp.status = 'published' ORDER BY bp.created_at DESC LIMIT 10");
        $items = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse($conn, ['success' => true, 'data' => $items]);
    }
}

// REVISI FUNGSI: Menambahkan CURLOPT_SSL_VERIFYPEER => false
function getWeatherData($data) {
    $lat = filter_var($data['lat'] ?? $_GET['lat'] ?? null, FILTER_VALIDATE_FLOAT);
    $lon = filter_var($data['lon'] ?? $_GET['lon'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($lat === false || $lon === false) throw new Exception('Koordinat tidak valid', 400);
    $api_key = WEATHER_API_KEY; 
    $url = "https://api.openweathermap.org/data/2.5/weather?lat={$lat}&lon={$lon}&units=metric&lang=id&appid={$api_key}";
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url, 
        CURLOPT_RETURNTRANSFER => true, 
        CURLOPT_SSL_VERIFYPEER => false, // Perbaikan CURL
        CURLOPT_TIMEOUT => 10
    ]);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($http_code == 200 && $response) {
        sendJsonResponse(null, json_decode($response, true));
    } else {
        throw new Exception("Gagal memuat data cuaca (HTTP Code: $http_code)", 503);
    }
}

function getPromoData($conn) {
    $result = $conn->query("
        SELECT p.id, p.nama_promo, p.nilai_diskon, p.jenis_diskon, p.tanggal_berakhir,
               w.nama as nama_wisata, w.gambar_url 
        FROM promo p
        LEFT JOIN wisata w ON p.wisata_id = w.id
        WHERE p.status = 'active' AND p.tanggal_berakhir >= CURDATE()
        ORDER BY p.created_at DESC
        LIMIT 5
    ");
    
    $items = $result->fetch_all(MYSQLI_ASSOC);
    sendJsonResponse($conn, ['success' => true, 'data' => $items]);
}

function subscribeNewsletter($conn, $data) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Method tidak diizinkan', 405);
    }

    $email = trim($data['email'] ?? '');

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new Exception('Alamat email tidak valid', 400);
    }

    $check_stmt = $conn->prepare("SELECT id FROM newsletter_subscribers WHERE email = ?");
    $check_stmt->bind_param("s", $email);
    $check_stmt->execute();
    if ($check_stmt->get_result()->num_rows > 0) {
        sendJsonResponse($conn, [
            'success' => false,
            'message' => 'Email ini sudah terdaftar sebelumnya.'
        ], 409); 
        return; 
    }
    $check_stmt->close();

    $stmt = $conn->prepare("INSERT INTO newsletter_subscribers (email) VALUES (?)");
    $stmt->bind_param("s", $email);

    if ($stmt->execute()) {
        sendJsonResponse($conn, ['success' => true, 'message' => 'Berlangganan berhasil.'], 200);
    } else {
        error_log("Gagal menyimpan email: " . $stmt->error);
        throw new Exception('Gagal menyimpan data ke database.', 500);
    }
}

// REVISI FUNGSI: Menambahkan CURLOPT_SSL_VERIFYPEER => false
function getWisataForecast($data) {
    $lat = filter_var($data['lat'] ?? $_GET['lat'] ?? null, FILTER_VALIDATE_FLOAT);
    $lon = filter_var($data['lon'] ?? $_GET['lon'] ?? null, FILTER_VALIDATE_FLOAT);
    $target_date_str = $data['date'] ?? $_GET['date'] ?? null; // Format YYYY-MM-DD

    if ($lat === false || $lon === false || !$target_date_str) {
        throw new Exception('Koordinat dan tanggal target diperlukan', 400);
    }
    
    try {
        $target_date_obj = new DateTime($target_date_str . ' 12:00:00', new DateTimeZone('UTC'));
        $target_date_formatted = $target_date_obj->format('Y-m-d');
    } catch (Exception $e) {
        throw new Exception('Format tanggal tidak valid', 400);
    }

    $api_key = WEATHER_API_KEY; 
    $url = "https://api.openweathermap.org/data/2.5/forecast?lat={$lat}&lon={$lon}&units=metric&lang=id&appid={$api_key}";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url, 
        CURLOPT_RETURNTRANSFER => true, 
        CURLOPT_SSL_VERIFYPEER => false, // Perbaikan CURL
        CURLOPT_TIMEOUT => 10
    ]);
    $response = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($http_code == 200 && $response) {
        $forecast_data = json_decode($response, true);
        
        $filtered_data = null;
        $min_diff_hours = PHP_INT_MAX; 
        
        if (isset($forecast_data['list'])) {
            foreach ($forecast_data['list'] as $item) {
                $forecast_date = date('Y-m-d', $item['dt']);
                
                if ($forecast_date === $target_date_formatted) {
                    $item_hour = (int)date('H', $item['dt']);
                    $diff_hours = abs($item_hour - 12); 
                    
                    if ($diff_hours < $min_diff_hours) {
                        $min_diff_hours = $diff_hours;
                        $filtered_data = $item;
                    }
                }
            }
        }

        if ($filtered_data) {
            sendJsonResponse(null, [
                'success' => true,
                'data' => [
                    'temp' => $filtered_data['main']['temp'],
                    'temp_min' => $filtered_data['main']['temp_min'],
                    'temp_max' => $filtered_data['main']['temp_max'],
                    'description' => $filtered_data['weather'][0]['description'],
                    'main' => $filtered_data['weather'][0]['main'],
                    'dt_txt' => $filtered_data['dt_txt']
                ]
            ]);
        } else {
             sendJsonResponse(null, [
                'success' => false,
                'message' => "Prakiraan cuaca untuk tanggal $target_date_formatted tidak tersedia atau di luar cakupan 5 hari."
            ], 404);
        }

    } else {
        throw new Exception("Gagal memuat data prakiraan cuaca (HTTP Code: $http_code)", 503);
    }
}

// =============================================
//  PRIVATE ACTIONS (ROUTER & USER ACTIONS)
// =============================================
function handlePrivateAction($conn, $action, $data) {
    $token = $data['token'] ?? ''; 
    if (empty($token)) throw new Exception('Token otorisasi diperlukan', 401);
    
    $auth = verifyToken($token); 
    if (!$auth['authenticated']) throw new Exception('Unauthorized: ' . $auth['message'], 401);

    $user_id = $auth['user_id'];
    $user_role = $auth['role'];
    $wisata_id = $auth['wisata_id'] ?? null;

    switch ($user_role) {
        case 'user':
            handleUserAction($conn, $action, $data, $auth);
            break;
        case 'admin':
        case 'superadmin':
            handleAdminAction($conn, $action, $data, $user_id);
            break;
        case 'mitra':
            handleMitraAction($conn, $action, $data, $user_id, $wisata_id);
            break;
        default:
            throw new Exception('Role tidak dikenali', 403);
    }
}

// FUNGSI BARU: Penanganan Aksi Spesifik Pengguna
function handleUserAction($conn, $action, $data, $auth) {
    $user_id = $auth['user_id'];
    
    switch ($action) {
        case 'get_user_dashboard':
            $total_tiket = $conn->query("SELECT SUM(jumlah_tiket) FROM tiket WHERE user_id = $user_id AND status IN ('paid', 'used')")->fetch_row()[0] ?? 0;
            $active_tiket = $conn->query("SELECT COUNT(id) FROM tiket WHERE user_id = $user_id AND status = 'paid'")->fetch_row()[0] ?? 0;
            $total_spent = $conn->query("SELECT SUM(total_harga) FROM tiket WHERE user_id = $user_id AND status IN ('paid', 'used')")->fetch_row()[0] ?? 0;
            $favorite_count = $conn->query("SELECT COUNT(id) FROM favorit WHERE user_id = $user_id")->fetch_row()[0] ?? 0;
            
            sendJsonResponse($conn, [
                'success' => true, 
                'data' => [
                    'total_tiket' => (int)$total_tiket,
                    'active_tiket' => (int)$active_tiket,
                    'total_spent' => (int)$total_spent,
                    'favorite_count' => (int)$favorite_count
                ]
            ]);
            break;

        case 'get_user_tickets':
            $stmt = $conn->prepare("SELECT t.*, w.nama as wisata_name FROM tiket t LEFT JOIN wisata w ON t.wisata_id = w.id WHERE t.user_id = ? ORDER BY t.created_at DESC");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;

        case 'get_user_history':
            $stmt = $conn->prepare("SELECT t.kode_tiket, t.total_harga, t.status, t.created_at, w.nama as wisata_name FROM tiket t LEFT JOIN wisata w ON t.wisata_id = w.id WHERE t.user_id = ? ORDER BY t.created_at DESC");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;
            
        case 'get_user_reviews':
            $stmt = $conn->prepare("SELECT r.*, w.nama as wisata_name FROM review r LEFT JOIN wisata w ON r.wisata_id = w.id WHERE r.user_id = ? ORDER BY r.created_at DESC");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;
            
        case 'get_user_favorites':
            $stmt = $conn->prepare("SELECT f.wisata_id as id, w.nama as wisata_name, w.lokasi, w.harga_tiket, w.gambar_url FROM favorit f LEFT JOIN wisata w ON f.wisata_id = w.id WHERE f.user_id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;

        case 'toggle_favorite':
            $wisata_id = $data['wisata_id'] ?? null;
            if (!$wisata_id) throw new Exception('ID Wisata diperlukan', 400);

            $stmt = $conn->prepare("SELECT id FROM favorit WHERE user_id = ? AND wisata_id = ?");
            $stmt->bind_param("ii", $user_id, $wisata_id);
            $stmt->execute();
            if ($stmt->get_result()->num_rows > 0) {
                $del_stmt = $conn->prepare("DELETE FROM favorit WHERE user_id = ? AND wisata_id = ?");
                $del_stmt->bind_param("ii", $user_id, $wisata_id);
                $del_stmt->execute();
                sendJsonResponse($conn, ['success' => true, 'message' => 'Wisata dihapus dari favorit', 'action' => 'removed']);
            } else {
                $add_stmt = $conn->prepare("INSERT INTO favorit (user_id, wisata_id) VALUES (?, ?)");
                $add_stmt->bind_param("ii", $user_id, $wisata_id);
                $add_stmt->execute();
                sendJsonResponse($conn, ['success' => true, 'message' => 'Wisata ditambahkan ke favorit', 'action' => 'added']);
            }
            break;

        case 'get_user_profile':
            $stmt = $conn->prepare("SELECT name, email, phone, address FROM users WHERE id = ?");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $profile = $stmt->get_result()->fetch_assoc();
            sendJsonResponse($conn, ['success' => true, 'data' => $profile]);
            break;

        case 'save_user_profile':
            $name = $data['name'] ?? '';
            $phone = $data['phone'] ?? '';
            $address = $data['address'] ?? '';

            $stmt = $conn->prepare("UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?");
            $stmt->bind_param("sssi", $name, $phone, $address, $user_id);
            if ($stmt->execute()) {
                sendJsonResponse($conn, ['success' => true, 'message' => 'Profil berhasil diperbarui']);
            } else {
                throw new Exception('Gagal menyimpan profil: ' . $stmt->error, 500);
            }
            break;

        case 'create_order':
            $required = ['wisata_id', 'tanggal_berkunjung', 'jumlah_tiket', 'total_harga', 'metode_pembayaran'];
            // Asumsi validateRequiredFields ada di config.php
            // if (!empty($missing = validateRequiredFields($data, $required))) {
            //      throw new Exception('Field berikut harus diisi: ' . implode(', ', $missing), 400);
            // }
            
            $kode_tiket = 'BW' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 6)); 
            $status = 'paid'; 

            $stmt = $conn->prepare("INSERT INTO tiket (user_id, wisata_id, kode_tiket, tanggal_berkunjung, jumlah_tiket, total_harga, metode_pembayaran, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
            $stmt->bind_param("iissidss", 
                $user_id, 
                $data['wisata_id'], 
                $kode_tiket, 
                $data['tanggal_berkunjung'], 
                $data['jumlah_tiket'], 
                $data['total_harga'], 
                $data['metode_pembayaran'], 
                $status
            );
            if ($stmt->execute()) {
                sendJsonResponse($conn, ['success' => true, 'message' => 'Pesanan berhasil dibuat dan dibayar', 'data' => ['kode_tiket' => $kode_tiket]]);
            } else {
                throw new Exception('Gagal membuat pesanan: ' . $stmt->error, 500);
            }
            break;

        case 'cancel_order':
            $tiket_id = $data['tiket_id'] ?? null;
            if (!$tiket_id) throw new Exception('ID Tiket diperlukan', 400);

            $stmt = $conn->prepare("SELECT * FROM tiket WHERE id = ? AND user_id = ? AND status = 'paid'");
            $stmt->bind_param("ii", $tiket_id, $user_id);
            $stmt->execute();
            $tiket = $stmt->get_result()->fetch_assoc();

            if (!$tiket) throw new Exception('Tiket tidak ditemukan atau tidak dapat dibatalkan (sudah digunakan/dibatalkan)', 400);

            if (strtotime($tiket['tanggal_berkunjung']) < strtotime(date('Y-m-d'))) {
                 throw new Exception('Pembatalan hanya dapat dilakukan sebelum tanggal kunjungan.', 400);
            }

            $update_stmt = $conn->prepare("UPDATE tiket SET status = 'cancelled' WHERE id = ?");
            $update_stmt->bind_param("i", $tiket_id);
            if ($update_stmt->execute()) {
                sendJsonResponse($conn, ['success' => true, 'message' => 'Tiket berhasil dibatalkan. Dana akan dikembalikan (dipotong biaya admin).']);
            } else {
                throw new Exception('Gagal membatalkan tiket', 500);
            }
            break;
            
        default:
            throw new Exception('Action user tidak dikenali', 404);
    }
}

// =============================================
//  ADMIN/MITRA ACTIONS (Kode Lengkap)
// =============================================
function handleAdminAction($conn, $action, $data, $user_id) {
    switch ($action) {
        case 'get_dashboard_summary':
            $wisata_count = $conn->query("SELECT COUNT(id) FROM wisata")->fetch_row()[0] ?? 0;
            $mitra_count = $conn->query("SELECT COUNT(id) FROM mitra WHERE layanan = 'active'")->fetch_row()[0] ?? 0;
            $blog_count = $conn->query("SELECT COUNT(id) FROM blog_posts")->fetch_row()[0] ?? 0;
            $tiket_hari_ini = $conn->query("SELECT COUNT(id) FROM tiket WHERE DATE(tanggal_berkunjung) = CURDATE()")->fetch_row()[0] ?? 0;
            $pendapatan_bulan_ini = $conn->query("SELECT SUM(total_harga) FROM tiket WHERE status = 'paid' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())")->fetch_row()[0] ?? 0;
            
            sendJsonResponse($conn, [
                'success' => true, 
                'data' => [
                    'wisata_count' => (int)$wisata_count,
                    'mitra_count' => (int)$mitra_count,
                    'blog_count' => (int)$blog_count,
                    'tiket_hari_ini' => (int)$tiket_hari_ini,
                    'pendapatan_bulan_ini' => (int)$pendapatan_bulan_ini
                ]
            ]);
            break;

        case 'get_activities':
            $result = $conn->query("SELECT aa.*, au.name as user_name FROM admin_activities aa LEFT JOIN admin_users au ON aa.user_id = au.id ORDER BY aa.created_at DESC LIMIT 10");
            $items = $result->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;
            
        case 'get_admin_wisata':
            getAdminWisata($conn, $data);
            break;
            
        case 'save_wisata':
            saveWisata($conn, $data, $user_id);
            break;
        
        case 'delete_wisata':
            deleteWisata($conn, $data, $user_id);
            break;
            
        case 'get_tiket':
            getAdminTiket($conn, $data);
            break;
            
        case 'validate_tiket':
            validateTiket($conn, $data, $user_id);
            break;

        case 'get_admin_blog':
            getAdminBlog($conn, $data);
            break;
        case 'save_blog':
            saveBlog($conn, $data, $user_id);
            break;
        case 'delete_blog':
            deleteBlog($conn, $data, $user_id);
            break;

        case 'get_mitra':
            getMitra($conn, $data);
            break;
        case 'save_mitra':
            saveMitra($conn, $data, $user_id);
            break;

        case 'get_admin_promo':
            getAdminPromo($conn, $data);
            break;
        case 'save_promo':
            savePromo($conn, $data, $user_id);
            break;
        case 'delete_promo':
            deletePromo($conn, $data, $user_id);
            break;
            
        case 'get_laporan_penjualan':
            getLaporanPenjualan($conn, $data);
            break;
            
        default:
            throw new Exception('Action admin tidak dikenali', 404);
    }
}

// --- FUNGSI WISATA ADMIN/MITRA ---
function getAdminWisata($conn, $data) {
    $wisata_id = $data['id'] ?? null;
    if ($wisata_id) {
        $stmt = $conn->prepare("SELECT * FROM wisata WHERE id = ?");
        $stmt->bind_param("i", $wisata_id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        if (!$item) throw new Exception('Data wisata tidak ditemukan', 404);
        sendJsonResponse($conn, ['success' => true, 'data' => $item]);
    } else {
        $result = $conn->query("SELECT * FROM wisata ORDER BY nama ASC");
        $items = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse($conn, ['success' => true, 'data' => $items]);
    }
}

function saveWisata($conn, $data, $user_id) {
    $required = ['nama', 'kategori', 'lokasi', 'harga_tiket'];
    // $missing = validateRequiredFields($data, $required); 
    // if (!empty($missing)) throw new Exception('Field berikut harus diisi: ' . implode(', ', $missing), 400);
    
    $id = $data['id'] ?? null;
    if ($id) {
        $stmt = $conn->prepare("UPDATE wisata SET nama=?, kategori=?, lokasi=?, harga_tiket=?, gambar_url=?, deskripsi=?, latitude=?, longitude=?, fasilitas=?, tips=?, is_active=? WHERE id=?");
        $stmt->bind_param("sssdssddssii", $data['nama'], $data['kategori'], $data['lokasi'], $data['harga_tiket'], $data['gambar_url'], $data['deskripsi'], $data['latitude'], $data['longitude'], $data['fasilitas'], $data['tips'], $data['is_active'], $id);
        $message = "Wisata berhasil diperbarui";
        $activity = "Update Wisata";
    } else {
        $stmt = $conn->prepare("INSERT INTO wisata (nama, kategori, lokasi, harga_tiket, gambar_url, deskripsi, latitude, longitude, fasilitas, tips, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssdssddssi", $data['nama'], $data['kategori'], $data['lokasi'], $data['harga_tiket'], $data['gambar_url'], $data['deskripsi'], $data['latitude'], $data['longitude'], $data['fasilitas'], $data['tips'], $data['is_active']);
        $message = "Wisata berhasil ditambahkan";
        $activity = "Create Wisata";
    }
    if ($stmt->execute()) {
        // logActivity($conn, $user_id, $activity, $data['nama']); 
        sendJsonResponse($conn, ['success' => true, 'message' => $message]);
    } else {
        throw new Exception('Gagal menyimpan wisata: ' . $stmt->error, 500);
    }
}

function deleteWisata($conn, $data, $user_id) {
    $id = $data['id'] ?? null;
    if (!$id) throw new Exception('ID Wisata diperlukan', 400);
    
    $stmt = $conn->prepare("DELETE FROM wisata WHERE id = ?"); 
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        // logActivity($conn, $user_id, 'Delete Wisata', 'Hapus wisata ID: ' . $id);
        sendJsonResponse($conn, ['success' => true, 'message' => 'Wisata berhasil dihapus']);
    } else {
        throw new Exception('Gagal menghapus wisata: ' . $stmt->error, 500);
    }
}

function getAdminTiket($conn, $data) {
    $tanggal = $_GET['tanggal'] ?? null; // diambil dari query params di apiCall JS
    $status = $_GET['status'] ?? null;

    $where_clauses = ["1=1"];
    $params = [];
    $types = "";

    if ($tanggal) {
        $where_clauses[] = "DATE(t.tanggal_berkunjung) = ?";
        $params[] = $tanggal;
        $types .= "s";
    }
    if ($status) {
        $where_clauses[] = "t.status = ?";
        $params[] = $status;
        $types .= "s";
    }

    $sql = "SELECT t.*, w.nama as wisata_nama FROM tiket t LEFT JOIN wisata w ON t.wisata_id = w.id WHERE " . implode(" AND ", $where_clauses) . " ORDER BY t.created_at DESC";

    if (!empty($params)) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $result = $stmt->get_result();
    } else {
        $result = $conn->query($sql);
    }

    $items = $result->fetch_all(MYSQLI_ASSOC);
    sendJsonResponse($conn, ['success' => true, 'data' => $items]);
}

function validateTiket($conn, $data, $user_id) {
    $kode_tiket = $data['kode_tiket'] ?? '';
    if (empty($kode_tiket)) throw new Exception('Kode tiket diperlukan', 400);
    
    $stmt = $conn->prepare("SELECT * FROM tiket WHERE kode_tiket = ?");
    $stmt->bind_param("s", $kode_tiket);
    $stmt->execute();
    $tiket = $stmt->get_result()->fetch_assoc();
    
    if (!$tiket) throw new Exception('Tiket tidak ditemukan', 404);
    if ($tiket['status'] === 'used') throw new Exception('Tiket sudah digunakan', 409);
    if ($tiket['status'] !== 'paid') throw new Exception('Tiket belum dibayar', 400);
    
    $update_stmt = $conn->prepare("UPDATE tiket SET status = 'used' WHERE id = ?");
    $update_stmt->bind_param("i", $tiket['id']);
    
    if ($update_stmt->execute()) {
        // logActivity($conn, $user_id, 'Validate Tiket', 'Kode: ' . $kode_tiket);
        sendJsonResponse($conn, ['success' => true, 'message' => 'Tiket berhasil divalidasi', 'data' => $tiket]);
    } else {
        throw new Exception('Gagal memvalidasi tiket', 500);
    }
}

function getAdminBlog($conn, $data) {
    $id = $data['id'] ?? null;
    if ($id) {
        $stmt = $conn->prepare("SELECT * FROM blog_posts WHERE id = ?"); 
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        sendJsonResponse($conn, ['success' => true, 'data' => $item]);
    } else {
        $result = $conn->query("SELECT bp.id, bp.judul, bp.status, bp.created_at, au.name as penulis_name FROM blog_posts bp LEFT JOIN admin_users au ON bp.penulis_id = au.id ORDER BY bp.created_at DESC");
        $items = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse($conn, ['success' => true, 'data' => $items]);
    }
}

function saveBlog($conn, $data, $user_id) {
    $id = $data['id'] ?? null;
    $data['penulis_id'] = $user_id; 
    
    if ($id) {
        $stmt = $conn->prepare("UPDATE blog_posts SET judul=?, konten=?, status=?, gambar_url=?, excerpt=?, penulis_id=?, kategori=? WHERE id=?");
        $stmt->bind_param("sssssisi", $data['judul'], $data['konten'], $data['status'], $data['gambar_url'], $data['excerpt'], $data['penulis_id'], $data['kategori'], $id);
        $message = "Artikel berhasil diperbarui";
    } else {
        $stmt = $conn->prepare("INSERT INTO blog_posts (judul, konten, status, gambar_url, excerpt, penulis_id, kategori) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sssssis", $data['judul'], $data['konten'], $data['status'], $data['gambar_url'], $data['excerpt'], $data['penulis_id'], $data['kategori']);
        $message = "Artikel berhasil diterbitkan";
    }
    if ($stmt->execute()) {
        sendJsonResponse($conn, ['success' => true, 'message' => $message]);
    } else {
        throw new Exception('Gagal menyimpan artikel: ' . $stmt->error, 500);
    }
}

function deleteBlog($conn, $data, $user_id) {
    $id = $data['id'] ?? null;
    if (!$id) throw new Exception('ID Artikel diperlukan', 400);
    
    $stmt = $conn->prepare("DELETE FROM blog_posts WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        // logActivity($conn, $user_id, 'Delete Blog', 'Hapus artikel ID: ' . $id);
        sendJsonResponse($conn, ['success' => true, 'message' => 'Artikel berhasil dihapus']);
    } else {
        throw new Exception('Gagal menghapus artikel: ' . $stmt->error, 500);
    }
}

function getMitra($conn, $data) {
    $id = $data['id'] ?? null;
    if ($id) {
        $stmt = $conn->prepare("SELECT id, nama_mitra, username, wisata_id, layanan, status_kontrak FROM mitra WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        sendJsonResponse($conn, ['success' => true, 'data' => $item]);
    } else {
        $result = $conn->query("SELECT m.id, m.nama_mitra, m.username, m.layanan, w.nama as wisata_nama FROM mitra m LEFT JOIN wisata w ON m.wisata_id = w.id ORDER BY m.nama_mitra ASC");
        $items = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse($conn, ['success' => true, 'data' => $items]);
    }
}

function saveMitra($conn, $data, $user_id) {
    $id = $data['id'] ?? null;
    $username = $data['username'];
    $password = $data['password'] ?? null;

    $layanan = ($data['is_active'] == 1) ? 'active' : '';

    if ($id) { // Update Mitra
        if (!empty($password)) { // Jika password diubah
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $conn->prepare("UPDATE mitra SET nama_mitra=?, username=?, password_hash=?, wisata_id=?, layanan=? WHERE id=?");
            $stmt->bind_param("sssiss", $data['nama_mitra'], $username, $hash, $data['wisata_id'], $layanan, $id);
        } else { // Jika password tidak diubah
            $stmt = $conn->prepare("UPDATE mitra SET nama_mitra=?, username=?, wisata_id=?, layanan=? WHERE id=?");
            $stmt->bind_param("ssiss", $data['nama_mitra'], $username, $data['wisata_id'], $layanan, $id);
        }
        $message = "Data mitra berhasil diperbarui";
    } else { // Insert Mitra Baru
        if (empty($password)) throw new Exception('Password wajib diisi untuk mitra baru', 400);
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("INSERT INTO mitra (nama_mitra, username, password_hash, wisata_id, layanan) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("sssis", $data['nama_mitra'], $username, $hash, $data['wisata_id'], $layanan);
        $message = "Mitra baru berhasil ditambahkan";
    }

    if ($stmt->execute()) {
        // logActivity($conn, $user_id, 'Save Mitra', $username);
        sendJsonResponse($conn, ['success' => true, 'message' => $message]);
    } else {
        throw new Exception('Gagal menyimpan data mitra: ' . $stmt->error, 500);
    }
}

function getAdminPromo($conn, $data) {
    $id = $data['id'] ?? null;
    if ($id) {
        $stmt = $conn->prepare("SELECT * FROM promo WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $item = $stmt->get_result()->fetch_assoc();
        sendJsonResponse($conn, ['success' => true, 'data' => $item]);
    } else {
        $result = $conn->query("SELECT p.*, w.nama as wisata_nama FROM promo p LEFT JOIN wisata w ON p.wisata_id = w.id ORDER BY p.created_at DESC");
        $items = $result->fetch_all(MYSQLI_ASSOC);
        sendJsonResponse($conn, ['success' => true, 'data' => $items]);
    }
}

function savePromo($conn, $data, $user_id) {
    $id = $data['id'] ?? null;
    
    if ($id) {
        $stmt = $conn->prepare("UPDATE promo SET nama_promo=?, wisata_id=?, jenis_diskon=?, nilai_diskon=?, tanggal_berakhir=?, status=? WHERE id=?");
        $stmt->bind_param("sisissi", $data['nama_promo'], $data['wisata_id'], $data['jenis_diskon'], $data['nilai_diskon'], $data['tanggal_berakhir'], $data['status'], $id);
        $message = "Promo berhasil diperbarui";
    } else {
        $stmt = $conn->prepare("INSERT INTO promo (nama_promo, wisata_id, jenis_diskon, nilai_diskon, tanggal_berakhir, status) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sisdss", $data['nama_promo'], $data['wisata_id'], $data['jenis_diskon'], $data['nilai_diskon'], $data['tanggal_berakhir'], $data['status']);
        $message = "Promo berhasil ditambahkan";
    }
    if ($stmt->execute()) {
        sendJsonResponse($conn, ['success' => true, 'message' => $message]);
    } else {
        throw new Exception('Gagal menyimpan promo: ' . $stmt->error, 500);
    }
}

function deletePromo($conn, $data, $user_id) {
    $id = $data['id'] ?? null;
    if (!$id) throw new Exception('ID Promo diperlukan', 400);
    
    $stmt = $conn->prepare("DELETE FROM promo WHERE id = ?");
    $stmt->bind_param("i", $id);
    if ($stmt->execute()) {
        // logActivity($conn, $user_id, 'Delete Promo', 'Hapus promo ID: ' . $id);
        sendJsonResponse($conn, ['success' => true, 'message' => 'Promo berhasil dihapus']);
    } else {
        throw new Exception('Gagal menghapus promo: ' . $stmt->error, 500);
    }
}

function getLaporanPenjualan($conn, $data) {
    $bulan = $data['bulan'] ?? null; // Format YYYY-MM
    if (empty($bulan)) throw new Exception('Parameter bulan diperlukan', 400);

    // Mengambil data tiket terjual per tanggal dan per wisata
    $stmt = $conn->prepare("
        SELECT 
            DATE(t.tanggal_berkunjung) as tanggal, 
            w.nama as wisata_nama,
            SUM(t.jumlah_tiket) as total_tiket,
            SUM(t.total_harga) as total_pendapatan
        FROM tiket t
        LEFT JOIN wisata w ON t.wisata_id = w.id
        WHERE (t.status = 'paid' OR t.status = 'used') 
        AND DATE_FORMAT(t.tanggal_berkunjung, '%Y-%m') = ?
        GROUP BY DATE(t.tanggal_berkunjung), w.nama
        ORDER BY tanggal ASC
    ");
    $stmt->bind_param("s", $bulan);
    $stmt->execute();
    $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    sendJsonResponse($conn, ['success' => true, 'data' => $items]);
}

function handleMitraAction($conn, $action, $data, $user_id, $wisata_id) {
    if (empty($wisata_id)) throw new Exception('Mitra tidak terhubung dengan wisata', 403);
    
    switch ($action) {
        case 'get_mitra_dashboard':
            $tiket_hari_ini = $conn->query("SELECT COUNT(id) FROM tiket WHERE wisata_id = $wisata_id AND DATE(tanggal_berkunjung) = CURDATE()")->fetch_row()[0] ?? 0;
            $tamu_checkin = $conn->query("SELECT COUNT(id) FROM tiket WHERE wisata_id = $wisata_id AND status = 'used' AND DATE(tanggal_berkunjung) = CURDATE()")->fetch_row()[0] ?? 0;
            $pendapatan_bulan_ini = $conn->query("SELECT SUM(total_harga) FROM tiket WHERE wisata_id = $wisata_id AND status IN ('paid', 'used') AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())")->fetch_row()[0] ?? 0;
            
            $stmt_wisata = $conn->prepare("SELECT nama, latitude, longitude FROM wisata WHERE id = ?");
            $stmt_wisata->bind_param("i", $wisata_id);
            $stmt_wisata->execute();
            $wisata_info = $stmt_wisata->get_result()->fetch_assoc();

            sendJsonResponse($conn, [
                'success' => true, 
                'data' => [
                    'tiket_hari_ini' => (int)$tiket_hari_ini,
                    'tamu_checkin' => (int)$tamu_checkin,
                    'pendapatan_bulan_ini' => (int)$pendapatan_bulan_ini,
                    'wisata_info' => $wisata_info
                ]
            ]);
            break;

        case 'get_my_tiket':
            $tanggal = $_GET['tanggal'] ?? date('Y-m-d');
            $stmt = $conn->prepare("SELECT id, kode_tiket, tanggal_berkunjung, jumlah_tiket, status FROM tiket WHERE wisata_id = ? AND DATE(tanggal_berkunjung) = ? ORDER BY created_at DESC");
            $stmt->bind_param("is", $wisata_id, $tanggal);
            $stmt->execute();
            $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;

        case 'validate_tiket':
            $kode_tiket = $data['kode_tiket'] ?? '';
            if (empty($kode_tiket)) throw new Exception('Kode tiket diperlukan', 400);

            $stmt = $conn->prepare("SELECT * FROM tiket WHERE kode_tiket = ? AND wisata_id = ?");
            $stmt->bind_param("si", $kode_tiket, $wisata_id);
            $stmt->execute();
            $tiket = $stmt->get_result()->fetch_assoc();
            
            if (!$tiket) throw new Exception('Tiket tidak ditemukan atau bukan untuk wisata Anda', 404);
            if ($tiket['status'] === 'used') throw new Exception('Tiket sudah digunakan', 409);
            if ($tiket['status'] !== 'paid') throw new Exception('Tiket belum dibayar', 400);
            
            $update_stmt = $conn->prepare("UPDATE tiket SET status = 'used' WHERE id = ?");
            $update_stmt->bind_param("i", $tiket['id']);
            
            if ($update_stmt->execute()) {
                sendJsonResponse($conn, ['success' => true, 'message' => 'Tiket berhasil divalidasi', 'data' => $tiket]);
            } else {
                throw new Exception('Gagal memvalidasi tiket', 500);
            }
            break;

        case 'get_my_laporan_bulanan':
            $bulan = $_GET['bulan'] ?? null; 
            if (empty($bulan)) throw new Exception('Parameter bulan diperlukan (YYYY-MM)', 400);

            $stmt = $conn->prepare("
                SELECT DATE(tanggal_berkunjung) as tanggal, SUM(jumlah_tiket) as jumlah, SUM(total_harga) as total
                FROM tiket
                WHERE wisata_id = ? AND (status = 'paid' OR status = 'used') AND DATE_FORMAT(tanggal_berkunjung, '%Y-%m') = ?
                GROUP BY DATE(tanggal_berkunjung)
                ORDER BY tanggal ASC
            ");
            $stmt->bind_param("is", $wisata_id, $bulan);
            $stmt->execute();
            $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;

        case 'get_my_wisata':
            $stmt = $conn->prepare("SELECT * FROM wisata WHERE id = ?");
            $stmt->bind_param("i", $wisata_id);
            $stmt->execute();
            $item = $stmt->get_result()->fetch_assoc();
            sendJsonResponse($conn, ['success' => true, 'data' => $item]);
            break;
            
        case 'save_my_promo':
            $id = $data['id'] ?? null;
            $required = ['nama_promo', 'jenis_diskon', 'nilai_diskon', 'tanggal_berakhir', 'status'];
            // $missing = validateRequiredFields($data, $required);
            // if (!empty($missing)) throw new Exception('Field berikut harus diisi: ' . implode(', ', $missing), 400);

            $nilaiDiskon = (float) $data['nilai_diskon']; 

            if ($id) {
                $stmt = $conn->prepare("UPDATE promo SET nama_promo=?, jenis_diskon=?, nilai_diskon=?, tanggal_berakhir=?, status=? WHERE id=? AND wisata_id=?");
                $stmt->bind_param("sdsissii", 
                    $data['nama_promo'], 
                    $data['jenis_diskon'], 
                    $nilaiDiskon, 
                    $data['tanggal_berakhir'], 
                    $data['status'], 
                    $id,
                    $wisata_id
                );
                $message = "Promo berhasil diperbarui";
            } else {
                $stmt = $conn->prepare("INSERT INTO promo (nama_promo, wisata_id, jenis_diskon, nilai_diskon, tanggal_berakhir, status) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->bind_param("sisdss", 
                    $data['nama_promo'], 
                    $wisata_id, 
                    $data['jenis_diskon'], 
                    $nilaiDiskon, 
                    $data['tanggal_berakhir'], 
                    $data['status']
                );
                $message = "Promo berhasil ditambahkan";
            }
            
            if ($stmt->execute()) {
                sendJsonResponse($conn, ['success' => true, 'message' => $message]);
            } else {
                throw new Exception('Gagal menyimpan promo: ' . $stmt->error, 500);
            }
            break;
            
        case 'get_my_promo':
            $stmt = $conn->prepare("SELECT * FROM promo WHERE wisata_id = ? ORDER BY created_at DESC");
            $stmt->bind_param("i", $wisata_id);
            $stmt->execute();
            $items = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
            sendJsonResponse($conn, ['success' => true, 'data' => $items]);
            break;
            
        case 'delete_promo':
            $id = $data['id'] ?? null;
            if (!$id) throw new Exception('ID Promo diperlukan', 400);
            
            $stmt = $conn->prepare("DELETE FROM promo WHERE id = ? AND wisata_id = ?");
            $stmt->bind_param("ii", $id, $wisata_id);
            if ($stmt->execute()) {
                if ($stmt->affected_rows === 0) {
                    throw new Exception('Promo tidak ditemukan atau bukan milik Anda.', 404);
                }
                sendJsonResponse($conn, ['success' => true, 'message' => 'Promo berhasil dihapus.']);
            } else {
                throw new Exception('Gagal menghapus promo: ' . $stmt->error, 500);
            }
            break;

        case 'save_my_wisata':
            $stmt = $conn->prepare("UPDATE wisata SET harga_tiket=?, gambar_url=?, deskripsi=?, fasilitas=?, tips=? WHERE id=?");
            $stmt->bind_param("dssssi", 
                $data['harga_tiket'], 
                $data['gambar_url'], 
                $data['deskripsi'], 
                $data['fasilitas'], 
                $data['tips'], 
                $wisata_id
            );
            if ($stmt->execute()) {
                sendJsonResponse($conn, ['success' => true, 'message' => 'Profil wisata berhasil diperbarui']);
            } else {
                throw new Exception('Gagal menyimpan profil: ' . $stmt->error, 500);
            }
            break;

        default:
            throw new Exception('Action mitra tidak dikenali', 404);
    }
}