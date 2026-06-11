-- /var/www/html/database_migration_v2.sql

-- Create option_strategies table
CREATE TABLE IF NOT EXISTS `option_strategies` ( -- Changed 'id' to INT UNSIGNED
    `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    `ticker` VARCHAR(10) NOT NULL,
    `strategy_name` ENUM('Covered Call', 'Cash Secured Put', 'Vertical Spread', 'Iron Condor', 'Straddle', 'Strangle', 'Other') NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `closed_at` DATETIME NULL,
    INDEX `idx_ticker_status` (`ticker`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alter option_orders table to add strategy linkage
ALTER TABLE `option_orders`
    ADD COLUMN `option_strategy_id` INT UNSIGNED NULL AFTER `wheel_cycle_id`,
    ADD COLUMN `leg_type` ENUM('LONG_CALL', 'SHORT_CALL', 'LONG_PUT', 'SHORT_PUT') NULL AFTER `option_strategy_id`,
    ADD CONSTRAINT `fk_option_strategy`
        FOREIGN KEY (`option_strategy_id`)
        REFERENCES `option_strategies`(`id`)
        ON DELETE SET NULL;

ALTER TABLE `option_orders` MODIFY COLUMN `status` ENUM('OPEN', 'FILLED', 'CLOSED', 'EXPIRED', 'ASSIGNED', 'CANCELLED') NOT NULL DEFAULT 'FILLED';

-- Note: If you have existing data, you might need to run a data migration

ALTER TABLE `option_orders` DROP COLUMN `leg_type`;