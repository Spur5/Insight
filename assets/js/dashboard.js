document.addEventListener('DOMContentLoaded', () => {
    const dashboardTableBody = document.getElementById('dashboard-table-body');
    let currentOptionsData = initialOptionsData || []; // Use initial data from PHP
    let currentSortKey = 'default';
    let currentSortDir = 'asc';
    let lastMarketData = {};

    // Data Constants & Label Mapping Lookups
    // Data Constants & Label Mapping Lookups
    const LABEL_MAP = {
        'SELL_TO_OPEN': 'Short Entry',
        'BUY_TO_OPEN': 'Long Entry',
        'BUY_TO_CLOSE': 'Closed Out',
        'SELL_TO_CLOSE': 'Closed Out',
        'CALL': 'Call',
        'PUT': 'Put',
        'OPEN': 'Open',
        'FILLED': 'Filled',
        'ASSIGNED': 'Assigned',
        'EXPIRED': 'Expired',
        'CLOSED': 'Closed',
        'SHORT_CALL': 'S-Call',
        'SHORT_PUT': 'S-Put',
        'LONG_CALL': 'L-Call',
        'LONG_PUT': 'L-Put'
    };

    const getComputedLegRole = (type, contractType) => {
        if (type === 'SELL_TO_OPEN' || type === 'BUY_TO_CLOSE') {
            return `SHORT_${contractType}`; // e.g. SHORT_CALL, SHORT_PUT
        } else {
            return `LONG_${contractType}`;  // e.g. LONG_CALL, LONG_PUT
        }
    };

    const getActionBadge = (type) => {
        switch(type) {
            case 'SELL_TO_OPEN': return '<span class="text-error ">Short</span>';
            case 'BUY_TO_OPEN': return '<span class="text-success">Long</span>';
            case 'BUY_TO_CLOSE': 
            case 'SELL_TO_CLOSE': return '<span class="text-base-content/50">Closed Out</span>';
            default: return `${type}`;
        }
    };

    // Function to format date to 'd M y' (e.g., 26 May 24)
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const [year, month, day] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
    };

    // Function to calculate Days To Expiration (DTE)
    const calculateDTE = (expirationDateStr) => { // Strict Logic Constraint 1
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        // Parse components manually to ensure local timezone consistency
        const [y, m, d] = expirationDateStr.split('-').map(Number);
        const expirationDate = new Date(y, m - 1, d);
        expirationDate.setHours(0, 0, 0, 0); // Normalize to start of day
        const diffTime = expirationDate.getTime() - today.getTime();
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // If expiration is today (diffDays is 0), set DTE to 1, otherwise use calculated diffDays.
        // DTE cannot be negative.
        if (diffDays === 0 && expirationDate.getTime() >= today.getTime()) {
            return 1;
        }
        return Math.max(0, diffDays);
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
            option.strike_price = parseFloat(option.strike_price); // Ensure strike_price is a number
            option.premium = parseFloat(option.premium);           // Ensure premium is a number
            option.contracts = parseInt(option.contracts, 10);     // Ensure contracts is an integer
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
                underlying_price: underlyingPrice,
                leg_role: getComputedLegRole(option.type, option.contract_type)
            };

            if (option.option_strategy_id !== null) { // Group by strategy ID
                if (!strategies[option.option_strategy_id]) {
                    strategies[option.option_strategy_id] = {
                        id: option.option_strategy_id,
                        ticker: option.cycle_ticker, // Use cycle_ticker as strategy ticker
                        strategy_name: option.strategy_name,
                        status: option.strategy_status,
                        legs: [],
                        min_expiration: option.expiration_date,
                        // Aggregate metrics, to be calculated below
                        overall_pnl_dollar: 0,
                        overall_pnl_percent: 0,
                        overall_current_premium: 0,
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
            let overallCurrentPremium = 0;
            let strategyMinDTE = Infinity;
            let strategyHasITMLeg = false;
            let totalOriginalPremiumForPnl = 0; // For P&L % calculation
            let minExpDate = strategy.legs[0].expiration_date;

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

                // Accumulate total current dollar value for the complex
                overallCurrentPremium += legCurrentPremiumTotal;

                // Update strategy DTE (minimum of all legs)
                if (leg.dte < strategyMinDTE) {
                    strategyMinDTE = leg.dte;
                }

                // Check if any short leg is ITM
                if (leg.is_itm) {
                    strategyHasITMLeg = true;
                }

                // Track earliest expiration
                if (new Date(leg.expiration_date) < new Date(minExpDate)) {
                    minExpDate = leg.expiration_date;
                }
            });

            strategy.overall_pnl_dollar = overallPnLDollar;
            strategy.overall_pnl_percent = totalOriginalPremiumForPnl !== 0 ? (overallPnLDollar / totalOriginalPremiumForPnl) * 100 : 0;
            strategy.overall_current_premium = overallCurrentPremium;
            strategy.strategy_dte = strategyMinDTE;
            strategy.strategy_is_itm = strategyHasITMLeg;
            strategy.total_original_premium_for_pnl = totalOriginalPremiumForPnl; // Store for potential display or further calculations
            strategy.min_expiration = minExpDate;

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

            if (currentSortKey === 'default') {
                // Default Heatmap Sorting (ITM -> DTE -> Ticker)
                const aIsITM = a.type === 'option' ? aData.is_itm : aData.strategy_is_itm;
                const bIsITM = b.type === 'option' ? bData.is_itm : bData.strategy_is_itm;
                const aDTE = a.type === 'option' ? aData.dte : aData.strategy_dte;
                const bDTE = b.type === 'option' ? bData.dte : bData.strategy_dte;
                const aTicker = aData.ticker || aData.cycle_ticker;
                const bTicker = bData.ticker || bData.cycle_ticker;

                if (aIsITM && !bIsITM) return -1;
                if (!aIsITM && bIsITM) return 1;
                if (aDTE !== bDTE) return aDTE - bDTE;
                return aTicker.localeCompare(bTicker);
            }

            let valA, valB;
            if (currentSortKey === 'ticker') {
                valA = aData.ticker || aData.cycle_ticker;
                valB = bData.ticker || bData.cycle_ticker;
            } else if (currentSortKey === 'expiration') {
                valA = a.type === 'option' ? aData.expiration_date : aData.min_expiration;
                valB = b.type === 'option' ? bData.expiration_date : bData.min_expiration;
            } else if (currentSortKey === 'pnl') {
                valA = a.type === 'option' ? aData.pnl_dollar : aData.overall_pnl_dollar;
                valB = b.type === 'option' ? bData.pnl_dollar : bData.overall_pnl_dollar;
            }

            let result = 0;
            if (typeof valA === 'string') {
                result = valA.localeCompare(valB);
            } else {
                result = (valA || 0) - (valB || 0);
            }
            return currentSortDir === 'asc' ? result : -result;
        });
        return combinedList;
    };

    // Strict Logic Constraint 4: Function to render/re-render the table with Persistent Symmetrical Grouping
    const renderTable = (combinedList) => {
        dashboardTableBody.innerHTML = ''; // Clear existing rows

        combinedList.forEach(item => {
            if (item.type === 'option') { // Render standalone options as standard <tr> rows
                const option = item.data;
                const dteClass = option.dte < 3 ? 'dte-red' : (option.dte < 7 ? 'dte-yellow' : '');
                const pnlClass = option.pnl_dollar < 0 ? 'text-error' : 'text-success';
                const rowClass = option.is_itm ? 'itm-alert' : '';

                const row = document.createElement('tr');
                if (rowClass) row.classList.add(rowClass);
                
                row.innerHTML = `
                    <td class="text-center">${option.cycle_ticker}</td>
                    <td class="text-center">${getActionBadge(option.type)} ${LABEL_MAP[option.contract_type] || option.contract_type}</td>
                    <td class="text-center">${option.contracts}</td>
                    <td class="text-center">$${option.strike_price.toFixed(2)}</td>
                    <td class="text-center">${formatDate(option.expiration_date)}</td>
                    <td class="text-center ${dteClass}">${option.dte}</td>
                    <td class="text-center">${option.broker_name}</td>
                    <td class="text-center">$${option.premium.toFixed(2)}</td>
                    <td class="text-center">$${option.current_premium.toFixed(2)}</td>
                    <td class="text-center font-bold uppercase tracking-tighter">${LABEL_MAP[option.option_status] || option.option_status}</td>
                    <td class="text-center">$${typeof option.underlying_price === 'number' ? option.underlying_price.toFixed(2) : 'N/A'}</td>
                    <td class="text-center ${pnlClass}">$${option.pnl_dollar.toFixed(2)}</td>
                    <td class="text-center ${pnlClass}">${option.pnl_percent.toFixed(2)}%</td>
                    <td class="text-left"><div class="flex gap-1 justify-start"><button class="btn btn-xs btn-outline btn-success action-close" data-id="${option.option_id}">Close</button><button class="btn btn-xs btn-outline btn-info action-expire" data-id="${option.option_id}">Expire</button>${option.type === 'SELL_TO_OPEN' ? `<button class="btn btn-xs btn-outline btn-warning action-assign" data-id="${option.option_id}" data-broker="${option.broker_id}">Assign</button>` : ''}</div></td>
                `;
                dashboardTableBody.appendChild(row);
            } else if (item.type === 'strategy') { 
                const strategy = item.data;
                const dteClass = strategy.strategy_dte < 3 ? 'dte-red' : (strategy.strategy_dte < 7 ? 'dte-yellow' : '');
                const pnlClass = strategy.overall_pnl_dollar < 0 ? 'text-error' : 'text-success';
                const rowClass = strategy.strategy_is_itm ? 'itm-alert' : '';

                // --- Step 2: The Group Header Row ---
                const masterRow = document.createElement('tr');
                masterRow.className = `bg-base-300/80 font-bold text-base text-base-content ${rowClass}`;
                masterRow.innerHTML = `
                    <td class="text-center border-l-4 border-primary">${strategy.ticker}</td>
                    <td class="text-center font-black uppercase text-primary">${strategy.strategy_name}</td>
                    <td class="text-center">${strategy.legs[0].contracts}</td>
                    <td class="text-center">—</td>
                    <td class="text-center">${formatDate(strategy.min_expiration)}</td>
                    <td class="text-center ${dteClass}">${strategy.strategy_dte}</td>
                    <td class="text-center">${strategy.legs[0].broker_name}</td>
                    <td class="text-center">$${(strategy.total_original_premium_for_pnl / 100).toFixed(2)}</td>
                    <td class="text-center">$${(strategy.overall_current_premium / 100).toFixed(2)}</td>
                    <td class="text-center font-bold uppercase tracking-tighter">${LABEL_MAP[strategy.status] || strategy.status}</td>
                    <td class="text-center">—</td>
                    <td class="text-center ${pnlClass}">$${strategy.overall_pnl_dollar.toFixed(2)}</td>
                    <td class="text-center ${pnlClass}">${strategy.overall_pnl_percent.toFixed(2)}%</td>
                    <td class="text-center"></td>
                `;
                dashboardTableBody.appendChild(masterRow);

                // --- Step 2: The Connected Leg Rows ---
                strategy.legs.forEach(leg => {
                    const legDteClass = leg.dte < 3 ? 'dte-red' : (leg.dte < 7 ? 'dte-yellow' : '');
                    const legPnlClass = leg.pnl_dollar < 0 ? 'text-error' : 'text-success';
                    const legRowClass = leg.is_itm ? 'itm-alert' : '';
                    
                    const legRow = document.createElement('tr');
                    legRow.className = `bg-base-200/40 text-base-content/80 text-base ${legRowClass}`;
                    
                    legRow.innerHTML = `
                        <td class="text-center pl-4 border-l-4 border-primary/30">└─ </td>
                        <td class="text-center">${getActionBadge(leg.type)} ${LABEL_MAP[leg.contract_type] || leg.contract_type}</td>
                        <td class="text-center">${leg.contracts}</td>
                        <td class="text-center">$${leg.strike_price.toFixed(2)}</td>
                        <td class="text-center">${formatDate(leg.expiration_date)}</td>
                        <td class="text-center ${legDteClass}">${leg.dte}</td>
                        <td class="text-center"></td>
                        <td class="text-center">$${leg.premium.toFixed(2)}</td>
                        <td class="text-center">$${leg.current_premium.toFixed(2)}</td>
                        <td class="text-center font-bold uppercase tracking-tighter">${LABEL_MAP[leg.option_status] || leg.option_status}</td>
                        <td class="text-center">$${typeof leg.underlying_price === 'number' ? leg.underlying_price.toFixed(2) : 'N/A'}</td>
                        <td class="text-center ${legPnlClass}">$${leg.pnl_dollar.toFixed(2)}</td>
                        <td class="text-center ${legPnlClass}">${leg.pnl_percent.toFixed(2)}%</td>
                        <td class="text-left">
                            <div class="flex gap-1 justify-start">
                                <button class="btn btn-xs btn-outline btn-success action-close" data-id="${leg.option_id}">Close</button>
                                <button class="btn btn-xs btn-outline btn-info action-expire" data-id="${leg.option_id}">Expire</button>
                                ${leg.type === 'SELL_TO_OPEN' ? `<button class="btn btn-xs btn-outline btn-warning action-assign" data-id="${leg.option_id}" data-broker="${leg.broker_id}">Assign</button>` : ''}
                            </div>
                        </td>
                    `;
                    dashboardTableBody.appendChild(legRow);
                });
            }
        });
    };

    // Function to handle action button clicks
    const handleAction = async (optionId, action) => {
        let exitPremium = null;
        if (action === 'CLOSE') {
            const premiumInput = prompt('Enter exit premium (e.g., 0.50 for $50):');
            if (premiumInput === null || premiumInput.trim() === '') {
                alert('Close action cancelled. Exit premium is required.');
                return;
            }
            exitPremium = parseFloat(premiumInput);
            if (isNaN(exitPremium)) {
                alert('Invalid exit premium. Please enter a number.');
                return;
            }
        }

        const payload = {
            option_id: optionId,
            action: action,
            exit_premium: exitPremium
        };

        try {
            const response = await fetch('/api/update_leg_status.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                // Re-fetch and re-render dashboard data
                await fetchMarketData();
            } else {
                alert(`Error: ${result.message}`);
            }
        } catch (error) {
            console.error('Error updating option status:', error);
            alert('An error occurred while updating option status.');
        }
    };

    // --- Step 2: Initialize Interactive Sorting Listeners ---
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const key = header.dataset.sortKey;
            if (currentSortKey === key) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortKey = key;
                currentSortDir = 'asc';
            }

            // Update Indicators
            document.querySelectorAll('.sort-indicator').forEach(span => {
                span.textContent = '↕';
                span.className = 'sort-indicator text-xs text-base-content/30';
            });
            const indicator = header.querySelector('.sort-indicator');
            indicator.textContent = currentSortDir === 'asc' ? '↑' : '↓';
            indicator.className = 'sort-indicator text-xs text-primary font-bold';

            // Re-sort and Render
            const combinedList = processOptionsData(currentOptionsData, lastMarketData);
            const sortedList = sortCombinedList(combinedList);
            renderTable(sortedList);
        });
    });

    // --- Step 3: Re-Bind Interactive Inline Listeners ---
    dashboardTableBody.addEventListener('click', (event) => {
        const target = event.target;

        const optionId = parseInt(target.dataset.id, 10);
        if (target.classList.contains('action-close')) {
            handleAction(optionId, 'CLOSE');
        } else if (target.classList.contains('action-expire')) {
            handleAction(optionId, 'EXPIRE');
        } else if (target.classList.contains('action-assign')) {
            handleAction(optionId, 'ASSIGN');
        }
    });

    // Fetch market data and update UI
    const fetchMarketData = async () => {
        // First, fetch the latest options data from the server
        let latestOptionsData = [];
        try {
            const optionsResponse = await fetch('/api/get_dashboard_data.php?_t=' + new Date().getTime()); // Add cache-buster
            latestOptionsData = await optionsResponse.json();
            currentOptionsData = latestOptionsData; // Update the global currentOptionsData
        } catch (error) {
            console.error('Error fetching latest options data:', error);
            // Continue with potentially stale data or empty if initial fetch failed
        }

        const uniqueTickers = [...new Set(currentOptionsData.map(option => option.cycle_ticker))];
        if (uniqueTickers.length === 0) {
            renderTable([]); // Render empty if no data
            return;
        }

        try {
            const response = await fetch(`/api/market_data.php?tickers=${uniqueTickers.join(',')}&_t=${new Date().getTime()}`); // Add cache-buster
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            lastMarketData = await response.json();
            console.log('Fetched market data:', lastMarketData);

            // Process, sort, and render
            const combinedList = processOptionsData(currentOptionsData, lastMarketData);
            const sortedList = sortCombinedList(combinedList);
            renderTable(sortedList);

        } catch (error) {
            console.error('Error fetching market data:', error);
            lastMarketData = {};
            // Fallback: process and render with existing data if API fails (P&L will be based on original premium)
            const combinedList = processOptionsData(currentOptionsData, lastMarketData); 
            const sortedList = sortCombinedList(combinedList);
            renderTable(sortedList);
        }
    };

    // Initial fetch and render
    fetchMarketData();
});
