<?php // /var/www/html/test_wheel_math.php

declare(strict_types=1);
 
require_once __DIR__ . '/src/Engine/WheelMath.php';

use Insight\Engine\WheelMath;

echo "--- Testing WheelMath::calculateEffectiveCostBasis ---\n";

// Test Case 1: Standard calculation
$assignedStockCost1 = 30000.0; // 300 shares * $100 strike
$assignedShares1 = 300;
$linkedOptionContracts1 = [
    ['contract_type' => 'PUT', 'contracts' => 3, 'premium' => 2.00], // 3 contracts * $2.00 * 100 = $600
    ['contract_type' => 'CALL', 'contracts' => 2, 'premium' => 1.50], // 2 contracts * $1.50 * 100 = $300
];
// Expected: (30000 - 600 - 300) / 300 = 29100 / 300 = 97.00
$effectiveCostBasis1 = WheelMath::calculateEffectiveCostBasis($assignedStockCost1, $assignedShares1, $linkedOptionContracts1);
echo "Test Case 1 (Standard): Expected 97.00, Got " . number_format($effectiveCostBasis1, 2) . "\n";
assert(abs($effectiveCostBasis1 - 97.00) < 0.001, "Test Case 1 Failed");

// Test Case 2: Independence Guard - Overflow Call Premiums
$assignedStockCost2 = 30000.0; // 300 shares * $100 strike
$assignedShares2 = 300;
$linkedOptionContracts2 = [
    ['contract_type' => 'PUT', 'contracts' => 3, 'premium' => 2.00], // 3 contracts * $2.00 * 100 = $600
    ['contract_type' => 'CALL', 'contracts' => 1, 'premium' => 1.00], // 1 contract * $1.00 * 100 = $100
    ['contract_type' => 'CALL', 'contracts' => 1, 'premium' => 1.50], // 1 contract * $1.50 * 100 = $150
    ['contract_type' => 'CALL', 'contracts' => 1, 'premium' => 2.00], // 1 contract * $2.00 * 100 = $200
    ['contract_type' => 'CALL', 'contracts' => 1, 'premium' => 2.50], // 1 contract * $2.50 * 100 = $250 (This one should be ignored)
];
// Max call capacity: 300 / 100 = 3 contracts
// Premiums considered: PUT (3*2*100=600) + CALL1 (1*1*100=100) + CALL2 (1*1.5*100=150) + CALL3 (1*2*100=200)
// Total considered premium: 600 + 100 + 150 + 200 = 1050
// Expected: (30000 - 1050) / 300 = 28950 / 300 = 96.50
$effectiveCostBasis2 = WheelMath::calculateEffectiveCostBasis($assignedStockCost2, $assignedShares2, $linkedOptionContracts2);
echo "Test Case 2 (Independence Guard): Expected 96.50, Got " . number_format($effectiveCostBasis2, 2) . "\n";
assert(abs($effectiveCostBasis2 - 96.50) < 0.001, "Test Case 2 Failed");

echo "All WheelMath tests passed!\n";
