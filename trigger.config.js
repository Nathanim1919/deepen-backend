"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const v3_1 = require("@trigger.dev/sdk/v3");
exports.default = (0, v3_1.defineConfig)({
    project: "proj_hukblujkdeduuezdcbsb",
    runtime: "node",
    logLevel: "log",
    maxDuration: 3600,
    retries: {
        enabledInDev: true,
        default: {
            maxAttempts: 3,
            minTimeoutInMs: 1000,
            maxTimeoutInMs: 10000,
            factor: 2,
            randomize: true,
        },
    },
    dirs: ["./src/trigger"],
});
//# sourceMappingURL=trigger.config.js.map