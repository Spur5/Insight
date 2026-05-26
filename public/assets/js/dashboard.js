// /var/www/html/@public/assets/js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const dashboardTableBody = document.getElementById('dashboard-table-body');
    let currentOptionsData = initialOptionsData || []; // Use initial data from PHP

    // Function to calculate Days To Expiration (DTE)
    const calculateDTE = (expirationDateStr) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day
        const expirationDate = new Date(expirationDateStr);
        expirationDate.setHours(0, 0, 0, 0); // Normalize to start of day
        const diffTime = expirationDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    // Function to determine if a short option is In The Money (ITM)
    const isShortOptionITM = (option, underlyingPrice) => {
        if (option.type === 'SELL_TO_OPEN' && option.status === 'FILLED') {
            if (option.contract_type === 'CALL' && underlyingPrice > option.strike_price) {
                return true;
            }
            if (option.contract_type === 'PUT' && underlyingPrice < option.strike_price) {
                return true;
            }
        }
        return false;
    };

    // Function to calculate unrealized P&L
    const calculateUnrealizedPnL = (option, marketData) => {
        if (!marketData || !marketData.underlying_price || !marketData.options) {
            return { pnl_dollar: 0, pnl_percent: 0, current_premium: option.premium };
        }

        const underlyingPrice = marketData.underlying_price;
        let currentOptionPremium = 0;

        // Find the current premium for this specific option (strike, type)
        const matchingMarketOption = marketData.options.find(
            (mo) => mo.strike_price === option.strike_price
        );

        if (matchingMarketOption) {
            currentOptionPremium = (option.contract_type === 'CALL')
                ? matchingMarketOption.call_premium
                : matchingMarketOption.put_premium;
        } else {
            // Fallback: if no exact match, use the original premium or a dummy value
            currentOptionPremium = option.premium;
        }

        const contracts = option.contracts;
        const originalPremiumTotal = option.premium * contracts * 100;
        const currentPremiumTotal = currentOptionPremium * contracts * 100;

        let pnl_dollar = 0;
        if (option.type === 'SELL_TO_OPEN') {
            // For short options, we want current premium to be lower than original
            pnl_dollar = originalPremiumTotal - currentPremiumTotal;
        } else if (option.type === 'BUY_TO_OPEN') {
            // For long options, we want current premium to be higher than original
            pnl_dollar = currentPremiumTotal - originalPremiumTotal;
        }

        const pnl_percent = originalPremiumTotal !== 0 ? (pnl_dollar / originalPremiumTotal) * 100 : 0;

        return {
            pnl_dollar: pnl_dollar,
            pnl_percent: pnl_percent,
            current_premium: currentOptionPremium
        };
    };

    // Function to render/re-render the table
    const renderTable = (optionsToRender, marketData = {}) => {
        dashboardTableBody.innerHTML = ''; // Clear existing rows

        optionsToRender.forEach(option => {
            const dte = calculateDTE(option.expiration_date);
            const tickerMarketData = marketData[option.cycle_ticker] || {};
            const { pnl_dollar, pnl_percent, current_premium } = calculateUnrealizedPnL(option, tickerMarketData);
            const underlyingPrice = tickerMarketData.underlying_price || 'N/A';

            const isITM = isShortOptionITM(option, tickerMarketData.underlying_price);

            let dteClass = '';
            if (dte < 3) {
                dteClass = 'dte-red';
            } else if (dte < 7) {
                dteClass = 'dte-yellow';
            }

            const row = document.createElement('tr');
            row.dataset.ticker = option.cycle_ticker;
            row.dataset.dte = dte;
            row.dataset.isItm = isITM ? 'true' : 'false';
            row.dataset.pnlDollar = pnl_dollar; // Store for sorting if needed

            row.innerHTML = `
                <td>${option.cycle_ticker}</td>
                <td><span class="badge" style="background-color:${option.broker_color};">${option.broker_name}</span></td>
                <td>${option.type} ${option.contract_type}</td>
                <td>$${option.strike_price.toFixed(2)}</td>
                <td>${option.expiration_date}</td>
                <td class="${dteClass}">${dte}</td>
                <td>${option.contracts}</td>
                <td>$${option.premium.toFixed(2)}</td>
                <td>${option.status}</td>
                <td>$${typeof underlyingPrice === 'number' ? underlyingPrice.toFixed(2) : underlyingPrice}</td>
                <td>$${current_premium.toFixed(2)}</td>
                <td class="${pnl_dollar < 0 ? 'text-error' : 'text-success'}">$${pnl_dollar.toFixed(2)}</td>
                <td class="${pnl_percent < 0 ? 'text-error' : 'text-success'}">${pnl_percent.toFixed(2)}%</td>
            `;

            if (isITM) {
                row.classList.add('itm-alert');
            }

            dashboardTableBody.appendChild(row);
        });
    };

    // Client-side sorting logic
    const sortTable = (optionsData, marketData) => {
        // First, update P&L and ITM status based on latest market data
        const updatedOptions = optionsData.map(option => {
            const tickerMarketData = marketData[option.cycle_ticker] || {};
            const { pnl_dollar, pnl_percent, current_premium } = calculateUnrealizedPnL(option, tickerMarketData);
            const dte = calculateDTE(option.expiration_date);
            const isITM = isShortOptionITM(option, tickerMarketData.underlying_price);

            return {
                ...option,
                dte: dte,
                is_itm: isITM,
                pnl_dollar: pnl_dollar,
                pnl_percent: pnl_percent,
                current_premium: current_premium,
                underlying_price: tickerMarketData.underlying_price || null
            };
        });

        updatedOptions.sort((a, b) => {
            // 1. Short ITM Alert Items (Breached Short Options)
            if (a.is_itm && !b.is_itm) return -1;
            if (!a.is_itm && b.is_itm) return 1;

            // 2. Lowest Days to Expiration (DTE Heatmap)
            if (a.dte !== b.dte) return a.dte - b.dte;

            // 3. Ticker Alphabetical
            return a.cycle_ticker.localeCompare(b.cycle_ticker);
        });

        renderTable(updatedOptions, marketData);
    };

    // Fetch market data and update UI
    const fetchMarketData = async () => {
        const uniqueTickers = [...new Set(currentOptionsData.map(option => option.cycle_ticker))];
        if (uniqueTickers.length === 0) {
            renderTable(currentOptionsData); // Render with initial data if no tickers
            return;
        }

        try {
            const response = await fetch(`/api/market_data.php?tickers=${uniqueTickers.join(',')}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const marketData = await response.json();
            console.log('Fetched market data:', marketData);
            sortTable(currentOptionsData, marketData); // Sort and render with live data
        } catch (error) {
            console.error('Error fetching market data:', error);
            // Fallback: render with existing data if API fails
            renderTable(currentOptionsData);
        }
    };

    // Initial render and fetch
    renderTable(currentOptionsData); // Render immediately with initial data
    fetchMarketData(); // Then fetch live data

    // Refresh market data every 30 seconds (example)
    // setInterval(fetchMarketData, 30000);
});
