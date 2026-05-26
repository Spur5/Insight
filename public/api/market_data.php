<?php // /var/www/html/@public/api/market_data.php

declare(strict_types=1);

header('Content-Type: application/json');

// Simulate a delay for network latency
// usleep(500000); // 0.5 seconds

$tickersParam = $_GET['tickers'] ?? '';
$tickers = array_filter(array_map('trim', explode(',', $tickersParam)));

$marketData = [];

foreach ($tickers as $ticker) {
    // Generate dummy data for each ticker
    $underlyingPrice = round(rand(10000, 50000) / 100, 2); // e.g., $100.00 - $500.00
    $volatility = round(rand(15, 40) / 100, 2); // e.g., 0.15 - 0.40

    $options = [];
    // Simulate a few option contracts
    for ($i = 0; $i < rand(1, 3); $i++) {
        $strikeOffset = rand(-10, 10); // Strike price relative to underlying
        $strikePrice = round($underlyingPrice + $strikeOffset, 2);
        $callPremium = round(rand(50, 500) / 100, 2); // e.g., $0.50 - $5.00
        $putPremium = round(rand(50, 500) / 100, 2);

        $options[] = [
            'strike_price' => $strikePrice,
            'call_premium' => $callPremium,
            'put_premium' => $putPremium,
            'implied_volatility' => $volatility,
            'delta' => round(rand(30, 70) / 100, 2), // Dummy delta
        ];
    }

    $marketData[$ticker] = [
        'underlying_price' => $underlyingPrice,
        'options' => $options,
        'timestamp' => date('Y-m-d H:i:s'),
    ];
}

echo json_encode($marketData);
