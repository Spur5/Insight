<?php // /var/www/html/src/Repository/StrategyRepository.php

declare(strict_types=1);

namespace Insight\Repository;

use Database;
use PDO;
use PDOException;

class StrategyRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Inserts a new multi-leg option strategy and its associated option orders.
     *
     * @param string $ticker The ticker symbol for the strategy.
     * @param string $strategyName The name of the strategy (e.g., 'Vertical Spread').
     * @param array $legsData An array of associative arrays, each representing an option leg.
     *                        Expected keys for each leg: 'type', 'contract_type', 'strike_price',
     *                        'expiration_date', 'contracts', 'premium', 'leg_type', 'status'.
     * @param int $brokerId The ID of the broker for all legs.
     * @return int The ID of the newly inserted option strategy.
     * @throws PDOException If a database error occurs.
     * @throws \InvalidArgumentException If required leg data is missing.
     */
    public function insertMultiLegStrategy(
        string $ticker,
        string $strategyName,
        array $legsData,
        int $brokerId
    ): int {
        $this->db->beginTransaction();
        try {
            // 1. Insert new parent strategy
            $stmt = $this->db->prepare(
                "INSERT INTO option_strategies (ticker, strategy_name, status)
                 VALUES (:ticker, :strategy_name, 'OPEN')"
            );
            $stmt->execute([
                ':ticker' => $ticker,
                ':strategy_name' => $strategyName
            ]);
            $strategyId = (int)$this->db->lastInsertId();

            // 2. Insert individual option legs
            $optionOrderSql = "INSERT INTO option_orders 
                               (wheel_cycle_id, option_strategy_id, leg_type, broker_id, ticker, type, contract_type, strike_price, expiration_date, contracts, premium, status)
                               VALUES (:wheel_cycle_id, :option_strategy_id, :leg_type, :broker_id, :ticker, :type, :contract_type, :strike_price, :expiration_date, :contracts, :premium, :status)";
            $optionOrderStmt = $this->db->prepare($optionOrderSql);

            foreach ($legsData as $leg) {
                // Basic validation for leg data
                $requiredLegFields = [
                    'type', 'contract_type', 'strike_price', 'expiration_date',
                    'contracts', 'premium', 'leg_type', 'status'
                ];
                foreach ($requiredLegFields as $field) {
                    if (!isset($leg[$field])) {
                        throw new \InvalidArgumentException("Missing required field '{$field}' in leg data.");
                    }
                }

                $optionOrderStmt->execute([
                    ':wheel_cycle_id' => $leg['wheel_cycle_id'] ?? null, // Strategies can still be part of a wheel cycle
                    ':option_strategy_id' => $strategyId,
                    ':leg_type' => $leg['leg_type'],
                    ':broker_id' => $brokerId,
                    ':ticker' => $ticker, // Ticker from parent strategy
                    ':type' => $leg['type'],
                    ':contract_type' => $leg['contract_type'],
                    ':strike_price' => (float)$leg['strike_price'],
                    ':expiration_date' => $leg['expiration_date'],
                    ':contracts' => (int)$leg['contracts'],
                    ':premium' => (float)$leg['premium'],
                    ':status' => $leg['status']
                ]);
            }

            $this->db->commit();
            return $strategyId;
        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("Transaction failed in StrategyRepository::insertMultiLegStrategy: " . $e->getMessage());
            throw $e;
        } catch (\InvalidArgumentException $e) {
            $this->db->rollBack();
            error_log("Invalid argument in StrategyRepository::insertMultiLegStrategy: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Evaluates the status of a strategy based on its child option orders.
     * If all child legs are in a terminal status, the parent strategy is marked as 'CLOSED'.
     *
     * @param int $strategyId The ID of the strategy to evaluate.
     * @return bool True if the strategy status was updated to 'CLOSED', false otherwise.
     * @throws PDOException If a database error occurs.
     */
    public function evaluateStrategyStatus(int $strategyId): bool
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                "SELECT status FROM option_orders WHERE option_strategy_id = :strategy_id FOR UPDATE"
            );
            $stmt->execute([':strategy_id' => $strategyId]);
            $legs = $stmt->fetchAll(PDO::FETCH_COLUMN);

            $terminalStatuses = ['CLOSED', 'EXPIRED', 'ASSIGNED', 'CANCELLED'];
            $allLegsTerminal = !empty($legs) && count(array_diff($legs, $terminalStatuses)) === 0;

            if ($allLegsTerminal) {
                $stmt = $this->db->prepare("UPDATE option_strategies SET status = 'CLOSED', closed_at = NOW() WHERE id = :id AND status = 'OPEN'");
                $stmt->execute([':id' => $strategyId]);
                $updated = $stmt->rowCount() > 0;
                $this->db->commit();
                return $updated;
            }
            $this->db->rollBack();
            return false;
        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("Transaction failed in StrategyRepository::evaluateStrategyStatus: " . $e->getMessage());
            throw $e;
        }
    }
}