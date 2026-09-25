import gameToBuildVersionInt from "../constants/gameToBuildVersionInt.ts";
import type { IEndlessXpChoice, IWorldState } from "../types/worldStateTypes.ts";

const normalChoices = [
    ["Nidus", "Octavia", "Harrow"],
    ["Gara", "Khora", "Revenant"],
    ["Garuda", "Baruuk", "Hildryn"],
    ["Excalibur", "Trinity", "Ember"],
    ["Loki", "Mag", "Rhino"],
    ["Ash", "Frost", "Nyx"],
    ["Saryn", "Vauban", "Nova"],
    ["Nekros", "Valkyr", "Oberon"],
    ["Hydroid", "Mirage", "Limbo"],
    ["Mesa", "Chroma", "Atlas"],
    ["Ivara", "Inaros", "Titania"]
];
const hardChoices = [
    ["Boar", "Gammacor", "Angstrum", "Gorgon", "Anku"],
    ["Bo", "Latron", "Furis", "Furax", "Strun"],
    ["Lex", "Magistar", "Boltor", "Bronco", "CeramicDagger"],
    ["Torid", "DualToxocyst", "DualIchor", "Miter", "Atomos"],
    ["AckAndBrunt", "Soma", "Vasto", "NamiSolo", "Burston"],
    ["Zylok", "Sibear", "Dread", "Despair", "Hate"],
    ["Dera", "Sybaris", "Cestra", "Sicarus", "Okina"],
    ["Vectis", "Stug", "Ballistica", "Destreza", "Obex"],
    ["Braton", "Lato", "Skana", "Paris", "Kunai"]
];

export const getEndlessXpChoices = (week: number, buildVersion: number): IEndlessXpChoice[] => {
    const availableHardChoices =
        buildVersion >= gameToBuildVersionInt["43.0.0"] ? hardChoices : hardChoices.filter((_, index) => index != 7);
    return [
        { Category: "EXC_NORMAL", Choices: normalChoices[week % normalChoices.length] },
        { Category: "EXC_HARD", Choices: availableHardChoices[week % availableHardChoices.length] }
    ];
};

export const isCompatibleEndlessXpSchedule = (
    entry: NonNullable<IWorldState["EndlessXpSchedule"]>[number],
    buildVersion: number
): boolean => {
    const normal = new Set(normalChoices.flat());
    const hard = new Set(
        (buildVersion >= gameToBuildVersionInt["43.0.0"]
            ? hardChoices
            : hardChoices.filter((_, index) => index != 7)
        ).flat()
    );
    const choices = entry.CategoryChoices;
    return (
        Array.isArray(choices) &&
        choices.length == 2 &&
        choices.some(
            choice =>
                choice.Category == "EXC_NORMAL" &&
                Array.isArray(choice.Choices) &&
                choice.Choices.length == 3 &&
                choice.Choices.every(item => normal.has(item))
        ) &&
        choices.some(
            choice =>
                choice.Category == "EXC_HARD" &&
                Array.isArray(choice.Choices) &&
                choice.Choices.length == 5 &&
                choice.Choices.every(item => hard.has(item))
        )
    );
};
