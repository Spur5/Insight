<?php // /var/www/html/@public/api/log_transaction.php

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../src/Repository/WheelRepository.php';

use Insight\Repository\WheelRepository;

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

// Basic validation (expand as needed for production)
$requiredFields = [
    'type', 'broker_name', 'ticker', 'contract_type', 'strike_price',
    'expiration_date', 'contracts', 'premium', 'status'
];

foreach ($requiredFields as $field) {
    if (!isset($input[$field])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => "Missing required field: {$field}"]);
        exit;
    }
}

try {
    $repository = new WheelRepository();

    $broker = $repository->getBrokerByName($input['broker_name']);
    if (!$broker) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Broker not found']);
        exit;
    }
    $brokerId = (int)$broker['id'];

    // For simplicity, we'll assume a new wheel cycle is created or linked if provided.
    // In a real app, you'd have more sophisticated logic to find/create cycles.
    $wheelCycleId = null;
    if (isset($input['wheel_cycle_id'])) {
        $wheelCycleId = (int)$input['wheel_cycle_id'];
    } elseif (isset($input['create_new_cycle']) && $input['create_new_cycle'] === true && isset($input['assigned_shares'])) {
        $wheelCycleId = $repository->insertWheelCycle($input['ticker'], (int)$input['assigned_shares']);
    }


    $optionData = [
        'wheel_cycle_id' => $wheelCycleId,
        'broker_id' => $brokerId,
        'ticker' => $input['ticker'],
        'type' => $input['type'], // e.g., 'SELL_TO_OPEN'
        'contract_type' => $input['contract_type'], // e.g., 'CALL'
        'strike_price' => (float)$input['strike_price'],
        'expiration_date' => $input['expiration_date'], // YYYY-MM-DD
        'contracts' => (int)$input['contracts'],
        'premium' => (float)$input['premium'],
        'status' => $input['status'] // e.g., 'FILLED', 'ASSIGNED'
    ];

    // If the status is 'ASSIGNED' and it's a short call, use the special handling function
    if ($optionData['type'] === 'SELL_TO_OPEN' && $optionData['contract_type'] === 'CALL' && $optionData['status'] === 'ASSIGNED') {
        // First, insert the option order with a 'FILLED' status, then update it to 'ASSIGNED'
        // This is a workaround if the initial insert needs to happen before the assignment logic.
        // A more robust solution might involve a separate 'assign' endpoint or a more complex state machine.
        $optionData['status'] = 'FILLED'; // Temporarily set to FILLED for initial insert
        $optionOrderId = $repository->insertOptionOrder($optionData);
        $success = $repository->updateOptionOrderAndHandleAssignment($optionOrderId, 'ASSIGNED', $brokerId);
    } else {
        $optionOrderId = $repository->insertOptionOrder($optionData);
        $success = ($optionOrderId > 0);
    }


    if ($success) {
        echo json_encode(['success' => true, 'message' => 'Transaction logged successfully.', 'option_order_id' => $optionOrderId]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to log transaction.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}
