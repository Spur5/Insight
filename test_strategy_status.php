<?php
// /var/www/html/test_strategy_status.php (New file for testing)

declare(strict_types=1);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/src/Repository/StrategyRepository.php';
require_once __DIR__ . '/src/Repository/WheelRepository.php'; // For getBrokerByName

use Insight\Repository\StrategyRepository;
use Insight\Repository\WheelRepository;

echo "--- Testing StrategyRepository::evaluateStrategyStatus ---\n";

try {
    $strategyRepo = new StrategyRepository();
    $wheelRepo = new WheelRepository();

    // Get a broker ID for testing
    $broker = $wheelRepo->getBrokerByName('Tastytrade');
    if (!$broker) {
        echo "Error: Tastytrade broker not found. Please ensure brokers table is seeded.\n";
        exit(1);
    }
    $brokerId = (int)$broker['id'];

    // Clean up tables before test to ensure a fresh state
    $db = Database::getConnection();
    $db->exec("SET FOREIGN_KEY_CHECKS = 0"); // Temporarily disable foreign key checks
    $db->exec("TRUNCATE TABLE option_orders"); // Truncate child table first
    $db->exec("TRUNCATE TABLE option_strategies"); // Truncate parent table second
    $db->exec("SET FOREIGN_KEY_CHECKS = 1"); // Re-enable foreign key checks

    // 1. Insert a mock strategy with 3 legs
    $ticker = 'TEST';
    $strategyName = 'Vertical Spread'; // Corrected to a valid ENUM value
    $legsData = [
        [
            'type' => 'SELL_TO_OPEN', 'contract_type' => 'CALL', 'strike_price' => 100.00,
            'expiration_date' => '2024-12-31', 'contracts' => 1, 'premium' => 1.50,
            'leg_type' => 'SHORT_CALL', 'status' => 'FILLED'
        ],
        [
            'type' => 'BUY_TO_OPEN', 'contract_type' => 'CALL', 'strike_price' => 105.00,
            'expiration_date' => '2024-12-31', 'contracts' => 1, 'premium' => 0.50,
            'leg_type' => 'LONG_CALL', 'status' => 'FILLED'
        ],
        [
            'type' => 'SELL_TO_OPEN', 'contract_type' => 'PUT', 'strike_price' => 90.00,
            'expiration_date' => '2024-12-31', 'contracts' => 1, 'premium' => 1.00,
            'leg_type' => 'SHORT_PUT', 'status' => 'FILLED'
        ]
    ];

    $strategyId = $strategyRepo->insertMultiLegStrategy($ticker, $strategyName, $legsData, $brokerId);
    echo "Inserted strategy with ID: {$strategyId}\n";

    // Verify initial status is OPEN
    $stmt = Database::getConnection()->prepare("SELECT status FROM option_strategies WHERE id = :id");
    $stmt->execute([':id' => $strategyId]);
    $initialStatus = $stmt->fetchColumn();
    echo "Initial strategy status: {$initialStatus} (Expected: OPEN)\n";
    assert($initialStatus === 'OPEN', "Assertion Failed: Initial status should be OPEN.");

    // 2. Mark 2 legs as 'CLOSED'
    $stmtUpdateLegsPartial = Database::getConnection()->prepare( // Use distinct variable
        "UPDATE option_orders SET status = 'CLOSED' WHERE option_strategy_id = :strategy_id LIMIT 2"
    );
    $stmtUpdateLegsPartial->execute([':strategy_id' => $strategyId]);
    echo "Marked 2 legs as 'CLOSED'.\n";

    // Evaluate strategy status - should remain OPEN
    $updated = $strategyRepo->evaluateStrategyStatus($strategyId);
    $stmtCheckStatusPartial = Database::getConnection()->prepare("SELECT status FROM option_strategies WHERE id = :id"); // New statement for checking status
    $stmtCheckStatusPartial->execute([':id' => $strategyId]);
    $statusAfterPartialClose = $stmtCheckStatusPartial->fetchColumn();
    echo "Status after partial close: {$statusAfterPartialClose} (Expected: OPEN)\n";
    assert($statusAfterPartialClose === 'OPEN', "Assertion Failed: Status should remain OPEN after partial close.");
    assert($updated === false, "Assertion Failed: evaluateStrategyStatus should return false when not all legs are terminal.");

    // 3. Flip the final leg to 'EXPIRED'
    $stmtUpdateLegsFinal = Database::getConnection()->prepare( // Use distinct variable
        "UPDATE option_orders SET status = 'EXPIRED' WHERE option_strategy_id = :strategy_id AND status = 'FILLED' LIMIT 1"
    );
    $stmtUpdateLegsFinal->execute([':strategy_id' => $strategyId]);
    echo "Marked final leg as 'EXPIRED'.\n";

    // Evaluate strategy status - should transition to CLOSED
    $updated = $strategyRepo->evaluateStrategyStatus($strategyId);
    $stmtCheckStatusFinal = Database::getConnection()->prepare("SELECT status FROM option_strategies WHERE id = :id"); // New statement for checking status
    $stmtCheckStatusFinal->execute([':id' => $strategyId]);
    $statusAfterFullClose = $stmtCheckStatusFinal->fetchColumn();
    echo "Status after all legs terminal: {$statusAfterFullClose} (Expected: CLOSED)\n";
    assert($statusAfterFullClose === 'CLOSED', "Assertion Failed: Status should be CLOSED after all legs are terminal.");
    assert($updated === true, "Assertion Failed: evaluateStrategyStatus should return true when strategy is closed.");

    echo "--- Test completed successfully! ---\n";

} catch (Exception $e) {
    echo "Test failed: " . $e->getMessage() . "\n";
}