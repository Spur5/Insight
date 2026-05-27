// /var/www/html/public/assets/js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const dashboardTableBody = document.getElementById('dashboard-table-body');
    let currentOptionsData = initialOptionsData || []; // Use initial data from PHP

    // Function to calculate Days To Expiration (DTE)
    const calculateDTE = (expirationDateStr) => { // Strict Logic Constraint 1
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        const expirationDate = new Date(expirationDateStr);
        expirationDate.setHours(0, 0, 0, 0); // Normalize to start of day
        const diffTime = expirationDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays); // DTE cannot be negative
    };

    // Function to determine if a short option is In The Money (ITM)
    const isShortOptionITM = (option, underlyingPrice) => {
        // Only consider 'FILLED' options for ITM status
        if (option.type === 'SELL_TO_OPEN' && option.status === 'FILLED' && typeof underlyingPrice === 'number') {
            if (option.contract_type === 'CALL' && underlyingPrice > option.strike_price) {
                return true;
            }
            if (option.contract_type === 'PUT' && underlyingPrice < option.strike_price) {
                return true;
            }
        }
        return false; // Not a short option, not filled, or not ITM
    };

    // Function to calculate unrealized P&L for a single option leg
    const calculateUnrealizedPnL = (option, marketDataForTicker) => {
        if (!marketDataForTicker || !marketDataForTicker.underlying_price || !marketDataForTicker.options) { // Handle missing market data
            return { pnl_dollar: 0, pnl_percent: 0, current_premium: option.premium };
        }

        let currentOptionPremium = 0;

        // Find the current premium for this specific option (strike, type, expiration)
        const matchingMarketOption = marketDataForTicker.options.find(
            (mo) => mo.strike_price === option.strike_price && mo.expiration_date === option.expiration_date
        );

        if (matchingMarketOption) {
            currentOptionPremium = (option.contract_type === 'CALL')
                ? matchingMarketOption.call_premium
                : matchingMarketOption.put_premium;
        } else { // Fallback: if no exact match, use the original premium
            currentOptionPremium = option.premium;
        }

        const contracts = option.contracts;
        const originalPremiumTotal = option.premium * contracts * 100;
        const currentPremiumTotal = currentOptionPremium * contracts * 100;

        let pnl_dollar;
        if (option.type === 'SELL_TO_OPEN') {
            // Strict Logic Constraint 3: SELL_TO_OPEN P/L = (Original Total Premium - Current Total Premium)
            pnl_dollar = originalPremiumTotal - currentPremiumTotal; 
        } else if (option.type === 'BUY_TO_OPEN') {
            // Strict Logic Constraint 3: BUY_TO_OPEN P/L = (Current Total Premium - Original Total Premium)
            pnl_dollar = currentPremiumTotal - originalPremiumTotal; 
        } else {
            pnl_dollar = 0; // Should not happen with current data types
        }

        const pnl_percent = originalPremiumTotal !== 0 ? (pnl_dollar / originalPremiumTotal) * 100 : 0;

        return {
            pnl_dollar: pnl_dollar, // Floating P/L for the individual leg
            pnl_percent: pnl_percent, // Floating P/L % for the individual leg
            current_premium: currentOptionPremium
        };
    };

    // Strict Logic Constraint 2 & 3: Process raw options data into grouped strategies and standalone options, calculating aggregate metrics
    const processOptionsData = (optionsRaw, marketData) => {
        const strategies = {}; // Grouped by option_strategy_id
        const standaloneOptions = [];

        optionsRaw.forEach(option => {
            const tickerMarketData = marketData[option.cycle_ticker] || {};
            const underlyingPrice = tickerMarketData.underlying_price;

            // Calculate individual option metrics
            const dte = calculateDTE(option.expiration_date);
            const { pnl_dollar, pnl_percent, current_premium } = calculateUnrealizedPnL(option, tickerMarketData);
            const isITM = isShortOptionITM(option, underlyingPrice);

            const processedOption = { // Prepare option data with calculated metrics
                ...option,
                dte: dte,
                is_itm: isITM,
                pnl_dollar: pnl_dollar,
                pnl_percent: pnl_percent,
                current_premium: current_premium,
                underlying_price: underlyingPrice
            };

            if (option.option_strategy_id !== null) { // Group by strategy ID
                if (!strategies[option.option_strategy_id]) {
                    strategies[option.option_strategy_id] = {
                        id: option.option_strategy_id,
                        ticker: option.cycle_ticker, // Use cycle_ticker as strategy ticker
                        strategy_name: option.strategy_name,
                        status: option.strategy_status,
                        legs: [],
                        // Aggregate metrics, to be calculated below
                        overall_pnl_dollar: 0,
                        overall_pnl_percent: 0,
                        strategy_dte: Infinity, // Min DTE for strategy
                        strategy_is_itm: false, // True if any short leg is ITM
                        total_original_premium_for_pnl: 0 // Sum of premiums received for short, paid for long
                    };
                }
                strategies[option.option_strategy_id].legs.push(processedOption);
            } else {
                standaloneOptions.push(processedOption);
            }
        });

        // Calculate aggregate metrics for strategies (Strict Logic Constraint 3)
        const processedStrategies = Object.values(strategies).map(strategy => {
            let overallPnLDollar = 0;
            let strategyMinDTE = Infinity;
            let strategyHasITMLeg = false;
            let totalOriginalPremiumForPnl = 0; // For P&L % calculation

            strategy.legs.forEach(leg => {
                const legOriginalPremiumTotal = leg.premium * leg.contracts * 100;
                const legCurrentPremiumTotal = leg.current_premium * leg.contracts * 100;

                if (leg.type === 'SELL_TO_OPEN') {
                    totalOriginalPremiumForPnl += legOriginalPremiumTotal; // Premium received
                    overallPnLDollar += (legOriginalPremiumTotal - legCurrentPremiumTotal);
                } else if (leg.type === 'BUY_TO_OPEN') {
                    totalOriginalPremiumForPnl -= legOriginalPremiumTotal; // Premium paid (negative impact on P&L)
                    overallPnLDollar += (legCurrentPremiumTotal - legOriginalPremiumTotal);
                }

                // Update strategy DTE (minimum of all legs)
                if (leg.dte < strategyMinDTE) {
                    strategyMinDTE = leg.dte;
                }

                // Check if any short leg is ITM
                if (leg.is_itm) {
                    strategyHasITMLeg = true;
                }
            });

            strategy.overall_pnl_dollar = overallPnLDollar;
            strategy.overall_pnl_percent = totalOriginalPremiumForPnl !== 0 ? (overallPnLDollar / totalOriginalPremiumForPnl) * 100 : 0;
            strategy.strategy_dte = strategyMinDTE;
            strategy.strategy_is_itm = strategyHasITMLeg;
            strategy.total_original_premium_for_pnl = totalOriginalPremiumForPnl; // Store for potential display or further calculations

            return strategy;
        });

        // Combine standalone options and strategies into a single list for sorting
        const combinedList = [
            ...standaloneOptions.map(opt => ({ type: 'option', data: opt })),
            ...processedStrategies.map(strat => ({ type: 'strategy', data: strat }))
        ];

        return combinedList;
    };

    // Strict Logic Constraint 5: Client-side sorting logic
    const sortCombinedList = (combinedList) => {
        combinedList.sort((a, b) => {
            const aData = a.data;
            const bData = b.data;

            // Determine ITM status for sorting (Strategy or Single Option level)
            const aIsITM = a.type === 'option' ? aData.is_itm : aData.strategy_is_itm;
            const bIsITM = b.type === 'option' ? bData.is_itm : bData.strategy_is_itm;

            // Determine DTE for sorting (Strategy or Single Option level)
            const aDTE = a.type === 'option' ? aData.dte : aData.strategy_dte;
            const bDTE = b.type === 'option' ? bData.dte : bData.strategy_dte;

            // Determine Ticker for sorting
            const aTicker = aData.ticker || aData.cycle_ticker; // Strategy has 'ticker', option has 'cycle_ticker'
            const bTicker = bData.ticker || bData.cycle_ticker;

            // 1. Short ITM Alert (Strategies or Single Options)
            if (aIsITM && !bIsITM) return -1;
            if (!aIsITM && bIsITM) return 1;

            // 2. Lowest Days to Expiration (DTE)
            if (aDTE !== bDTE) return aDTE - bDTE;

            // 3. Ticker Alphabetical
            return aTicker.localeCompare(bTicker);
        });
        return combinedList;
    };

    // Strict Logic Constraint 4: Function to render/re-render the table with daisyUI 5 accordion
    const renderTable = (combinedList) => {
        dashboardTableBody.innerHTML = ''; // Clear existing rows

        combinedList.forEach(item => {
            if (item.type === 'option') { // Render standalone options as standard <tr> rows
                const option = item.data;
                const dteClass = option.dte < 3 ? 'dte-red' : (option.dte < 7 ? 'dte-yellow' : '');
                const pnlClass = option.pnl_dollar < 0 ? 'text-error' : 'text-success';
                const rowClass = option.is_itm ? 'itm-alert' : '';

                const row = document.createElement('tr');
                row.classList.add(rowClass);
                row.innerHTML = `
                    <td>${option.cycle_ticker}</td>
                    <td><span class="badge" style="background-color:${option.broker_color};">${option.broker_name}</span></td>
                    <td>${option.type} ${option.contract_type}</td>
                    <td>$${option.strike_price.toFixed(2)}</td>
                    <td>${option.expiration_date}</td>
                    <td class="${dteClass}">${option.dte}</td>
                    <td>${option.contracts}</td>
                    <td>$${option.premium.toFixed(2)}</td>
                    <td>${option.status}</td>
                    <td>$${typeof option.underlying_price === 'number' ? option.underlying_price.toFixed(2) : 'N/A'}</td>
                    <td>N/A</td> <!-- Strategy -->
                    <td>N/A</td> <!-- Leg Type -->
                    <td>$${option.current_premium.toFixed(2)}</td>
                    <td class="${pnlClass}">$${option.pnl_dollar.toFixed(2)}</td>
                    <td class="${pnlClass}">${option.pnl_percent.toFixed(2)}%</td>
                `;
                dashboardTableBody.appendChild(row);
            } else if (item.type === 'strategy') { // Render multi-leg strategies as daisyUI 5 collapse/accordion
                const strategy = item.data;
                const dteClass = strategy.strategy_dte < 3 ? 'dte-red' : (strategy.strategy_dte < 7 ? 'dte-yellow' : '');
                const pnlClass = strategy.overall_pnl_dollar < 0 ? 'text-error' : 'text-success';
                const rowClass = strategy.strategy_is_itm ? 'itm-alert' : '';

                const strategyRow = document.createElement('tr');
                strategyRow.classList.add(rowClass);
                strategyRow.innerHTML = `
                    <td colspan="15" class="p-0"> <!-- colspan to span entire table width -->
                        <div class="collapse collapse-arrow bg-base-200 border border-base-content/10">
                            <input type="checkbox" class="peer" />
                            <div class="collapse-title text-xl font-medium flex items-center">
                                <span class="flex-1">
                                    <span class="font-bold text-lg">${strategy.ticker}</span> - ${strategy.strategy_name} (${strategy.status})
                                </span>
                                <span class="text-sm mr-4">DTE: <span class="${dteClass}">${strategy.strategy_dte}</span></span>
                                <span class="text-sm mr-4">P&L: <span class="${pnlClass}">$${strategy.overall_pnl_dollar.toFixed(2)} (${strategy.overall_pnl_percent.toFixed(2)}%)</span></span>
                            </div>
                            <div class="collapse-content">
                                <div class="overflow-x-auto mt-2">
                                    <table class="table table-xs w-full table-zebra">
                                        <thead>
                                            <tr>
                                                <th></th> <!-- Indent column -->
                                                <th>Broker</th>
                                                <th>Type</th>
                                                <th>Strike</th>
                                                <th>Exp. Date</th>
                                                <th>DTE</th>
                                                <th>Contracts</th>
                                                <th>Premium</th>
                                                <th>Status</th>
                                                <th>Underlying Price</th>
                                                <th>Leg Type</th>
                                                <th>Current Premium</th>
                                                <th>Unrealized P&L ($)</th>
                                                <th>Unrealized P&L (%)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${strategy.legs.map(leg => {
                                                const legDteClass = leg.dte < 3 ? 'dte-red' : (leg.dte < 7 ? 'dte-yellow' : '');
                                                const legPnlClass = leg.pnl_dollar < 0 ? 'text-error' : 'text-success';
                                                const legRowClass = leg.is_itm ? 'itm-alert' : '';
                                                return `
                                                    <tr class="${legRowClass}">
                                                        <td></td> <!-- Indent -->
                                                        <td><span class="badge" style="background-color:${leg.broker_color};">${leg.broker_name}</span></td>
                                                        <td>${leg.type} ${leg.contract_type}</td>
                                                        <td>$${leg.strike_price.toFixed(2)}</td>
                                                        <td>${leg.expiration_date}</td>
                                                        <td class="${legDteClass}">${leg.dte}</td>
                                                        <td>${leg.contracts}</td>
                                                        <td>$${leg.premium.toFixed(2)}</td>
                                                        <td>${leg.status}</td>
                                                        <td>$${typeof leg.underlying_price === 'number' ? leg.underlying_price.toFixed(2) : 'N/A'}</td>
                                                        <td>${leg.leg_type}</td>
                                                        <td>$${leg.current_premium.toFixed(2)}</td>
                                                        <td class="${legPnlClass}">$${leg.pnl_dollar.toFixed(2)}</td>
                                                        <td class="${legPnlClass}">${leg.pnl_percent.toFixed(2)}%</td>
                                                    </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </td>
                `;
                dashboardTableBody.appendChild(strategyRow);
            }
        });
    };

    // Fetch market data and update UI
    const fetchMarketData = async () => {
        const uniqueTickers = [...new Set(currentOptionsData.map(option => option.cycle_ticker))];
        if (uniqueTickers.length === 0) {
            renderTable([]); // Render empty if no data
            return;
        }

        try {
            const response = await fetch(`/api/market_data.php?tickers=${uniqueTickers.join(',')}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const marketData = await response.json();
            console.log('Fetched market data:', marketData);

            // Process, sort, and render
            const combinedList = processOptionsData(currentOptionsData, marketData);
            const sortedList = sortCombinedList(combinedList);
            renderTable(sortedList);

        } catch (error) {
            console.error('Error fetching market data:', error);
            // Fallback: process and render with existing data if API fails (P&L will be based on original premium)
            const combinedList = processOptionsData(currentOptionsData, {}); // Pass empty marketData
            const sortedList = sortCombinedList(combinedList);
            renderTable(sortedList);
        }
    };

    // Initial fetch and render
    fetchMarketData();

    // Refresh market data every 30 seconds (example)
    // setInterval(fetchMarketData, 30000); 
});
