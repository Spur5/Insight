<?php // /var/www/html/api/log_strategy.php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Repository/StrategyRepository.php';
require_once __DIR__ . '/../src/Repository/WheelRepository.php';

use Insight\Repository\StrategyRepository;
use Insight\Repository\WheelRepository; // Use WheelRepository to get broker ID

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid JSON payload']);
    exit;
}

// Basic validation for strategy
$requiredStrategyFields = ['ticker', 'strategy_name', 'broker_name', 'legs'];
foreach ($requiredStrategyFields as $field) {
    if (!isset($input[$field])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => "Missing required strategy field: {$field}"]);
        exit;
    }
}

if (!is_array($input['legs']) || empty($input['legs'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Strategy must contain at least one leg.']);
    exit;
}

try {
    $strategyRepository = new StrategyRepository();
    $wheelRepository = new WheelRepository(); // To get broker ID

    $broker = $wheelRepository->getBrokerByName($input['broker_name']);
    if (!$broker) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Broker not found']);
        exit;
    }
    $brokerId = (int)$broker['id'];

    $strategyId = $strategyRepository->insertMultiLegStrategy(
        $input['ticker'],
        $input['strategy_name'],
        $input['legs'],
        $brokerId
    );

    // After inserting, evaluate if the strategy should be closed immediately (e.g., if all legs are already terminal)
    // This might be less common for initial insertion but good for consistency.
    $strategyRepository->evaluateStrategyStatus($strategyId);

    echo json_encode([
        'success' => true,
        'message' => 'Multi-leg strategy logged successfully.',
        'strategy_id' => $strategyId
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (\InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Validation error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}