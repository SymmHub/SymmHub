// --- DATA MODELS ---

export class OutputObject {
    constructor(name, properties) {
        this.name = name;
        this.properties = properties;
    }
    getOutputProperties() {
        return this.properties;
    }
}

export class InputObject {
    constructor(name, properties) {
        this.name = name;
        this.properties = properties;
    }
    getInputProperties() {
        return this.properties;
    }
}

// Mock Data
export const producerLibrary = [
    new OutputObject("TelemSrv_01", ["speed", "altitude", "fuel_level", "heading"]),
    new OutputObject("EnvSensor_A", ["temp_c", "humidity_pct", "pressure_hpa"]),
    new OutputObject("PowerGrid_Main", ["voltage", "current_draw", "freq_hz"]),
    new OutputObject("Camera_Entry", ["motion_score", "lux_level", "is_recording"])
];

export const consumerLibrary = [
    new InputObject("Status_Dash", ["slot1_val", "slot2_val", "alert_msg"]),
    new InputObject("BrakingSys", ["control_input", "safety_override"]),
    new InputObject("DataLogger", ["log_payload", "priority_level"]),
    new InputObject("LightControl", ["dim_target", "switch_state"])
];
