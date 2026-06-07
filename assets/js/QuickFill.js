document.addEventListener('DOMContentLoaded', () => {
    const quickFillModal = document.getElementById('quick_fill_modal');
    const quickFillForm = document.getElementById('quick_fill_form');
    const btnQuickFillEntry = document.getElementById('btn_quick_fill_entry');
    const modeSingleToggle = document.getElementById('mode_single_toggle');
    const modeStrategyToggle = document.getElementById('mode_strategy_toggle');
    const singleLegFieldsContainer = document.getElementById('single_leg_fields_container');
    const strategyLegsFieldsContainer = document.getElementById('strategy_legs_fields_container');
    const strategyTypeContainer = document.getElementById('strategy_type_container');
    const btnAddLegRow = document.getElementById('btn_add_leg_row');
    const legsWrapper = document.getElementById('legs_wrapper');
    const btnSubmitEntry = document.getElementById('btn_submit_entry');

    const globalTicker = document.getElementById('global_ticker');
    const globalBroker = document.getElementById('global_broker');
    const strategyNameSelect = document.getElementById('strategy_name');

    const singleType = document.getElementById('single_type');
    const singleContractType = document.getElementById('single_contract_type');
    const singleStrike = document.getElementById('single_strike');
    const singleExpiration = document.getElementById('single_expiration');
    const singleContracts = document.getElementById('single_contracts');
    const singlePremium = document.getElementById('single_premium');
    const singleWheelId = document.getElementById('single_wheel_id');

    let legCounter = 0;

    function showNotification(message, type = 'info') {
        alert(`${type.toUpperCase()}: ${message}`);
    }

    function getNextFriday() {
        const today = new Date();
        const dayOfWeek = today.getDay();
        let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
        if (dayOfWeek === 5) daysUntilFriday = 0;
        const nextFriday = new Date(today);
        nextFriday.setDate(today.getDate() + daysUntilFriday);
        return `${nextFriday.getFullYear()}-${String(nextFriday.getMonth() + 1).padStart(2, '0')}-${String(nextFriday.getDate()).padStart(2, '0')}`;
    }

    window.resetForm = function() {
        quickFillForm.reset();
        legsWrapper.innerHTML = '';
        legCounter = 0;
        modeSingleToggle.checked = true;
        toggleFormMode();
        quickFillModal.close();
    }

    function getLegData(legElement, isStrategyLeg = false) {
        const prefix = isStrategyLeg ? `leg_${legElement.dataset.legIndex}_` : 'single_';
        const legData = {
            type: legElement.querySelector(`#${prefix}type`).value,
            contract_type: legElement.querySelector(`#${prefix}contract_type`).value,
            strike_price: parseFloat(legElement.querySelector(`#${prefix}strike`).value),
            expiration_date: legElement.querySelector(`#${prefix}expiration`).value,
            contracts: parseInt(legElement.querySelector(`#${prefix}contracts`).value, 10) || 1,
            premium: parseFloat(legElement.querySelector(`#${prefix}premium`).value),
            status: 'FILLED',
            leg_type: legElement.querySelector(`#${prefix}leg_type`) ? legElement.querySelector(`#${prefix}leg_type`).value : null,
            wheel_cycle_id: legElement.querySelector(`#${prefix}wheel_id`) ? parseInt(legElement.querySelector(`#${prefix}wheel_id`).value, 10) || null : null
        };

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

    function toggleFormMode() {
        const isSingleMode = modeSingleToggle.checked;
        if (isSingleMode) {
            singleLegFieldsContainer.classList.remove('hidden');
            singleLegFieldsContainer.classList.add('block');
            strategyLegsFieldsContainer.classList.add('hidden');
            strategyTypeContainer.classList.add('hidden');
            strategyTypeContainer.classList.remove('grid');

            singleType.setAttribute('required', 'true');
            singleContractType.setAttribute('required', 'true');
            singleStrike.setAttribute('required', 'true');
            singleExpiration.setAttribute('required', 'true');
            singlePremium.setAttribute('required', 'true');
            singleExpiration.value = getNextFriday();
            strategyNameSelect.removeAttribute('required');
        } else {
            singleLegFieldsContainer.classList.remove('block');
            singleLegFieldsContainer.classList.add('hidden');
            strategyLegsFieldsContainer.classList.remove('hidden');
            strategyLegsFieldsContainer.classList.add('block');
            strategyTypeContainer.classList.remove('hidden');
            strategyTypeContainer.classList.add('grid');

            if (legsWrapper.children.length === 0) {
                addLegRow();
            }

            singleType.removeAttribute('required');
            singleContractType.removeAttribute('required');
            singleStrike.removeAttribute('required');
            singleExpiration.removeAttribute('required');
            singlePremium.removeAttribute('required');
            strategyNameSelect.setAttribute('required', 'true');
        }
        globalTicker.setAttribute('required', 'true');
        globalBroker.setAttribute('required', 'true');
    }

    function createLegRowHtml(index) {
        const defaultLegTypeOptions = `
            <option value="LONG_CALL">LONG_CALL</option>
            <option value="SHORT_CALL">SHORT_CALL</option>
            <option value="LONG_PUT">LONG_PUT</option>
            <option value="SHORT_PUT">SHORT_PUT</option>
        `;

        return `
            <div class="card card-compact bg-base-300 border border-base-content/10 p-2 mb-2 relative shadow-inner" data-leg-index="${index}">
                <button type="button" class="btn btn-circle btn-error btn-xs h-4 w-4 min-h-0 text-[8px] absolute top-2 right-2 remove-leg-btn shadow-md">✕</button>
                <div class="flex items-center mb-1">
                    <span class="text-[10px] font-bold text-base-content/50 px-1">LEG #${index}</span>
                </div>
                <div class="flex flex-wrap items-end gap-2 pr-6">
                    <div class="w-32">
                        <label class="label pt-0 pb-0.5 text-[10px] font-bold uppercase opacity-60">Action</label>
                        <select id="leg_${index}_type" class="select select-xs w-full bg-base-100 border border-base-content/20" required>
                            <option value="SELL_TO_OPEN">SELL_TO_OPEN</option>
                            <option value="BUY_TO_OPEN">BUY_TO_OPEN</option>
                            <option value="BUY_TO_CLOSE">BUY_TO_CLOSE</option>
                            <option value="SELL_TO_CLOSE">SELL_TO_CLOSE</option>
                        </select>
                    </div>
                    <div class="w-16">
                        <label class="label pt-0 pb-0.5 text-[10px] font-bold uppercase opacity-60">Qty</label>
                        <input type="number" id="leg_${index}_contracts" class="input input-xs w-full bg-base-100 border border-base-content/20" value="1" />
                    </div>
                    <div class="w-20">
                        <label class="label pt-0 pb-0.5 text-[10px] font-bold uppercase opacity-60">Type</label>
                        <select id="leg_${index}_contract_type" class="select select-xs w-full bg-base-100 border border-base-content/20" required>
                            <option value="PUT">PUT</option>
                            <option value="CALL">CALL</option>
                        </select>
                    </div>
                    <div class="w-36">
                        <label class="label pt-0 pb-0.5 text-[10px] font-bold uppercase opacity-60">Exp. Date</label>
                        <input type="date" id="leg_${index}_expiration" class="input input-xs w-full bg-base-100 border border-base-content/20" value="${getNextFriday()}" required />
                    </div>
                    <div class="w-24">
                        <label class="label pt-0 pb-0.5 text-[10px] font-bold uppercase opacity-60">Strike</label>
                        <input type="number" step="0.01" id="leg_${index}_strike" class="input input-xs w-full bg-base-100 border border-base-content/20" placeholder="0.00" required />
                    </div>
                    <div class="w-24">
                        <label class="label pt-0 pb-0.5 text-[10px] font-bold uppercase opacity-60">Premium</label>
                        <input type="number" step="0.01" id="leg_${index}_premium" class="input input-xs w-full bg-base-100 border border-base-content/20" placeholder="0.00" required />
                    </div>
                    <div class="w-32">
                        <label class="label pt-0 pb-0.5 text-[10px] font-bold uppercase opacity-60">Leg Type</label>
                        <select id="leg_${index}_leg_type" class="select select-xs w-full bg-base-100 border border-base-content/20" required>
                            ${defaultLegTypeOptions}
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    function addLegRow() {
        legCounter++;
        const newLegDiv = document.createElement('div');
        newLegDiv.innerHTML = createLegRowHtml(legCounter);
        legsWrapper.appendChild(newLegDiv.firstElementChild);
    }

    modeSingleToggle.addEventListener('change', toggleFormMode);
    modeStrategyToggle.addEventListener('change', toggleFormMode);
    btnAddLegRow.addEventListener('click', addLegRow);

    legsWrapper.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-leg-btn')) {
            event.target.closest('.card').remove();
            if (legsWrapper.children.length === 0) {
                addLegRow();
            }
        }
    });

    quickFillForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!globalTicker.value || !globalBroker.value) {
            showNotification('Please fill in Ticker Symbol and Broker Account.', 'error');
            return;
        }
        const brokerName = globalBroker.value;
        const ticker = globalTicker.value.toUpperCase();
        let payload = {};
        let apiUrl = '';
        const strategyNameMap = {
            "VERTICAL_SPREAD": "Vertical Spread",
            "IRON_CONDOR": "Iron Condor",
            "STRANGLE": "Strangle",
            "STRADDLE": "Straddle",
            "CUSTOM": "Other"
        };
        try {
            if (modeSingleToggle.checked) {
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
                if (legData.wheel_cycle_id === null && legData.status === 'ASSIGNED' && legData.type === 'SELL_TO_OPEN' && legData.contract_type === 'CALL') {
                    payload.create_new_cycle = true;
                    payload.assigned_shares = legData.contracts * 100;
                }
            } else {
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
            btnSubmitEntry.disabled = true;
            btnSubmitEntry.classList.add('loading');
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

    if (btnQuickFillEntry) {
        btnQuickFillEntry.addEventListener('click', () => {
            if (quickFillModal) {
                quickFillModal.showModal();
                if (globalTicker) {
                    globalTicker.focus();
                }
            }
        });
    }

    toggleFormMode();
    globalTicker.addEventListener('blur', () => {
        globalTicker.value = globalTicker.value.toUpperCase();
    });
});