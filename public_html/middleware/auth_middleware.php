<?php
class AuthMiddleware {
    private $jwt;

    public function __construct() {
        $this->jwt = new JWT();
    }

    public function validateToken() {
        $headers = getallheaders();
        $token = $headers['Authorization'] ?? str_replace('Bearer ', '', $_GET['token'] ?? '');

        if (empty($token)) {
            return false;
        }

        return $this->jwt->validate($token);
    }
}
?>