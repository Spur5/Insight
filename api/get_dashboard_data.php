<?php // /var/www/html/api/get_dashboard_data.php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Repository/WheelRepository.php';

use Insight\Repository\WheelRepository;

header('Content-Type: application/json');

try {
    $wheelRepository = new WheelRepository();
    $dashboardData = $wheelRepository->getDashboardOptionsData();
    echo json_encode($dashboardData);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}