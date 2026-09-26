(function (root) {
    function splitLines(value) {
        return value
            .replaceAll("\r", "")
            .split("\n")
            .map(line => line.trim())
            .filter(Boolean);
    }

    function preview(patches) {
        const lines = [];
        patches.forEach(patch => {
            if (patch.enabled === false || !patch.targets.length) return;
            if (patch.name) lines.push(`# Server patch: ${patch.name.replaceAll(/[\r\n]/g, " ")}`);
            lines.push(patch.targets.join(" & "));
            lines.push(...patch.operations);
            lines.push("");
        });
        return lines.join("\n").trimEnd();
    }

    function parse(value, translate) {
        const patches = [];
        let current;
        let targetContinuation = false;
        for (const rawLine of value.replaceAll("\r", "").split("\n")) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) continue;

            const isTarget = line.startsWith("/") || line.startsWith(">");
            const isTargetContinuation = line.startsWith("&");
            if ((isTarget && targetContinuation) || (isTargetContinuation && current && !current.operations.length)) {
                if (!current) throw new Error(translate("metadataPatches_importMissingTarget"));
                const targetText = isTargetContinuation ? line.slice(1).trim() : line;
                const targets = targetText
                    .split("&")
                    .map(target => target.trim())
                    .filter(Boolean);
                if (!targets.length || targets.some(target => !target.startsWith("/"))) {
                    throw new Error(translate("metadataPatches_importInvalidTarget"));
                }
                current.targets.push(...targets);
                targetContinuation = targetText.endsWith("&");
            } else if (isTarget) {
                const targetText = line.startsWith(">") ? line.slice(1).trim() : line;
                const targets = targetText
                    .split("&")
                    .map(target => target.trim())
                    .filter(Boolean);
                if (!targets.length || targets.some(target => !target.startsWith("/"))) {
                    throw new Error(translate("metadataPatches_importInvalidTarget"));
                }
                current = { name: "", enabled: true, targets, operations: [] };
                patches.push(current);
                targetContinuation = targetText.endsWith("&");
            } else if (current) {
                targetContinuation = false;
                current.operations.push(line);
            } else {
                throw new Error(translate("metadataPatches_importMissingTarget"));
            }
        }
        return patches;
    }

    root.metadataPatchText = { splitLines, preview, parse };
})(globalThis);
