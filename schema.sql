-- /var/www/html/database_migration.sql

-- Create brokers table
CREATE TABLE IF NOT EXISTS `brokers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL UNIQUE,
    `color_hex` VARCHAR(7) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed brokers table
INSERT IGNORE INTO `brokers` (`name`, `color_hex`) VALUES
('Tastytrade', '#5f00d7'),
('ThinkOrSwim', '#00875a'),
('Fidelity', '#005a9c');

-- Create wheel_cycles table
CREATE TABLE IF NOT EXISTS `wheel_cycles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ticker` VARCHAR(10) NOT NULL,
    `assigned_shares` INT NOT NULL,
    `status` ENUM('active', 'archived') NOT NULL DEFAULT 'active',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `archived_at` DATETIME NULL,
    CONSTRAINT `chk_assigned_shares_multiple_of_100` CHECK (`assigned_shares` % 100 = 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create stock_orders table
CREATE TABLE IF NOT EXISTS `stock_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `wheel_cycle_id` INT NULL, -- Link to wheel_cycles if applicable
    `broker_id` INT NOT NULL,
    `ticker` VARCHAR(10) NOT NULL,
    `type` ENUM('BUY', 'SELL', 'ASSIGNED_BUY', 'ASSIGNED_SELL') NOT NULL,
    `shares` INT NOT NULL,
    `price` DECIMAL(10, 4) NOT NULL,
    `order_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `status` ENUM('OPEN', 'FILLED', 'CANCELLED') NOT NULL DEFAULT 'FILLED',
    `expiration_date` DATE NULL, -- For tracking purposes, e.g., if linked to an option assignment
    INDEX `idx_stock_status_expiration` (`status`, `expiration_date`),
    FOREIGN KEY (`broker_id`) REFERENCES `brokers`(`id`),
    FOREIGN KEY (`wheel_cycle_id`) REFERENCES `wheel_cycles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create option_orders table
CREATE TABLE IF NOT EXISTS `option_orders` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `wheel_cycle_id` INT NULL, -- Link to wheel_cycles if applicable
    `broker_id` INT NOT NULL,
    `ticker` VARCHAR(10) NOT NULL,
    `type` ENUM('BUY_TO_OPEN', 'SELL_TO_OPEN', 'BUY_TO_CLOSE', 'SELL_TO_CLOSE') NOT NULL,
    `contract_type` ENUM('CALL', 'PUT') NOT NULL,
    `strike_price` DECIMAL(10, 2) NOT NULL,
    `expiration_date` DATE NOT NULL,
    `contracts` INT NOT NULL,
    `premium` DECIMAL(10, 2) NOT NULL, -- Premium per contract
    `order_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `status` ENUM('OPEN', 'FILLED', 'ASSIGNED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'FILLED',
    INDEX `idx_option_ticker_status` (`ticker`, `status`),
    FOREIGN KEY (`broker_id`) REFERENCES `brokers`(`id`),
    FOREIGN KEY (`wheel_cycle_id`) REFERENCES `wheel_cycles`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
