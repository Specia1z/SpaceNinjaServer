export interface IConquestScoreInput {
    ConquestCompleted: number;
    ConquestEquipmentSuggestionsFulfilled?: number;
    ConquestEquipmentSuggestionsFulfilledBitfield?: number;
    ConquestHardModeActive?: number;
    ConquestPersonalModifiersActive?: number;
}

const countSetBits = (value: number): number => {
    let count = 0;
    for (let bits = value >>> 0; bits != 0; bits >>>= 1) count += bits & 1;
    return count;
};

export const getConquestMissionScore = (rewardInfo: IConquestScoreInput): number => {
    let score = 1;
    if (rewardInfo.ConquestHardModeActive === 1) score += 3;

    if (rewardInfo.ConquestPersonalModifiersActive !== undefined) score += rewardInfo.ConquestPersonalModifiersActive;
    const equipmentSuggestionsFulfilled =
        rewardInfo.ConquestEquipmentSuggestionsFulfilled ??
        (rewardInfo.ConquestEquipmentSuggestionsFulfilledBitfield === undefined
            ? undefined
            : countSetBits(rewardInfo.ConquestEquipmentSuggestionsFulfilledBitfield));
    if (equipmentSuggestionsFulfilled !== undefined) score += equipmentSuggestionsFulfilled;

    score *= rewardInfo.ConquestCompleted + 1;

    if (rewardInfo.ConquestCompleted == 2 && rewardInfo.ConquestHardModeActive === 1) score += 1;
    return score;
};
