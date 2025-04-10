import type { Suggester, Schema, ScoringProfile } from ".";
import type { StoredDocument } from "./dataStore";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILENAME = "ase-indexes.json";
let filePath = FILENAME;

type SavedIndexDefinition<T extends object> = {
    schema: Schema;
    suggesters: Suggester[];
    scoringProfiles: ScoringProfile<T>[];
    defaultScoringProfile: string | undefined;
    documents: T[];
};

export function loadIndices(saveDir?: string): Record<string, SavedIndexDefinition<any>> {
    try {
        if (saveDir) {
            filePath = join(saveDir, FILENAME);
        }
        const fileContent = readFileSync(filePath, "utf8");
        const indices = JSON.parse(fileContent);
        return indices;
    } catch (error) {
        // If the file doesn't exist or is empty, return an empty object
        return {};
    }
}

function saveIndices(indices: Record<string, any>) {
    // save the indices to a file
    writeFileSync(filePath, JSON.stringify(indices), "utf8");
}

export function saveIndex<T extends object>(definition: {
    name: string;
    schema: Schema;
    suggesters?: Suggester[];
    scoringProfiles?: ScoringProfile<T>[];
    defaultScoringProfile?: string;
}) {
    const indices = loadIndices();

    indices[definition.name] = {
        schema: definition.schema,
        suggesters: definition.suggesters ?? [],
        scoringProfiles: definition.scoringProfiles ?? [],
        defaultScoringProfile: definition.defaultScoringProfile ?? null,
        documents: []
    } as SavedIndexDefinition<T>;

    saveIndices(indices);
}

export function saveDocuments<T extends object>(
    name: string,
    documents: StoredDocument<T>[]
) {
    const indices = loadIndices();

    if (!indices[name]) {
        throw new Error(`Index ${name} not found`);
    }

    indices[name].documents = documents.map((doc) => doc.original);

    saveIndices(indices);
}

export function deleteIndex(name: string) {
    const indices = loadIndices();

    if (!indices[name]) {
        throw new Error(`Index ${name} not found`);
    }

    delete indices[name];

    saveIndices(indices);
}
