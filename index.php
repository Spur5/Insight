<!DOCTYPE html>
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
    <div class="container mx-auto">
        <h1 class="text-4xl font-bold mb-8 text-center">Insight Trading Command Center</h1>

        <div class="flex justify-end mb-4">
            <button class="btn btn-primary" id="btn_quick_fill_entry">Add Option Trade</button>
        </div>

        <div class="card bg-base-100 shadow-xl mb-8">
            <div class="card-body">
                <h2 class="card-title">Active Options</h2>
                <div class="overflow-x-auto" id="dashboard-table-container">
                    <table class="table table-xs w-full border-separate" style="border-spacing: 0 5px;" id="dashboard-table"> <!-- Added table-xs for smaller text -->
                        <thead>
                            <tr>
                                <th class="text-center text-base cursor-pointer hover:bg-base-300 select-none sortable-header" data-sort-key="ticker">Ticker <span class="sort-indicator text-xs text-base-content/30">↕</span></th>
                                <th class="text-center text-base">Type</th>
                                <th class="text-center text-base">Contracts</th>
                                <th class="text-center text-base">Strike</th>
                                <th class="text-center text-base cursor-pointer hover:bg-base-300 select-none sortable-header" data-sort-key="expiration">Exp. Date <span class="sort-indicator text-xs text-base-content/30">↕</span></th>
                                <th class="text-center text-base">DTE</th>
                                <th class="text-center text-base">Broker</th>
                                <th class="text-center text-base">Premium</th>
                                <th class="text-center text-base">Current Premium</th>
                                <th class="text-center text-base">Status</th>
                                <th class="text-center text-base">Underlying</th>
                                <th class="text-center text-base">Strategy</th>
                                <th class="text-center text-base">Leg Type</th>
                                <th class="text-center text-base cursor-pointer hover:bg-base-300 select-none sortable-header" data-sort-key="pnl">Unrealized P&L ($) <span class="sort-indicator text-xs text-base-content/30">↕</span></th>
                                <th class="text-center text-base">P&L (%)</th>
                                <th class="text-left text-base">Actions</th>
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
      <div class="modal-box w-11/12 max-w-4xl bg-base-100 border border-base-content/20 shadow-2xl p-6">
        <button type="button" class="btn btn-sm btn-circle btn-ghost absolute right-4 top-4 z-10" onclick="resetForm()">✕</button>
        <h3 class="text-2xl font-black mb-4 tracking-tight uppercase opacity-90">Log Execution Entry</h3>
        
        <!-- Pill-Box Mode Switcher -->
        <div class="bg-base-300 p-1 rounded-xl border border-base-content/10 mb-4">
          <div role="tablist" class="tabs tabs-box tabs-md w-full">
            <input type="radio" name="form_mode_toggle" role="tab" class="tab font-semibold" aria-label="Single Leg / Wheel" checked id="mode_single_toggle"/>
            <input type="radio" name="form_mode_toggle" role="tab" class="tab font-semibold" aria-label="Strategy Complex" id="mode_strategy_toggle"/>
          </div>
        </div>

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
              <label class="label pt-0 text-[10px] font-bold uppercase opacity-60">Strategy Type</label>
              <select id="strategy_name" class="select select-sm w-full bg-base-100 border border-base-content/20 focus:border-primary">
                <option value="VERTICAL_SPREAD">Vertical Spread</option>
                <option value="IRON_CONDOR">Iron Condor</option>
                <option value="STRANGLE">Strangle</option>
                <option value="STRADDLE">Straddle</option>
                <option value="CUSTOM">Other</option>
              </select>
            </div>
          </div>

          <!-- Single Leg Fields -->
          <div id="single_leg_fields_container" class="block">
            <div class="card card-compact bg-base-300 border border-base-content/10 p-2 mb-2 relative">
              <div class="px-1 pb-1">
                <span class="text-[10px] font-bold text-base-content/50 uppercase tracking-wider">Single Position / Wheel Link Setup</span>
              </div>
              
              <div class="flex flex-wrap items-end gap-2">
                <div class="w-32">
                  <label class="label text-[10px] uppercase font-bold p-1">Action</label>
                  <select id="single_type" class="select select-xs w-full bg-base-100 border border-base-content/20" required>
                    <option value="SELL_TO_OPEN">SELL_TO_OPEN</option>
                    <option value="BUY_TO_OPEN">BUY_TO_OPEN</option>
                    <option value="BUY_TO_CLOSE">BUY_TO_CLOSE</option>
                    <option value="SELL_TO_CLOSE">SELL_TO_CLOSE</option>
                  </select>
                </div>
                <div class="w-16">
                  <label class="label text-[10px] uppercase font-bold p-1">Qty</label>
                  <input type="number" id="single_contracts" class="input input-xs w-full bg-base-100 border border-base-content/20" value="1" required />
                </div>
                <div class="w-20">
                  <label class="label text-[10px] uppercase font-bold p-1">Type</label>
                  <select id="single_contract_type" class="select select-xs w-full bg-base-100 border border-base-content/20" required>
                    <option value="PUT">PUT</option>
                    <option value="CALL">CALL</option>
                  </select>
                </div>
                <div class="w-36">
                  <label class="label text-[10px] uppercase font-bold p-1">Expiration</label>
                  <input type="date" id="single_expiration" class="input input-xs w-full bg-base-100 border border-base-content/20" required />
                </div>
                <div class="w-24">
                  <label class="label text-[10px] uppercase font-bold p-1">Strike</label>
                  <input type="number" step="0.01" id="single_strike" class="input input-xs w-full bg-base-100 border border-base-content/20" placeholder="0.00" required />
                </div>
                <div class="w-24">
                  <label class="label text-[10px] uppercase font-bold p-1">Premium</label>
                  <input type="number" step="0.01" id="single_premium" class="input input-xs w-full bg-base-100 border border-base-content/20" placeholder="0.00" required />
                </div>
                <div class="w-32">
                  <label class="label text-[10px] uppercase font-bold p-1">Wheel Link ID</label>
                  <input type="number" id="single_wheel_id" class="input input-xs w-full bg-base-100 border border-base-content/20" placeholder="Optional Link" />
                </div>
              </div>
            </div>
          </div>

          <div id="strategy_legs_fields_container" class="hidden space-y-4">
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
