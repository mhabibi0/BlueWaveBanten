<?php
// test_cors.php - File tes CORS paling sederhana

header("Access-Control-Allow-Origin: https://admin.bluewavebanten.my.id");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Authorization");
header("Access-Control-Allow-Credentials: true");

// Jika ini adalah preflight request, cukup kirim OK dan selesai.
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Jika bukan preflight, kirim respons sukses.
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['status' => 'success', 'message' => 'CORS test passed!']);
?>