<?php // /var/www/html/@src/Repository/WheelRepository.php

declare(strict_types=1);

namespace Insight\Repository;

use Database;
use PDO;
use PDOException;

class WheelRepository
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getConnection();
    }

    /**
     * Updates an option order status and, if it's a short call shifting to ASSIGNED,
     * logs a balancing ASSIGNED_SELL stock order and archives the associated wheel cycle.
     *
     * @param int $optionOrderId The ID of the option order to update.
     * @param string $newStatus The new status for the option order (e.g., 'ASSIGNED').
     * @param int $brokerId The ID of the broker for the new stock order.
     * @return bool True on success, false on failure.
     * @throws PDOException If a database error occurs.
     */
    public function updateOptionOrderAndHandleAssignment(
        int $optionOrderId,
        string $newStatus,
        int $brokerId
    ): bool {
        $this->db->beginTransaction();
        try {
            // 1. Get option order details
            $stmt = $this->db->prepare("SELECT * FROM option_orders WHERE id = :id FOR UPDATE");
            $stmt->execute([':id' => $optionOrderId]);
            $optionOrder = $stmt->fetch();

            if (!$optionOrder) {
                $this->db->rollBack();
                return false; // Option order not found
            }

            // 2. Update option order status
            $stmt = $this->db->prepare("UPDATE option_orders SET status = :status WHERE id = :id");
            $stmt->execute([':status' => $newStatus, ':id' => $optionOrderId]);

            // 3. If it's a short call assigned, log balancing stock order and archive cycle
            if ($optionOrder['type'] === 'SELL_TO_OPEN' && $optionOrder['contract_type'] === 'CALL' && $newStatus === 'ASSIGNED') {
                $wheelCycleId = $optionOrder['wheel_cycle_id'];
                $assignedShares = $optionOrder['contracts'] * 100;
                $assignedPrice = $optionOrder['strike_price']; // Stock is sold at the strike price

                // Log balancing ASSIGNED_SELL stock order
                $stmt = $this->db->prepare(
                    "INSERT INTO stock_orders (wheel_cycle_id, broker_id, ticker, type, shares, price, expiration_date)
                     VALUES (:wheel_cycle_id, :broker_id, :ticker, :type, :shares, :price, :expiration_date)"
                );
                $stmt->execute([
                    ':wheel_cycle_id' => $wheelCycleId,
                    ':broker_id' => $brokerId,
                    ':ticker' => $optionOrder['ticker'],
                    ':type' => 'ASSIGNED_SELL',
                    ':shares' => $assignedShares,
                    ':price' => $assignedPrice,
                    ':expiration_date' => $optionOrder['expiration_date']
                ]);

                // Archive the corresponding active wheel cycle
                if ($wheelCycleId !== null) {
                    $stmt = $this->db->prepare(
                        "UPDATE wheel_cycles SET status = 'archived', archived_at = NOW() WHERE id = :id AND status = 'active'"
                    );
                    $stmt->execute([':id' => $wheelCycleId]);
                }
            }

            $this->db->commit();
            return true;
        } catch (PDOException $e) {
            $this->db->rollBack();
            error_log("Transaction failed in WheelRepository: " . $e->getMessage());
            throw $e; // Re-throw for higher-level error handling
        }
    }

    /**
     * Fetches all relevant option orders for the dashboard display,
     * including associated wheel cycle and strategy data.
     *
     * @return array A flat array of option orders with joined data.
     */
    public function getDashboardOptionsData(): array
    {
        $query = "
            SELECT
                oo.id AS option_id,
                oo.ticker AS cycle_ticker, -- Using option_orders ticker as the primary ticker for display
                oo.type AS option_type,
                oo.contract_type,
                oo.strike_price,
                oo.expiration_date,
                oo.contracts,
                oo.premium,
                oo.status AS option_status,
                oo.option_strategy_id,
                oo.leg_type,
                oo.wheel_cycle_id AS cycle_id, -- Alias for consistency with JS expectation
                b.name AS broker_name,
                b.color_hex AS broker_color,
                os.strategy_name,
                os.status AS strategy_status,
                wc.assigned_shares,
                wc.status AS cycle_status
            FROM
                option_orders oo
            LEFT JOIN
                brokers b ON oo.broker_id = b.id
            LEFT JOIN
                option_strategies os ON oo.option_strategy_id = os.id
            LEFT JOIN
                wheel_cycles wc ON oo.wheel_cycle_id = wc.id
            WHERE
                oo.status IN ('OPEN', 'FILLED', 'ASSIGNED') -- Only show active/open option orders
                AND (
                    os.id IS NULL -- Standalone option (not part of a strategy)
                    OR os.status = 'OPEN' -- Or part of an open strategy
                )
                AND (
                    wc.id IS NULL -- Not part of a wheel cycle
                    OR wc.status = 'active' -- Or part of an active wheel cycle
                )
            ORDER BY
                oo.ticker, oo.expiration_date;
        ";
        $stmt = $this->db->query($query);
        return $stmt->fetchAll();
    }

    /**
     * Inserts a new option order.
     *
     * @param array $data Associative array of option order data.
     * @return int The ID of the newly inserted option order.
     * @throws PDOException
     */
    public function insertOptionOrder(array $data): int
    {
        $sql = "INSERT INTO option_orders (wheel_cycle_id, broker_id, ticker, type, contract_type, strike_price, expiration_date, contracts, premium, status)
                VALUES (:wheel_cycle_id, :broker_id, :ticker, :type, :contract_type, :strike_price, :expiration_date, :contracts, :premium, :status)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':wheel_cycle_id' => $data['wheel_cycle_id'] ?? null,
            ':broker_id' => $data['broker_id'],
            ':ticker' => $data['ticker'],
            ':type' => $data['type'],
            ':contract_type' => $data['contract_type'],
            ':strike_price' => $data['strike_price'],
            ':expiration_date' => $data['expiration_date'],
            ':contracts' => $data['contracts'],
            ':premium' => $data['premium'],
            ':status' => $data['status'] ?? 'FILLED'
        ]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Inserts a new wheel cycle.
     *
     * @param string $ticker
     * @param int $assignedShares
     * @return int The ID of the newly inserted wheel cycle.
     * @throws PDOException
     */
    public function insertWheelCycle(string $ticker, int $assignedShares): int
    {
        $sql = "INSERT INTO wheel_cycles (ticker, assigned_shares) VALUES (:ticker, :assigned_shares)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':ticker' => $ticker,
            ':assigned_shares' => $assignedShares
        ]);
        return (int)$this->db->lastInsertId();
    }

    /**
     * Fetches a broker by name.
     * @param string $name
     * @return array|false
     */
    public function getBrokerByName(string $name)
    {
        $stmt = $this->db->prepare("SELECT id FROM brokers WHERE name = :name");
        $stmt->execute([':name' => $name]);
        return $stmt->fetch();
    }
}
