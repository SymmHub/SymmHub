/* jshint esversion: 6 */

import { ColorInput } from "../../../lib/uilib/modules.js";

// Helper to format timestamps for logs
function getTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Helper to log actions to the logs pane
function writeLog(logEl, message) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `<span class="log-time">${getTimestamp()}</span>${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
}

// Initialize Case 1: ColorInput WITH Alpha
const slotAlpha = document.getElementById("slot-alpha");
const previewAlpha = document.getElementById("preview-alpha");
const previewValAlpha = document.getElementById("preview-val-alpha");
const valAlpha = document.getElementById("val-alpha");
const objAlpha = document.getElementById("obj-alpha");
const logAlpha = document.getElementById("log-alpha");

const colorInputAlpha = new ColorInput(slotAlpha, true);
colorInputAlpha.setValue("#0000ffff");

// Set up UI updater for Alpha case
function updateUIAlpha() {
    const currentVal = colorInputAlpha.getValue();
    const colorObj = {};
    colorInputAlpha.getValue(colorObj);

    previewAlpha.style.backgroundColor = currentVal;
    previewValAlpha.textContent = currentVal;
    valAlpha.textContent = currentVal;
    objAlpha.textContent = JSON.stringify(colorObj);
}

// Attach callbacks
colorInputAlpha.onChange = function(color) {
    updateUIAlpha();
    writeLog(logAlpha, `onChange: ${color}`);
};

colorInputAlpha.onInteraction = function() {
    writeLog(logAlpha, `onInteraction: User clicked/dragged control`);
};

// Initial draw
updateUIAlpha();


// Initialize Case 2: ColorInput WITHOUT Alpha
const slotNoAlpha = document.getElementById("slot-no-alpha");
const previewNoAlpha = document.getElementById("preview-no-alpha");
const previewValNoAlpha = document.getElementById("preview-val-no-alpha");
const valNoAlpha = document.getElementById("val-no-alpha");
const objNoAlpha = document.getElementById("obj-no-alpha");
const logNoAlpha = document.getElementById("log-no-alpha");

const colorInputNoAlpha = new ColorInput(slotNoAlpha, false);
colorInputNoAlpha.setValue("#0000ff");

// Set up UI updater for No Alpha case
function updateUINoAlpha() {
    const currentVal = colorInputNoAlpha.getValue();
    const colorObj = {};
    colorInputNoAlpha.getValue(colorObj);

    previewNoAlpha.style.backgroundColor = currentVal;
    previewValNoAlpha.textContent = currentVal;
    valNoAlpha.textContent = currentVal;
    objNoAlpha.textContent = JSON.stringify(colorObj);
}

// Attach callbacks
colorInputNoAlpha.onChange = function(color) {
    updateUINoAlpha();
    writeLog(logNoAlpha, `onChange: ${color}`);
};

colorInputNoAlpha.onInteraction = function() {
    writeLog(logNoAlpha, `onInteraction: User clicked/dragged control`);
};

// Initial draw
updateUINoAlpha();


// ==========================================
// CONTROLS FOR WITH-ALPHA CASE
// ==========================================
const toggleActiveAlpha = document.getElementById("toggle-active-alpha");
toggleActiveAlpha.onclick = function() {
    const nextState = !colorInputAlpha.active;
    colorInputAlpha.setActive(nextState);
    
    toggleActiveAlpha.textContent = `Active: ${nextState ? "True" : "False"}`;
    if (nextState) {
        toggleActiveAlpha.classList.remove("disabled");
    } else {
        toggleActiveAlpha.classList.add("disabled");
    }
    writeLog(logAlpha, `setActive(${nextState})`);
};

document.getElementById("btn-font-14-alpha").onclick = function() {
    colorInputAlpha.setFontSize(14);
    writeLog(logAlpha, `setFontSize(14)`);
};

document.getElementById("btn-font-20-alpha").onclick = function() {
    colorInputAlpha.setFontSize(20);
    writeLog(logAlpha, `setFontSize(20)`);
};

document.getElementById("set-hex-alpha-1").onclick = function() {
    colorInputAlpha.setValue("#ff00ff");
    updateUIAlpha();
    writeLog(logAlpha, `setValue("#ff00ff")`);
};

document.getElementById("set-hex-alpha-2").onclick = function() {
    colorInputAlpha.setValue("#00ffbb80");
    updateUIAlpha();
    writeLog(logAlpha, `setValue("#00ffbb80")`);
};

document.getElementById("set-obj-alpha").onclick = function() {
    colorInputAlpha.setValue({
        red: 249,
        green: 115,
        blue: 22,
        alpha: 100
    });
    updateUIAlpha();
    writeLog(logAlpha, `setValue({red: 249, green: 115, blue: 22, alpha: 100})`);
};

document.getElementById("set-width-normal-alpha").onclick = function() {
    colorInputAlpha.setWidths(70, 30, 100);
    writeLog(logAlpha, `setWidths(70, 30, 100)`);
};

document.getElementById("set-width-wide-alpha").onclick = function() {
    colorInputAlpha.setWidths(100, 50, 150);
    writeLog(logAlpha, `setWidths(100, 50, 150)`);
};


// ==========================================
// CONTROLS FOR WITHOUT-ALPHA CASE
// ==========================================
const toggleActiveNoAlpha = document.getElementById("toggle-active-no-alpha");
toggleActiveNoAlpha.onclick = function() {
    const nextState = !colorInputNoAlpha.active;
    colorInputNoAlpha.setActive(nextState);
    
    toggleActiveNoAlpha.textContent = `Active: ${nextState ? "True" : "False"}`;
    if (nextState) {
        toggleActiveNoAlpha.classList.remove("disabled");
    } else {
        toggleActiveNoAlpha.classList.add("disabled");
    }
    writeLog(logNoAlpha, `setActive(${nextState})`);
};

document.getElementById("btn-font-14-no-alpha").onclick = function() {
    colorInputNoAlpha.setFontSize(14);
    writeLog(logNoAlpha, `setFontSize(14)`);
};

document.getElementById("btn-font-20-no-alpha").onclick = function() {
    colorInputNoAlpha.setFontSize(20);
    writeLog(logNoAlpha, `setFontSize(20)`);
};

document.getElementById("set-hex-no-alpha-1").onclick = function() {
    colorInputNoAlpha.setValue("#00ff00");
    updateUINoAlpha();
    writeLog(logNoAlpha, `setValue("#00ff00")`);
};

document.getElementById("set-hex-no-alpha-2").onclick = function() {
    colorInputNoAlpha.setValue("#ffd700");
    updateUINoAlpha();
    writeLog(logNoAlpha, `setValue("#ffd700")`);
};

document.getElementById("set-obj-no-alpha").onclick = function() {
    colorInputNoAlpha.setValue({
        red: 240,
        green: 128,
        blue: 128
    });
    updateUINoAlpha();
    writeLog(logNoAlpha, `setValue({red: 240, green: 128, blue: 128})`);
};

document.getElementById("set-width-normal-no-alpha").onclick = function() {
    colorInputNoAlpha.setWidths(70, 30);
    writeLog(logNoAlpha, `setWidths(70, 30)`);
};

document.getElementById("set-width-wide-no-alpha").onclick = function() {
    colorInputNoAlpha.setWidths(100, 60);
    writeLog(logNoAlpha, `setWidths(100, 60)`);
};
