// vite.config.js
import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [
        dts({
            insertTypesEntry: true,
            skipDiagnostics: false,
            exclude: ["node_modules", "dist", "tests"]
        })
    ],
    build: {
        target: "node22",
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            formats: ["es"]
        },
        ssr: true
    }
});
