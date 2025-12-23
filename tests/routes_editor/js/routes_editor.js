// --- DATA DOMAIN ---

class OutputObject {
    constructor(name, properties) {
        this.name = name;
        this.properties = properties;
    }
    getOutputProperties() {
        return this.properties;
    }
}

class InputObject {
    constructor(name, properties) {
        this.name = name;
        this.properties = properties;
    }
    getInputProperties() {
        return this.properties;
    }
}

// Mock Data
const producerLibrary = [
    new OutputObject("TelemSrv_01", ["speed", "altitude", "fuel_level", "heading"]),
    new OutputObject("EnvSensor_A", ["temp_c", "humidity_pct", "pressure_hpa"]),
    new OutputObject("PowerGrid_Main", ["voltage", "current_draw", "freq_hz"]),
    new OutputObject("Camera_Entry", ["motion_score", "lux_level", "is_recording"])
];

const consumerLibrary = [
    new InputObject("Status_Dash", ["slot1_val", "slot2_val", "alert_msg"]),
    new InputObject("BrakingSys", ["control_input", "safety_override"]),
    new InputObject("DataLogger", ["log_payload", "priority_level"]),
    new InputObject("LightControl", ["dim_target", "switch_state"])
];

// --- UI LOGIC ---

document.addEventListener('DOMContentLoaded', () => {
    const rowList = document.getElementById('rowList');
    const addRowBtn = document.getElementById('addRowBtn');

    function createRow() {
        const rowId = Math.random().toString(36).substr(2, 9);
        const rowDiv = document.createElement('div');
        rowDiv.className = 'connection-row';
        rowDiv.id = `row-${rowId}`;

        rowDiv.innerHTML = `
            <button class="remove-btn" title="Remove Connection" onclick="removeRow('${rowId}')">×</button>
            
            <!-- Producer Endpoint -->
            <div class="endpoint-box producer-box">
                <div class="select-wrapper">
                    <select id="prod-obj-${rowId}" onchange="handleProducerObjectChange('${rowId}')">
                        <option value="" disabled selected>Select Object...</option>
                        ${producerLibrary.map((obj, i) => `<option value="${i}">${obj.name}</option>`).join('')}
                    </select>
                </div>
                <div class="divider"></div>
                <div class="select-wrapper">
                    <select id="prod-prop-${rowId}" disabled>
                        <option value="" disabled selected>Property...</option>
                    </select>
                </div>
            </div>

            <div class="arrow-icon">→</div>

            <!-- Consumer Endpoint -->
            <div class="endpoint-box consumer-box">
                <div class="select-wrapper">
                    <select id="cons-obj-${rowId}" onchange="handleConsumerObjectChange('${rowId}')">
                        <option value="" disabled selected>Select Object...</option>
                        ${consumerLibrary.map((obj, i) => `<option value="${i}">${obj.name}</option>`).join('')}
                    </select>
                </div>
                <div class="divider"></div>
                <div class="select-wrapper">
                    <select id="cons-prop-${rowId}" disabled>
                        <option value="" disabled selected>Property...</option>
                    </select>
                </div>
            </div>
        `;

        rowList.appendChild(rowDiv);
    }

    window.removeRow = function (id) {
        const element = document.getElementById(`row-${id}`);
        element.style.transition = 'all 0.3s ease';
        element.style.opacity = '0';
        element.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            element.remove();
        }, 300);
    };

    window.handleProducerObjectChange = function (rowId) {
        const objSelect = document.getElementById(`prod-obj-${rowId}`);
        const propSelect = document.getElementById(`prod-prop-${rowId}`);
        const selectedIdx = objSelect.value;

        if (selectedIdx !== "") {
            const obj = producerLibrary[selectedIdx];
            const props = obj.getOutputProperties();

            propSelect.innerHTML = `<option value="" disabled selected>Select Property...</option>` +
                props.map(p => `<option value="${p}">${p}</option>`).join('');

            propSelect.disabled = false;
        }
    };

    window.handleConsumerObjectChange = function (rowId) {
        const objSelect = document.getElementById(`cons-obj-${rowId}`);
        const propSelect = document.getElementById(`cons-prop-${rowId}`);
        const selectedIdx = objSelect.value;

        if (selectedIdx !== "") {
            const obj = consumerLibrary[selectedIdx];
            const props = obj.getInputProperties();

            propSelect.innerHTML = `<option value="" disabled selected>Select Property...</option>` +
                props.map(p => `<option value="${p}">${p}</option>`).join('');

            propSelect.disabled = false;
        }
    };

    if (addRowBtn) {
        addRowBtn.addEventListener('click', createRow);
    }

    // Initialize with 3 rows if the row list exists
    if (rowList) {
        for (let i = 0; i < 3; i++) {
            createRow();
        }
    }
});
