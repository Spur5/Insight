<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insight Dashboard - Phase 1</title>
    <!-- Tailwind CSS CDN (daisyUI 5 requires Tailwind) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- daisyUI CDN (latest stable release) -->
    <link href="https://cdn.jsdelivr.net/npm/daisyui@latest/dist/full.min.css" rel="stylesheet" type="text/css" />
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

        <div class="flex justify-end mb-4">
            <button class="btn btn-primary" id="btn_quick_fill_entry">+ Quick-Fill Entry</button>
        </div>

        <div class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
                <h2 class="card-title">Active Wheel Cycles & Options</h2>
                <div class="overflow-x-auto" id="dashboard-table-container">
                    <table class="table table-xs w-full" id="dashboard-table"> <!-- Added table-xs for smaller text -->
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
                            // Initial data rendering from PHP (mock or actual from DB) - Paths corrected after public folder collapse
                            require_once __DIR__ . '/config/database.php';
                            require_once __DIR__ . '/src/Repository/WheelRepository.php';

                            use Insight\Repository\WheelRepository;

                            $repository = new WheelRepository();
                            // Fetch all relevant option orders for the dashboard
                            $initialOptionsData = $repository->getDashboardOptionsData();

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

    <!-- Quick-Fill Entry Modal -->
    <dialog id="quick_fill_modal" class="modal">
      <div class="modal-box w-11/12 max-w-4xl bg-base-100">
        <h3 class="text-2xl font-bold mb-4">Log Execution Entry</h3>
        
        <div role="tablist" class="tabs tabs-box mb-6">
          <input type="radio" name="form_mode_toggle" role="tab" class="tab" aria-label="Single Leg / Wheel" checked id="mode_single_toggle"/>
          <input type="radio" name="form_mode_toggle" role="tab" class="tab" aria-label="Strategy Complex" id="mode_strategy_toggle"/>
        </div>

        <form id="quick_fill_form" onsubmit="event.preventDefault();">
          <div class="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label class="label text-xs font-semibold">Ticker Symbol</label>
              <input type="text" id="global_ticker" class="input w-full" required />
            </div>
            <div>
              <label class="label text-xs font-semibold">Broker Account</label>
              <select id="global_broker" class="select w-full" required>
                <option value="Tastytrade">Tastytrade</option>
                <option value="ThinkOrSwim">ThinkOrSwim</option>
                <option value="Fidelity">Fidelity</option>
              </select>
            </div>
            <div id="strategy_type_container" class="hidden">
              <label class="label text-xs font-semibold">Strategy Type</label>
              <select id="strategy_name" class="select w-full">
                <option value="VERTICAL_SPREAD">Vertical Spread</option>
                <option value="IRON_CONDOR">Iron Condor</option>
                <option value="STRANGLE">Strangle</option>
                <option value="STRADDLE">Straddle</option>
                <option value="CUSTOM">Other</option>
              </select>
            </div>
          </div>

          <div id="single_leg_fields_container" class="block space-y-4">
            <div class="grid grid-cols-4 gap-2 bg-base-200 p-4 rounded-xl">
              <div>
                <label class="label text-xs">Action Type</label>
                <select id="single_type" class="select select-sm w-full">
                  <option value="SELL_TO_OPEN">SELL_TO_OPEN</option>
                  <option value="BUY_TO_OPEN">BUY_TO_OPEN</option>
                  <option value="BUY_TO_CLOSE">BUY_TO_CLOSE</option>
                  <option value="SELL_TO_CLOSE">SELL_TO_CLOSE</option>
                </select>
              </div>
              <div>
                <label class="label text-xs">Contracts</label>
                <input type="number" id="single_contracts" class="input input-sm w-full" placeholder="1" />
              </div>
              <div>
                <label class="label text-xs">Contract Type</label>
                <select id="single_contract_type" class="select select-sm w-full">
                  <option value="PUT">PUT</option>
                  <option value="CALL">CALL</option>
                </select>
              </div>
              <div>
                <label class="label text-xs">Expiration Date</label>
                <input type="date" id="single_expiration" class="input input-sm w-full" />
              </div>
              <div>
                <label class="label text-xs">Strike Price</label>
                <input type="number" step="0.01" id="single_strike" class="input input-sm w-full" placeholder="0.00" />
              </div>
              <div>
                <label class="label text-xs">Premium per Contract</label>
                <input type="number" step="0.01" id="single_premium" class="input input-sm w-full" placeholder="0.00" />
              </div>
              <div>
                <label class="label text-xs">Wheel Cycle Link ID</label>
                <input type="number" id="single_wheel_id" class="input input-sm w-full" placeholder="Optional" />
              </div>
            </div>
          </div>

          <div id="strategy_legs_fields_container" class="hidden space-y-4">
            <div id="legs_wrapper" class="space-y-2">
              </div>
            <button type="button" class="btn btn-sm btn-outline btn-secondary" id="btn_add_leg_row">+ Add Leg Row Item</button>
          </div>

          <div class="modal-action">
            <button type="button" class="btn" onclick="resetForm()">Cancel</button>
            <button type="submit" class="btn btn-success" id="btn_submit_entry">Commit Transaction</button>
          </div>
        </form>
      </div>
    </dialog>

    <script src="/assets/js/dashboard.js"></script>
    <script src="/assets/js/QuickFill.js"></script>
</body>
</html>
