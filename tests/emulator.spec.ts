import { describe, expect, it, vi, afterEach } from "vitest";
import { Emulator } from "../src";
import { peopleSchema } from "./lib/mockSchema";

let storedIndex: string;

describe("Emulator", () => {

    afterEach(() => {
        vi.restoreAllMocks();
        storedIndex = "";
    });

    it("should be able to construct an emulator with no persisted indexes", () => {
        vi.mock("node:fs", () => ({
            readFileSync: () => {
                throw new Error("File not found");
            },
            writeFileSync: vi.fn()
        }));
        const sut = new Emulator();

        expect(sut).toBeInstanceOf(Emulator);
    });

    it("should persist an index when created", () => {
        vi.mock("node:fs", () => ({
            readFileSync: () => {
                return storedIndex;
            },
            writeFileSync: (_: string, data: string) => {
                console.log("Writing index to file:", data);
                storedIndex = data;
            }
        }));

        const sut = new Emulator();
        const index = sut.createIndex({
            name: "people",
            schema: peopleSchema
        });

        expect(index.name).toBe("people");
        expect(storedIndex).toContain("people");
    });

    it("should load a persisted index when constructed", () => {
        vi.mock("node:fs", () => ({
            readFileSync: () => {
                return storedIndex;
            },
            writeFileSync: (_: string, data: string) => {
                storedIndex = data;
            }
        }));

        let sut = new Emulator();

        sut.createIndex({
            name: "people",
            schema: peopleSchema
        });

        sut = new Emulator();

        const index = sut.getIndex("people");

        expect(index.name).toBe("people");
    });
});
