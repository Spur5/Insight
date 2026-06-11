<!DOCTYPE html>
<?php
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/src/Repository/WheelRepository.php';
use Insight\Repository\WheelRepository;
$repository = new WheelRepository();
?>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insight Dashboard - Phase 1</title>
    <!-- Tailwind CSS CDN (daisyUI 5 requires Tailwind) -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- daisyUI CDN (production stable) -->
    <link href="https://cdn.jsdelivr.net/npm/daisyui@latest/dist/full.min.css" rel="stylesheet" type="text/css" />
    <style>
        /* Custom styles for DTE heatmap */
        .dte-red { background-color: #ef4444; color: white; } /* Tailwind red-500 */
        .dte-yellow { background-color: #facc15; color: black; } /* Tailwind yellow-400 */
        .itm-alert { background-color: #dc2626; color: white; font-weight: bold; } /* Tailwind red-600 */
    </style>
</head>
<body class="bg-base-200 text-base-content min-h-screen p-4">
    <div class="max-w-none mx-auto px-4">
        <h1 class="text-4xl font-bold mb-8 text-center">Insight Trading Command Center</h1>

        <div class="flex justify-end mb-4">
            <button class="btn btn-primary" id="btn_quick_fill_entry">Add Option Trade</button>
        </div>

        <div class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
                <h2 class="card-title">Active Options</h2>
                <div class="overflow-x-auto" id="dashboard-table-container">
                    <table class="table w-full border-separate" style="border-spacing: 0 5px;" id="dashboard-table">
                        <thead>
                            <tr>
                                <th class="text-center text-base cursor-pointer hover:bg-base-300 select-none sortable-header" data-sort-key="ticker">Ticker <span class="sort-indicator text-xs text-base-content/30">↕</span></th>
                                <th class="text-center text-base">Type</th>
                                <th class="text-center text-base">Contracts</th>
                                <th class="text-center text-base">Strike</th>
                                <th class="text-center text-base cursor-pointer hover:bg-base-300 select-none sortable-header" data-sort-key="expiration">Exp. Date <span class="sort-indicator text-xs text-base-content/30">↕</span></th>
                                <th class="text-center text-base">DTE</th>
                                <th class="text-center text-base">Broker</th>
                                <th class="text-center text-base">Avg Price</th>
                                <th class="text-center text-base">Cur Price</th>
                                <th class="text-center text-base">Status</th>
                                <th class="text-center text-base">Underlying</th>
                                <th class="text-center text-base cursor-pointer hover:bg-base-300 select-none sortable-header" data-sort-key="pnl">Unrealized P&L ($) <span class="sort-indicator text-xs text-base-content/30">↕</span></th>
                                <th class="text-center text-base">P&L (%)</th>
                                <th class="text-left text-base">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="dashboard-table-body">
                            <!-- Data will be rendered here by JavaScript -->
                            <?php
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
      <div class="modal-box w-11/12 max-w-4xl bg-base-100 border border-base-content/20 shadow-2xl p-6">
        <button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 z-10" onclick="resetForm()">✕</button>
        <h3 class="text-2xl font-black mb-4 tracking-tight uppercase opacity-90">Log Execution Entry</h3>
        
        <form id="quick_fill_form" onsubmit="event.preventDefault();">
          <!-- Global Context Wrapper -->
          <div class="grid grid-cols-3 gap-4 bg-base-200 p-4 rounded-xl border border-base-content/5 mb-4 shadow-sm">
            <div>
              <label class="label pt-0 text-[10px] font-bold uppercase opacity-60">Ticker Symbol</label>
              <input type="text" id="global_ticker" class="input input-sm w-full bg-base-100 border border-base-content/20 focus:border-primary" placeholder="e.g. SPY" required />
            </div>
            <div>
              <label class="label pt-0 text-[10px] font-bold uppercase opacity-60">Broker Account</label>
              <select id="global_broker" class="select select-sm w-full bg-base-100 border border-base-content/20 focus:border-primary" required>
                <option value="Tastytrade">Tastytrade</option>
                <option value="ThinkOrSwim">ThinkOrSwim</option>
                <option value="Fidelity">Fidelity</option>
              </select>
            </div>
            <div id="strategy_type_container" class="hidden">
              <label class="label pt-0 text-[10px] font-bold uppercase opacity-60">Strategy Group Type</label>
              <select id="strategy_name" class="select select-sm w-full bg-base-100 border border-base-content/20 focus:border-primary">
                <option value="VERTICAL_SPREAD">Vertical Spread</option>
                <option value="IRON_CONDOR">Iron Condor</option>
                <option value="STRANGLE">Strangle</option>
                <option value="STRADDLE">Straddle</option>
                <option value="CUSTOM" selected>Other / Custom Strategy</option>
              </select>
            </div>
          </div>

          <div id="strategy_legs_fields_container" class="space-y-4">
            <div id="legs_wrapper" class="space-y-4"></div>
            <div class="flex justify-center">
              <button type="button" class="btn btn-sm btn-outline btn-secondary px-8" id="btn_add_leg_row">+ Add Leg Row Item</button>
            </div>
          </div>

          <div class="modal-action">
            <button type="button" class="btn btn-ghost" onclick="resetForm()">Cancel</button>
            <button type="submit" class="btn btn-success" id="btn_submit_entry">Save Trade</button>
          </div>
        </form>
      </div>
    </dialog>

    <script src="/assets/js/dashboard.js"></script>
    <script src="/assets/js/QuickFill.js"></script>
</body>
</html>
