<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insight Dashboard - Phase 1</title>
    <!-- Tailwind CSS CDN (daisyUI 5 requires Tailwind) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- daisyUI CDN -->
    <link href="https://cdn.jsdelivr.net/npm/daisyui@5.0.0-beta.6/dist/full.min.css" rel="stylesheet" type="text/css" />
    <style>
        /* Custom styles for DTE heatmap */
        .dte-red { background-color: #ef4444; color: white; } /* Tailwind red-500 */
        .dte-yellow { background-color: #facc15; color: black; } /* Tailwind yellow-400 */
        .itm-alert { background-color: #dc2626; color: white; font-weight: bold; } /* Tailwind red-600 */
    </style>
</head>
<body class="bg-base-200 text-base-content min-h-screen p-4">
    <div class="container mx-auto">
        <h1 class="text-4xl font-bold mb-8 text-center">Insight Trading Command Center</h1>

        <div class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
                <h2 class="card-title">Active Wheel Cycles & Options</h2>
                <div class="overflow-x-auto" id="dashboard-table-container">
                    <table class="table table-xs w-full" id="dashboard-table">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Broker</th>
                                <th>Type</th>
                                <th>Strike</th>
                                <th>Exp. Date</th>
                                <th>DTE</th>
                                <th>Contracts</th>
                                <th>Premium</th>
                                <th>Status</th>
                                <th>Underlying Price</th>
                                <th>Strategy</th>
                                <th>Leg Type</th>
                                <th>Current Premium</th>
                                <th>Unrealized P&L ($)</th>
                                <th>Unrealized P&L (%)</th>
                            </tr>
                        </thead>
                        <tbody id="dashboard-table-body">
                            <!-- Data will be rendered here by JavaScript -->
                            <?php
                            // Initial data rendering from PHP (mock or actual from DB)
                            require_once __DIR__ . '/../config/database.php';
                            require_once __DIR__ . '/../src/Repository/WheelRepository.php';

                            use Insight\Repository\WheelRepository;

                            $repository = new WheelRepository();
                            $activeCycles = $repository->getActiveWheelCycles();

                            $groupedData = [];
                            foreach ($activeCycles as $row) {
                                $cycleId = $row['cycle_id'];
                                if (!isset($groupedData[$cycleId])) {
                                    $groupedData[$cycleId] = [
                                        'cycle_id' => $row['cycle_id'],
                                        'ticker' => $row['cycle_ticker'],
                                        'assigned_shares' => $row['assigned_shares'],
                                        'options' => []
                                    ];
                                }
                                if ($row['option_id']) { // Only add if there's an actual option
                                    $groupedData[$cycleId]['options'][] = [
                                        'option_id' => $row['option_id'],
                                        'type' => $row['option_type'],
                                        'contract_type' => $row['contract_type'],
                                        'strike_price' => (float)$row['strike_price'],
                                        'expiration_date' => $row['expiration_date'],
                                        'contracts' => (int)$row['contracts'],
                                        'premium' => (float)$row['premium'],
                                        'status' => $row['option_status'],
                                        'option_strategy_id' => $row['option_strategy_id'],
                                        'leg_type' => $row['leg_type'],
                                        'broker_name' => $row['broker_name'],
                                        'broker_color' => $row['broker_color']
                                    ];
                                    // Add strategy details if available
                                    if ($row['option_strategy_id'] !== null) {
                                        $groupedData[$cycleId]['options'][count($groupedData[$cycleId]['options']) - 1]['strategy_name'] = $row['strategy_name'];
                                        $groupedData[$cycleId]['options'][count($groupedData[$cycleId]['options']) - 1]['strategy_status'] = $row['strategy_status'];
                                    }
                                }
                            }

                            // Flatten for easier JS processing, adding a unique ID for each option row
                            $initialOptionsData = [];
                            foreach ($groupedData as $cycle) {
                                foreach ($cycle['options'] as $option) {
                                    $option['cycle_id'] = $cycle['cycle_id'];
                                    $option['cycle_ticker'] = $cycle['ticker'];
                                    $option['assigned_shares'] = $cycle['assigned_shares'];
                                    $initialOptionsData[] = $option;
                                }
                            }

                            // Encode and pass to JavaScript
                            echo '<script type="text/javascript">';
                            echo 'const initialOptionsData = ' . json_encode($initialOptionsData) . ';';
                            echo '</script>';
                            ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script src="/assets/js/dashboard.js"></script>
</body>
</html>
