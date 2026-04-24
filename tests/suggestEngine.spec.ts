import { describe, expect, it } from "vitest";

import type { People } from "./lib/mockSchema";
import {
    peopleSchemaKey,
    peopleSchemaService,
    peopleSuggesterProvider,
    peopleToStoredDocument
} from "./lib/mockSchema";

import type { Suggester } from "../src";
import { SuggestEngine, SearchBackend } from "../src";

function createEmpty() {
    return new SuggestEngine(
        new SearchBackend<People>(peopleSchemaService, () => []),
        () => peopleSchemaKey,
        peopleSuggesterProvider
    );
}
function createBasic() {
    return new SuggestEngine(
        new SearchBackend<People>(peopleSchemaService, () => [
            peopleToStoredDocument({ id: "1", fullName: "foo" }),
            peopleToStoredDocument({ id: "2", fullName: "bar" }),
            peopleToStoredDocument({ id: "3", fullName: "biz" }),
            peopleToStoredDocument({ id: "4", fullName: "buzz" })
        ]),
        () => peopleSchemaKey,
        peopleSuggesterProvider
    );
}
function createComplex() {
    const document: People = {
        id: "1",
        fullName: "foo",
        ratio: 0.5,
        income: 400,
        addresses: [
            {
                parts: "adr1",
                kind: "home"
            },
            {
                parts: "adr2",
                kind: "work"
            }
        ],
        phones: ["123", "456"],
        metadata: {
            createdBy: "mock1",
            createdOn: new Date(1970, 1, 1),
            deleted: false,
            editCounter: 3
        }
    };

    return new SuggestEngine<People>(
        new SearchBackend<People>(peopleSchemaService, () => [
            peopleToStoredDocument(document)
        ]),
        () => peopleSchemaKey,
        peopleSuggesterProvider
    );
}
function createLargeDataSet() {
    const documents = Array.from(new Array(2_500)).map((_, i) =>
        peopleToStoredDocument({
            id: `${i}`,
            fullName: `${i}`.split("").join(" ")
        })
    );

    return new SuggestEngine<People>(
        new SearchBackend<People>(peopleSchemaService, () => documents),
        () => peopleSchemaKey,
        peopleSuggesterProvider
    );
}

describe("SuggestEngine", () => {
    describe("suggest", () => {
        it("should return nothing when empty", () => {
            const sut = createEmpty();

            const results = sut.suggest({ suggesterName: "sg", search: "" });

            expect(results.value).toEqual([]);
        });

        it("should return suggestions starting with the search term", () => {
            const sut = createBasic();

            const results = sut.suggest({ suggesterName: "sg", search: "ba" });

            expect(results.value).toEqual([{ "@search.text": "bar", id: "2" }]);
        });
    });

    describe("searchFields", () => {
        it("should only search in searchFields", () => {
            const sut = createComplex();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "1",
                searchFields: "id"
            });

            expect(results.value).toEqual([{ "@search.text": "1", id: "1" }]);
        });

        it("should search in all provided searchFields", () => {
            const sut = createComplex();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "1",
                searchFields: "id, phones"
            });

            expect(results.value).toEqual([
                { "@search.text": "1", id: "1" },
                { "@search.text": "123", id: "1" }
            ]);
        });

        it("should produce no suggestions when a match only occurs on a field not covered by the suggester", () => {
            // When searchFields is omitted, search uses '*' (all fields), but the
            // suggestion strategy only generates text for the suggester's configured fields.
            // A document that matches exclusively on a non-suggester field scores but
            // produces no @search.text entries — it silently contributes nothing to results.
            const suggester: Suggester = {
                name: "sg",
                searchMode: "analyzingInfixMatching",
                fields: ["fullName"],
            };
            const sut = new SuggestEngine<People>(
                new SearchBackend<People>(peopleSchemaService, () => [
                    peopleToStoredDocument({ id: "xyz", fullName: "foo" })
                ]),
                () => peopleSchemaKey,
                (_name) => suggester
            );

            const results = sut.suggest({ suggesterName: "sg", search: "xyz" });

            expect(results.value).toEqual([]);
        });
    });

    describe("duplicates", () => {
        it("should not return duplicate suggestions when the same text matches in multiple fields", () => {
            const sut = new SuggestEngine(
                new SearchBackend<People>(peopleSchemaService, () => [
                    peopleToStoredDocument({ id: "abc", fullName: "abc" })
                ]),
                () => peopleSchemaKey,
                peopleSuggesterProvider
            );

            const results = sut.suggest({ suggesterName: "sg", search: "abc" });

            // Both id and fullName independently match "abc" and each generates
            // @search.text: "abc". Without deduplication two identical entries are returned.
            expect(results.value).toEqual([{ "@search.text": "abc", id: "abc" }]);
        });

        it("should not return duplicate suggestions when an array field contains repeated values", () => {
            const sut = new SuggestEngine(
                new SearchBackend<People>(peopleSchemaService, () => [
                    peopleToStoredDocument({ id: "1", phones: ["abc", "abc"] })
                ]),
                () => peopleSchemaKey,
                peopleSuggesterProvider
            );

            const results = sut.suggest({
                suggesterName: "sg",
                search: "abc",
                searchFields: "phones"
            });

            // Each occurrence of "abc" in the phones array independently generates
            // @search.text: "abc". Without deduplication two identical entries are returned.
            expect(results.value).toEqual([{ "@search.text": "abc", id: "1" }]);
        });
    });

    describe("select", () => {
        it("should include only the key field by default", () => {
            const sut = createComplex();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "adr1"
            });

            expect(results.value).toEqual([
                {
                    "@search.text": "adr1",
                    id: "1"
                }
            ]);
        });

        it("should include all properties on wildcard", () => {
            const sut = createComplex();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "adr1",
                select: ["*"]
            });

            expect(results.value).toEqual([
                {
                    "@search.text": "adr1",
                    id: "1",
                    fullName: "foo",
                    ratio: 0.5,
                    income: 400,
                    addresses: [
                        {
                            parts: "adr1",
                            kind: "home"
                        },
                        {
                            parts: "adr2",
                            kind: "work"
                        }
                    ],
                    phones: ["123", "456"],
                    metadata: {
                        createdBy: "mock1",
                        createdOn: new Date(1970, 1, 1),
                        deleted: false,
                        editCounter: 3
                    }
                }
            ]);
        });

        it("should only include requested properties", () => {
            const sut = createComplex();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "adr1",
                select: ["id", "addresses/kind", "phones", "metadata/deleted"]
            });

            expect(results.value).toEqual([
                {
                    "@search.text": "adr1",
                    id: "1",
                    addresses: [{ kind: "home" }, { kind: "work" }],
                    phones: ["123", "456"],
                    metadata: {
                        deleted: false
                    }
                }
            ]);
        });

        it("should not leak non-selected document fields into results", () => {
            // suggestResult spreads `cur.selected ?? cur.document.original` into
            // each result entry. This verifies the selected projection is used and that
            // fields absent from the select clause do not appear in the output.
            const sut = createComplex();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "foo",
                select: ["id"]
            });

            expect(results.value).toEqual([{ "@search.text": "foo", id: "1" }]);
        });
    });

    describe("limiter", () => {
        it("should limit results to 5 items per page by default", () => {
            const sut = createLargeDataSet();

            const results = sut.suggest({ suggesterName: "sg", search: "1" });

            expect(results.value.length).toBe(5);
        });

        it("should limit results to 100 items per page max", () => {
            const sut = createLargeDataSet();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "1",
                top: Number.MAX_SAFE_INTEGER
            });

            expect(results.value.length).toBe(100);
        });

        it("should return 0 results when top is 0", () => {
            const sut = createLargeDataSet();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "1",
                top: 0,
            });

            expect(results.value.length).toBe(0);
        });
    });

    describe("coverage", () => {
        it("should not include coverage by default", () => {
            const sut = createEmpty();

            const results = sut.suggest({ suggesterName: "sg", search: "" });

            expect(results["@search.coverage"]).toBe(undefined);
        });

        it("should include coverage when minimum is requested", () => {
            const sut = createEmpty();

            const results = sut.suggest({
                suggesterName: "sg",
                search: "",
                minimumCoverage: 75
            });

            // Coverage is hard-coded to 100% in the emulator since the data isn't sharded.
            expect(results["@search.coverage"]).toBe(100);
        });
    });
});
