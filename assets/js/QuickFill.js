document.addEventListener('DOMContentLoaded', () => {
    const quickFillModal = document.getElementById('quick_fill_modal');
    const quickFillForm = document.getElementById('quick_fill_form');
    // Ensure the button is correctly referenced
    const btnQuickFillEntry = document.getElementById('btn_quick_fill_entry'); // Get the new button
    const modeSingleToggle = document.getElementById('mode_single_toggle');
    const modeStrategyToggle = document.getElementById('mode_strategy_toggle');
    const singleLegFieldsContainer = document.getElementById('single_leg_fields_container');
    const strategyLegsFieldsContainer = document.getElementById('strategy_legs_fields_container');
    const strategyTypeContainer = document.getElementById('strategy_type_container');
    const btnAddLegRow = document.getElementById('btn_add_leg_row');
    const legsWrapper = document.getElementById('legs_wrapper');
    const btnSubmitEntry = document.getElementById('btn_submit_entry');

    // Global fields
    const globalTicker = document.getElementById('global_ticker');
    const globalBroker = document.getElementById('global_broker');
    const strategyNameSelect = document.getElementById('strategy_name');

    // Single leg fields
    const singleType = document.getElementById('single_type');
    const singleContractType = document.getElementById('single_contract_type');
    const singleStrike = document.getElementById('single_strike');
    const singleExpiration = document.getElementById('single_expiration');
    const singleContracts = document.getElementById('single_contracts');
    const singlePremium = document.getElementById('single_premium');
    const singleWheelId = document.getElementById('single_wheel_id');

    let legCounter = 0; // To ensure unique IDs for strategy legs

    // --- Helper Functions ---

    function showNotification(message, type = 'info') {
        // A simple alert for now. In a real app, use a toast notification library.
        alert(`${type.toUpperCase()}: ${message}`);
    }

    /**
     * Calculates the date of the next Friday, or today if today is Friday.
     * @returns {string} The date in YYYY-MM-DD format.
     */
    function getNextFriday() {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday

        let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        if (dayOfWeek === 5) daysUntilFriday = 0; // If today is Friday, use today

        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + daysUntilFriday);

        return `${nextFriday.getFullYear()}-${String(nextFriday.getMonth() + 1).padStart(2, '0')}-${String(nextFriday.getDate()).padStart(2, '0')}`;
    }

    window.resetForm = function() { // Make resetForm globally accessible
        quickFillForm.reset(); // Resets all form fields to their initial values
        legsWrapper.innerHTML = ''; // Clear dynamic legs
        legCounter = 0;
        // Ensure default mode is selected
        modeSingleToggle.checked = true;
        toggleFormMode();
        // Close the modal
        quickFillModal.close();
    }

    function getLegData(legElement, isStrategyLeg = false) {
        const prefix = isStrategyLeg ? `leg_${legElement.dataset.legIndex}_` : 'single_';
        const legData = {
            type: legElement.querySelector(`#${prefix}type`).value,
            contract_type: legElement.querySelector(`#${prefix}contract_type`).value,
            strike_price: parseFloat(legElement.querySelector(`#${prefix}strike`).value),
            expiration_date: legElement.querySelector(`#${prefix}expiration`).value,
            contracts: parseInt(legElement.querySelector(`#${prefix}contracts`).value, 10) || 1, // Ensure contracts is a number, default to 1 if empty
            premium: parseFloat(legElement.querySelector(`#${prefix}premium`).value),
            status: 'FILLED', // Hardcode status to 'FILLED'
            leg_type: legElement.querySelector(`#${prefix}leg_type`) ? legElement.querySelector(`#${prefix}leg_type`).value : null, // Only for strategy legs
            wheel_cycle_id: legElement.querySelector(`#${prefix}wheel_id`) ? parseInt(legElement.querySelector(`#${prefix}wheel_id`).value, 10) || null : null // Only for single leg
        };

        // Basic validation for numbers
        if (isNaN(legData.strike_price) || isNaN(legData.contracts) || isNaN(legData.premium)) {
            throw new Error("Invalid number input for strike, contracts, or premium.");
        }
        if (legData.contracts <= 0) {
            throw new Error("Contracts must be a positive number.");
        }
        if (!legData.expiration_date) {
            throw new Error("Expiration date is required.");
        }

        return legData;
    }

    // --- Form Mode Toggling ---

    function toggleFormMode() {
        const isSingleMode = modeSingleToggle.checked;

        if (isSingleMode) {
            singleLegFieldsContainer.classList.remove('hidden');
            singleLegFieldsContainer.classList.add('block');
            strategyLegsFieldsContainer.classList.remove('block');
            strategyLegsFieldsContainer.classList.add('hidden');
            strategyTypeContainer.classList.add('hidden'); // Ensure hidden for single mode
            strategyTypeContainer.classList.remove('grid'); // Remove grid for strategy type
            strategyTypeContainer.classList.add('hidden');

            // Set required attributes for single leg
            singleType.setAttribute('required', 'true');
            singleContractType.setAttribute('required', 'true');
            singleStrike.setAttribute('required', 'true');
            singleExpiration.setAttribute('required', 'true');
            singlePremium.setAttribute('required', 'true');
            singleExpiration.value = getNextFriday(); // Set default expiration date
            // Remove required for strategy name
            strategyNameSelect.removeAttribute('required');

        } else { // Strategy Complex mode
            singleLegFieldsContainer.classList.remove('block');
            singleLegFieldsContainer.classList.add('hidden');
            strategyLegsFieldsContainer.classList.remove('hidden');
            strategyTypeContainer.classList.remove('hidden'); // Ensure visible for strategy mode
            strategyLegsFieldsContainer.classList.add('block');
            strategyTypeContainer.classList.remove('hidden');
            strategyTypeContainer.classList.add('grid'); // Add grid for strategy type

            // Ensure at least one leg is present for strategy
            if (legsWrapper.children.length === 0) {
                addLegRow();
            }

            // Remove required attributes for single leg
            singleType.removeAttribute('required');
singleContractType.removeAttribute('required');
singleStrike.removeAttribute('required');
singleExpiration.removeAttribute('required');
singlePremium.removeAttribute('required');
            // Set required for strategy name
            strategyNameSelect.setAttribute('required', 'true');
        }
        // Global fields are always required
        globalTicker.setAttribute('required', 'true');
        globalBroker.setAttribute('required', 'true');
    }

    // --- Strategy Leg Management ---

    function createLegRowHtml(index) {
        let defaultLegTypeOptions = `
            <option value="LONG_CALL">LONG_CALL</option>
            <option value="SHORT_CALL">SHORT_CALL</option>
            <option value="LONG_PUT">LONG_PUT</option>
            <option value="SHORT_PUT">SHORT_PUT</option>
        `;

        return `
            <div class="grid grid-cols-5 gap-2 bg-base-200 p-4 rounded-xl relative" data-leg-index="${index}">
                <button type="button" class="btn btn-xs btn-circle btn-error absolute top-2 right-2 remove-leg-btn">✕</button>
                <div>
                    <label class="label text-xs">Action Type</label>
                    <select id="leg_${index}_type" class="select select-sm w-full" required>
                        <option value="SELL_TO_OPEN">SELL_TO_OPEN</option>
                        <option value="BUY_TO_OPEN">BUY_TO_OPEN</option>
                        <option value="BUY_TO_CLOSE">BUY_TO_CLOSE</option>
                        <option value="SELL_TO_CLOSE">SELL_TO_CLOSE</option>
                    </select>
                </div>
                <div>
                    <label class="label text-xs">Contracts</label>
                    <input type="number" id="leg_${index}_contracts" class="input input-sm w-full" placeholder="1" />
                </div>
                <div>
                    <label class="label text-xs">Contract Type</label>
                    <select id="leg_${index}_contract_type" class="select select-sm w-full" required>
                        <option value="PUT">PUT</option>
                        <option value="CALL">CALL</option>
                    </select>
                </div>
                <div>
                    <label class="label text-xs">Expiration Date</label>
                    <input type="date" id="leg_${index}_expiration" class="input input-sm w-full" value="${getNextFriday()}" required />
                </div>
                <div>
                    <label class="label text-xs">Strike Price</label>
                    <input type="number" step="0.01" id="leg_${index}_strike" class="input input-sm w-full" placeholder="0.00" required />
                </div>
                <div>
                    <label class="label text-xs">Premium per Contract</label>
                    <input type="number" step="0.01" id="leg_${index}_premium" class="input input-sm w-full" placeholder="0.00" required />
                </div>
                <div>
                    <label class="label text-xs">Leg Type</label>
                    <select id="leg_${index}_leg_type" class="select select-sm w-full" required>
                        ${defaultLegTypeOptions}
                    </select>
                </div>
            </div>
        `;
    }

    function addLegRow() {
        legCounter++;
        const newLegDiv = document.createElement('div');
        newLegDiv.innerHTML = createLegRowHtml(legCounter);
        legsWrapper.appendChild(newLegDiv.firstElementChild); // Append the div itself, not its wrapper
    }

    // --- Event Listeners ---

    modeSingleToggle.addEventListener('change', toggleFormMode);
    modeStrategyToggle.addEventListener('change', toggleFormMode);

    btnAddLegRow.addEventListener('click', addLegRow);

    legsWrapper.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-leg-btn')) {
            event.target.closest('.grid').remove();
            // If all legs are removed, add one back to prevent empty strategy
            if (legsWrapper.children.length === 0) {
                addLegRow();
            }
        }
    });

    quickFillForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Basic global validation
        if (!globalTicker.value || !globalBroker.value) {
            showNotification('Please fill in Ticker Symbol and Broker Account.', 'error');
            return;
        }

        const brokerName = globalBroker.value;
        const ticker = globalTicker.value.toUpperCase(); // Standardize ticker

        let payload = {};
        let apiUrl = '';

        // Map strategy name from UI to DB ENUM
        const strategyNameMap = {
            "VERTICAL_SPREAD": "Vertical Spread",
            "IRON_CONDOR": "Iron Condor",
            "STRANGLE": "Strangle",
            "STRADDLE": "Straddle",
            "CUSTOM": "Other" // Assuming 'CUSTOM' maps to 'Other' in the DB ENUM
        };

        try {
            if (modeSingleToggle.checked) {
                // Single Leg / Wheel Mode
                const legData = getLegData(singleLegFieldsContainer);
                apiUrl = '/api/log_transaction.php';
                payload = {
                    type: legData.type,
                    broker_name: brokerName,
                    ticker: ticker,
                    contract_type: legData.contract_type,
                    strike_price: legData.strike_price,
                    expiration_date: legData.expiration_date,
                    contracts: legData.contracts,
                    premium: legData.premium,
                    status: legData.status,
                    wheel_cycle_id: legData.wheel_cycle_id
                };
                // If it's a new cycle and assigned shares are needed, add them
                if (legData.wheel_cycle_id === null && legData.status === 'ASSIGNED' && legData.type === 'SELL_TO_OPEN' && legData.contract_type === 'CALL') {
                    // This is a simplified assumption. In a real app, you'd have a dedicated field for assigned shares.
                    // For now, if assigned, assume 100 shares per contract for new cycle creation.
                    payload.create_new_cycle = true;
                    payload.assigned_shares = legData.contracts * 100;
                }

            } else {
                // Strategy Complex Mode
                const strategyName = strategyNameSelect.value;
                if (!strategyName) {
                    showNotification('Please select a Strategy Type.', 'error');
                    return;
                }
                if (legsWrapper.children.length === 0) {
                    showNotification('Please add at least one leg for the strategy.', 'error');
                    return;
                }

                const legs = [];
                for (const legElement of legsWrapper.children) {
                    const legData = getLegData(legElement, true);
                    // The leg_type values in the UI are already the DB ENUM values, so no mapping needed here.
                    legs.push({
                        type: legData.type,
                        contract_type: legData.contract_type,
                        strike_price: legData.strike_price,
                        expiration_date: legData.expiration_date,
                        contracts: legData.contracts,
                        premium: legData.premium,
                        status: legData.status,
                        leg_type: legData.leg_type
                    });
                }

                apiUrl = '/api/log_strategy.php';
                payload = {
                    ticker: ticker,
                    strategy_name: strategyNameMap[strategyName] || 'Other', // Map UI value to DB ENUM
                    broker_name: brokerName,
                    legs: legs
                };
            }

            btnSubmitEntry.disabled = true; // Disable button to prevent double submission
            btnSubmitEntry.classList.add('loading'); // Add loading indicator if daisyUI has one

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                resetForm();
                // Reload the page to refresh the dashboard data
                location.reload();
            } else {
                showNotification(result.message, 'error');
            }

        } catch (error) {
            console.error('Submission error:', error);
            showNotification(`An error occurred: ${error.message}`, 'error');
        } finally {
            btnSubmitEntry.disabled = false;
            btnSubmitEntry.classList.remove('loading');
        }
    });

    // Open the modal when the quick-fill entry button is clicked, only if elements are found
    if (btnQuickFillEntry) {
        btnQuickFillEntry.addEventListener('click', () => {
            if (quickFillModal) {
                quickFillModal.showModal();
                // Set focus to ticker input immediately after showing the modal
                if (globalTicker) {
                    globalTicker.focus();
                }
            }
        });
    } else {
        // console.error('Error: btn_quick_fill_entry element not found. Click listener not attached.'); // Keep for critical errors if needed
    }
    // Initial setup
    toggleFormMode(); // Set initial state based on default checked tab    

    // Convert ticker to uppercase on blur
    globalTicker.addEventListener('blur', () => {
        globalTicker.value = globalTicker.value.toUpperCase();
    });
});