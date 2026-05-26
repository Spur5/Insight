<?php // /var/www/html/@src/Engine/WheelMath.php

declare(strict_types=1);

namespace Insight\Engine;

class WheelMath
{
    /**
     * Calculates the effective cost basis for a wheel cycle,
     * applying the Independence Guard for call option premiums.
     *
     * The Independence Guard ensures that if linked call option contracts
     * total a contract count value greater than the cycle's maximum capacity
     * (assigned_shares / 100), any overflow premiums are ignored.
     *
     * @param float $assignedStockCost The total cost of the assigned stock (e.g., strike price * assigned shares).
     * @param int $assignedShares The total number of shares assigned in the cycle.
     * @param array<array{contract_type: string, contracts: int, premium: float}> $linkedOptionContracts An array of associative arrays,
     *                                                                                                   each representing a linked option contract.
     *                                                                                                   Expected keys: 'contract_type' (e.g., 'CALL', 'PUT'),
     *                                                                                                   'contracts' (number of contracts), 'premium' (premium per contract).
     * @return float The effective cost basis per share.
     */
    public static function calculateEffectiveCostBasis(
        float $assignedStockCost,
        int $assignedShares,
        array $linkedOptionContracts
    ): float {
        if ($assignedShares <= 0) {
            return $assignedStockCost; // Or throw an exception, depending on desired behavior for invalid input
        }

        $totalPremiumReceived = 0.0;
        $maxCallContractsCapacity = $assignedShares / 100;
        $currentCallContractsCount = 0;

        foreach ($linkedOptionContracts as $contract) {
            $contracts = $contract['contracts'];
            $premium = $contract['premium']; // Premium per contract

            if ($contract['contract_type'] === 'CALL') {
                // Apply Independence Guard for CALL options
                $contractsToConsider = min($contracts, $maxCallContractsCapacity - $currentCallContractsCount);
                if ($contractsToConsider > 0) {
                    $totalPremiumReceived += ($contractsToConsider * $premium * 100); // Premium * contracts * 100 shares/contract
                    $currentCallContractsCount += $contractsToConsider;
                }
            } elseif ($contract['contract_type'] === 'PUT') {
                // PUT options always contribute to premium received
                $totalPremiumReceived += ($contracts * $premium * 100);
            }
        }

        $effectiveTotalCost = $assignedStockCost - $totalPremiumReceived;
        return $effectiveTotalCost / $assignedShares;
    }
}
