import { createRoutesEditor } from './routes_editor.js';
import { producerLibrary, consumerLibrary } from './modules.js';

/**
 * Basic Test Suite for Routes Editor
 */
function runTests() {
    console.group('Routes Editor Tests');

    // Setup: Create a container in the document for the editor
    const testContainer = document.createElement('div');
    testContainer.id = 'test-editor-container';
    document.body.appendChild(testContainer);

    try {
        testInitialCreation(testContainer);
        testAddRow(testContainer);
        // Add more tests as needed
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Cleanup
        // document.body.removeChild(testContainer);
        console.groupEnd();
    }
}

function testInitialCreation(container) {
    console.log('Testing initial creation...');

    let changeCount = 0;
    const editor = createRoutesEditor(producerLibrary, consumerLibrary, (data) => {
        changeCount++;
    });

    container.appendChild(editor);

    const rows = editor.querySelectorAll('.connection-row');
    console.assert(rows.length === 3, `Expected 3 initial rows, found ${rows.length}`);
    console.assert(changeCount === 3, `Expected 3 initial change notifications, got ${changeCount}`);

    console.log('✓ Initial creation successful');
}

function testAddRow(container) {
    console.log('Testing add row functionality...');

    const editor = container.firstChild;
    const addBtn = editor.querySelector('.add-row-btn');
    const initialRowCount = editor.querySelectorAll('.connection-row').length;

    addBtn.click();

    const newRowCount = editor.querySelectorAll('.connection-row').length;
    console.assert(newRowCount === initialRowCount + 1, `Expected ${initialRowCount + 1} rows, found ${newRowCount}`);

    console.log('✓ Add row successful');
}

// Run tests when the page is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runTests);
    } else {
        runTests();
    }
}
