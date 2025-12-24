import {
    producerLibrary,
    consumerLibrary
} from './modules.js';

// --- UI LOGIC ---

export function createRoutesEditor(producerLibrary, consumerLibrary, onChange) {
    const container = document.createElement('div');

    // Create Header Grid
    const builderGrid = document.createElement('div');
    builderGrid.className = 'builder-grid';
    builderGrid.innerHTML = `
        <div style="width: 30px;"></div>
        <div class="column-header">
            <i class="producer-color"></i>
            Producer (Outputs)
        </div>
        <div></div>
        <div class="column-header">
            <i class="consumer-color"></i>
            Consumer (Inputs)
        </div>
    `;
    container.appendChild(builderGrid);

    // Create Row List
    const rowList = document.createElement('div');
    rowList.className = 'row-list';
    container.appendChild(rowList);

    // Create Add Button
    const addRowBtn = document.createElement('button');
    addRowBtn.className = 'add-row-btn';
    addRowBtn.innerHTML = '<span>+</span> Add New Connection';
    container.appendChild(addRowBtn);

    const notifyChange = (rowId, changeType) => {
        if (typeof onChange === 'function') {
            const routes = [];
            const rows = rowList.querySelectorAll('.connection-row');
            rows.forEach(row => {
                const id = row.id.replace('row-', '');
                const route = {
                    id: id,
                    producer: {
                        objectIndex: document.getElementById(`prod-obj-${id}`)?.value || null,
                        property: document.getElementById(`prod-prop-${id}`)?.value || null
                    },
                    consumer: {
                        objectIndex: document.getElementById(`cons-obj-${id}`)?.value || null,
                        property: document.getElementById(`cons-prop-${id}`)?.value || null
                    }
                };
                routes.push(route);
            });

            const changedRoute = rowId ? routes.find(r => r.id === rowId) : null;
            onChange({
                type: changeType,
                changedRowId: rowId,
                changedRoute: changedRoute,
                allRoutes: routes
            });
        }
    };

    let routeCounter = 1;

    function createRow() {
        const rowId = `ROUTE${routeCounter++}`;
        const rowDiv = document.createElement('div');
        rowDiv.className = 'connection-row';
        rowDiv.id = `row-${rowId}`;

        // Create Remove Button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.title = 'Remove Connection';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => window.removeRow(rowId);
        rowDiv.appendChild(removeBtn);

        // Helper to create an endpoint section
        const createEndpoint = (prefix, library, onChangeHandler) => {
            const box = document.createElement('div');
            box.className = `endpoint-box ${prefix === 'prod' ? 'producer' : 'consumer'}-box`;

            // Object selection
            const objWrapper = document.createElement('div');
            objWrapper.className = 'select-wrapper';
            const objSelect = document.createElement('select');
            objSelect.id = `${prefix}-obj-${rowId}`;
            objSelect.onchange = () => onChangeHandler(rowId);

            const objDefault = new Option('Select Object...', '', true, true);
            objDefault.disabled = true;
            objSelect.add(objDefault);

            library.forEach((obj, i) => {
                objSelect.add(new Option(obj.name, i));
            });
            objWrapper.appendChild(objSelect);
            box.appendChild(objWrapper);

            // Divider
            const divider = document.createElement('div');
            divider.className = 'divider';
            box.appendChild(divider);

            // Property selection
            const propWrapper = document.createElement('div');
            propWrapper.className = 'select-wrapper';
            const propSelect = document.createElement('select');
            propSelect.id = `${prefix}-prop-${rowId}`;
            propSelect.disabled = true;
            propSelect.onchange = () => notifyChange(rowId, 'property_change');

            const propDefault = new Option('Property...', '', true, true);
            propDefault.disabled = true;
            propSelect.add(propDefault);

            propWrapper.appendChild(propSelect);
            box.appendChild(propWrapper);

            return box;
        };

        // Add Producer section
        rowDiv.appendChild(createEndpoint('prod', producerLibrary, window.handleProducerObjectChange));

        // Add Arrow Icon
        const arrow = document.createElement('div');
        arrow.className = 'arrow-icon';
        arrow.textContent = '→';
        rowDiv.appendChild(arrow);

        // Add Consumer section
        rowDiv.appendChild(createEndpoint('cons', consumerLibrary, window.handleConsumerObjectChange));

        rowList.appendChild(rowDiv);
        notifyChange(rowId, 'row_added');
    }

    // Attach to window so inline HTML handlers work with modules
    window.removeRow = function (id) {
        const element = document.getElementById(`row-${id}`);
        if (!element) return;

        element.style.transition = 'all 0.3s ease';
        element.style.opacity = '0';
        element.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            element.remove();
            notifyChange(id, 'row_removed');
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
            notifyChange(rowId, 'object_change');
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
            notifyChange(rowId, 'object_change');
        }
    };

    addRowBtn.addEventListener('click', createRow);

    // Initialize with 3 rows
    for (let i = 0; i < 3; i++) {
        createRow();
    }

    return container;
}

document.addEventListener('DOMContentLoaded', () => {
    const editor = createRoutesEditor(producerLibrary, consumerLibrary, (data) => {
        console.log('Routes editor changed:', data);
    });

    const target = document.getElementById('editor-container');
    if (target) {
        target.appendChild(editor);
    }
});
