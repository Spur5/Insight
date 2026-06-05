<?php // /var/www/html/api/update_leg_status.php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Repository/WheelRepository.php';
require_once __DIR__ . '/../src/Repository/StrategyRepository.php';

use Insight\Repository\WheelRepository;
use Insight\Repository\StrategyRepository;

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

$requiredFields = ['option_id', 'action'];
foreach ($requiredFields as $field) {
    if (!isset($input[$field])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => "Missing required field: {$field}"]);
        exit;
    }
}

$optionId = (int)$input['option_id'];
$action = $input['action']; // 'CLOSE', 'EXPIRE', 'ASSIGN'
$exitPremium = isset($input['exit_premium']) ? (float)$input['exit_premium'] : null;

try {
    $wheelRepository = new WheelRepository();
    $strategyRepository = new StrategyRepository();

    $success = false;
    $message = '';

    // Fetch the original option order details
    $originalOption = $wheelRepository->getOptionOrderById($optionId);
    if (!$originalOption) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Option order not found.']);
        exit;
    }

    $brokerId = (int)$originalOption['broker_id'];
    $strategyId = $originalOption['option_strategy_id'] ? (int)$originalOption['option_strategy_id'] : null;

    switch ($action) {
        case 'EXPIRE':
            $success = $wheelRepository->updateOptionOrderStatus($optionId, 'EXPIRED');
            $message = 'Option expired successfully.';
            break;

        case 'ASSIGN':
            if ($originalOption['type'] === 'SELL_TO_OPEN' && $originalOption['contract_type'] === 'CALL') {
                // Use the special handling function for short calls being assigned
                $success = $wheelRepository->updateOptionOrderAndHandleAssignment($optionId, 'ASSIGNED', $brokerId);
                $message = 'Option assigned and cycle handled successfully.';
            } else {
                // For other types of options, just update status to ASSIGNED
                $success = $wheelRepository->updateOptionOrderStatus($optionId, 'ASSIGNED');
                $message = 'Option assigned successfully.';
            }
            break;

        case 'CLOSE':
            // Update original option status to CLOSED
            $success = $wheelRepository->updateOptionOrderStatus($optionId, 'CLOSED');

            if ($success) {
                // Log a balancing closure trace record (inverse transaction)
                $closingType = '';
                if ($originalOption['type'] === 'SELL_TO_OPEN') {
                    $closingType = 'BUY_TO_CLOSE';
                } elseif ($originalOption['type'] === 'BUY_TO_OPEN') {
                    $closingType = 'SELL_TO_CLOSE';
                } else {
                    throw new Exception("Unsupported option type for closing: {$originalOption['type']}");
                }

                $closingOptionData = [
                    'wheel_cycle_id' => $originalOption['wheel_cycle_id'],
                    'option_strategy_id' => $strategyId,
                    'leg_type' => $originalOption['leg_type'],
                    'broker_id' => $brokerId,
                    'ticker' => $originalOption['ticker'],
                    'type' => $closingType,
                    'contract_type' => $originalOption['contract_type'],
                    'strike_price' => (float)$originalOption['strike_price'],
                    'expiration_date' => $originalOption['expiration_date'],
                    'contracts' => (int)$originalOption['contracts'],
                    'premium' => $exitPremium ?? 0.0, // Use exit_premium if provided, else 0
                    'status' => 'FILLED', // The closing transaction itself is 'FILLED'
                ];
                $wheelRepository->insertOptionOrder($closingOptionData); // This will insert a new row
                $message = 'Option closed and balancing transaction logged successfully.';
            }
            break;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid action specified.']);
            exit;
    }

    // After updating any database row status, evaluate parent strategy status
    if ($success && $strategyId !== null) {
        $strategyRepository->evaluateStrategyStatus($strategyId);
    }

    if ($success) {
        echo json_encode(['success' => true, 'message' => $message]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to perform action.']);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'An unexpected error occurred: ' . $e->getMessage()]);
}