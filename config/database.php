<?php // /var/www/html/config/database.php

declare(strict_types=1);
require_once __DIR__ . '/../../web-config/db_credentials.php';

class Database
{
    private static ?PDO $pdo = null;

    // Database connection parameters
    private const DB_HOST = 'localhost';
    private const DB_NAME = DB_NAME; // Change this to your database name
    private const DB_USER = DB_USERNAME; // Change this to your database user
    private const DB_PASS = DB_PASSWORD; // Change this to your database password
    private const DB_CHARSET = 'utf8mb4';

    /**
     * Get the PDO database connection instance.
     *
     * @return PDO
     * @throws PDOException If the connection fails.
     */
    public static function getConnection(): PDO
    {
        if (self::$pdo === null) {
            $dsn = "mysql:host=" . self::DB_HOST . ";dbname=" . self::DB_NAME . ";charset=" . self::DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            try {
                self::$pdo = new PDO($dsn, self::DB_USER, self::DB_PASS, $options);
            } catch (PDOException $e) {
                // Log the error (e.g., to a file) and re-throw or handle gracefully
                error_log("Database connection failed: " . $e->getMessage());
                throw new PDOException("Could not connect to the database.", (int)$e->getCode());
            }
        }
        return self::$pdo;
    }
}