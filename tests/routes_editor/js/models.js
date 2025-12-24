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
    new OutputObject("Animator 1", ["out_p1", "out_p2", "out_p3"]),
    new OutputObject("Animator 2", ["out_p1", "out_p2", "out_p3"]),
    new OutputObject("Animator 3", ["out_p1", "out_p2", "out_p3"]),
    new OutputObject("Animator 4", ["out_p1", "out_p2", "out_p3"])
];

export const consumerLibrary = [
    new InputObject("Object 1", ["in_p1", "in_p2", "in_p3"]),
    new InputObject("Object 2", ["in_p1", "in_p2", "in_p3"]),
    new InputObject("Object 3", ["in_p1", "in_p2", "in_p3"]),
    new InputObject("Object 4", ["in_p1", "in_p2", "in_p3"])
];
