(() => {
    const root = document.querySelector("[data-route='/webui/metadata-patches']");
    const find = selector => root.querySelector(selector);
    let patches = [];

    const normalize = patch => ({
        name: patch.name ?? "",
        enabled: patch.enabled !== false,
        targets: [...(patch.targets ?? [])],
        operations: [...(patch.operations ?? [])]
    });

    function renderPreview() {
        const compiled = metadataPatchText.preview(patches);
        find("#metadata-patches-preview").textContent = compiled || loc("metadataPatches_emptyPreview");
        find("#metadata-patches-revision").textContent = "";
    }

    function update(index, field, value) {
        patches[index][field] = value;
        renderPreview();
    }

    function move(index, delta) {
        const next = index + delta;
        if (next < 0 || next >= patches.length) return;
        [patches[index], patches[next]] = [patches[next], patches[index]];
        render();
    }

    function remove(index) {
        patches.splice(index, 1);
        render();
    }

    function createEditor(patch, index) {
        const section = document.createElement("section");
        section.className = "metadata-patch-editor";

        const header = document.createElement("div");
        header.className = "d-flex flex-wrap align-items-center gap-2 mb-3";
        const enabledWrap = document.createElement("div");
        enabledWrap.className = "form-check form-switch me-auto";
        const enabled = document.createElement("input");
        enabled.className = "form-check-input";
        enabled.type = "checkbox";
        enabled.checked = patch.enabled !== false;
        enabled.addEventListener("change", () => update(index, "enabled", enabled.checked));
        const enabledLabel = document.createElement("label");
        enabledLabel.className = "form-check-label";
        enabledLabel.textContent = loc("metadataPatches_enabled");
        enabledWrap.append(enabled, enabledLabel);
        header.append(enabledWrap);

        const actions = [
            [icons.angleUp, "metadataPatches_moveUp", () => move(index, -1), index == 0, false],
            [icons.angleDown, "metadataPatches_moveDown", () => move(index, 1), index == patches.length - 1, false],
            [icons.trash, "metadataPatches_delete", () => remove(index), false, true]
        ];
        actions.forEach(([icon, title, handler, disabled, destructive]) => {
            const button = document.createElement("button");
            button.className = `btn btn-sm ${destructive ? "btn-outline-danger" : "btn-outline-secondary"}`;
            button.type = "button";
            button.innerHTML = icon;
            button.title = loc(title);
            button.setAttribute("aria-label", loc(title));
            button.disabled = disabled;
            button.addEventListener("click", handler);
            header.append(button);
        });
        section.append(header);

        const nameLabel = document.createElement("label");
        nameLabel.className = "form-label";
        nameLabel.textContent = loc("metadataPatches_name");
        const name = document.createElement("input");
        name.className = "form-control mb-3";
        name.type = "text";
        name.maxLength = 200;
        name.value = patch.name;
        name.addEventListener("input", () => update(index, "name", name.value.trim()));
        section.append(nameLabel, name);

        const row = document.createElement("div");
        row.className = "row g-3";
        [
            ["targets", "metadataPatches_targets", "metadataPatches_targetsHint"],
            ["operations", "metadataPatches_operations", "metadataPatches_operationsHint"]
        ].forEach(([field, labelKey, hintKey]) => {
            const column = document.createElement("div");
            column.className = "col-lg-6";
            const label = document.createElement("label");
            label.className = "form-label";
            label.textContent = loc(labelKey);
            const textarea = document.createElement("textarea");
            textarea.className = "form-control";
            textarea.value = patch[field].join("\n");
            textarea.addEventListener("input", () =>
                update(index, field, metadataPatchText.splitLines(textarea.value))
            );
            const hint = document.createElement("div");
            hint.className = "form-text";
            hint.textContent = loc(hintKey);
            column.append(label, textarea, hint);
            row.append(column);
        });
        section.append(row);
        return section;
    }

    function render() {
        const list = find("#metadata-patches-list");
        list.replaceChildren();
        if (!patches.length) {
            const empty = document.createElement("p");
            empty.className = "text-body-secondary mb-0";
            empty.textContent = loc("metadataPatches_empty");
            list.append(empty);
        } else {
            patches.forEach((patch, index) => list.append(createEditor(patch, index)));
        }
        renderPreview();
    }

    async function load() {
        const data = await window.metadataPatchApi.list();
        patches = (data.patches ?? []).map(normalize);
        render();
        find("#metadata-patches-preview").textContent = data.compiled || loc("metadataPatches_emptyPreview");
        find("#metadata-patches-revision").textContent = data.revision
            ? `${loc("metadataPatches_revision")}: ${data.revision}`
            : "";
    }

    find("[data-loc='metadataPatches_add']").addEventListener("click", () => {
        patches.push({ name: "", enabled: true, targets: [], operations: [] });
        render();
        find("#metadata-patches-list .metadata-patch-editor:last-child")?.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    });
    find("[data-loc='metadataPatches_import']").addEventListener("click", () => {
        try {
            patches = metadataPatchText.parse(find("#metadata-patches-import").value, loc);
            render();
        } catch (error) {
            toast(error.message || loc("settings_changeFailed"), "danger");
        }
    });
    find("[data-loc='metadataPatches_copy']").addEventListener("click", async () => {
        const compiled = metadataPatchText.preview(patches);
        if (!compiled) {
            toast(loc("metadataPatches_emptyPreview"), "warning");
            return;
        }
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(compiled);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = compiled;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.append(textarea);
                try {
                    textarea.select();
                    if (!document.execCommand("copy")) throw new Error("copy failed");
                } finally {
                    textarea.remove();
                }
            }
            toast(loc("metadataPatches_copied"), "success");
        } catch {
            toast(loc("metadataPatches_copyFailed"), "danger");
        }
    });
    find("#metadata-patches-save").addEventListener("click", async () => {
        const invalidIndex = patches.findIndex(
            patch => !patch.targets.length || patch.targets.some(target => !target.startsWith("/"))
        );
        if (invalidIndex != -1) {
            toast(loc("metadataPatches_invalidTarget").replace("|INDEX|", String(invalidIndex + 1)), "danger");
            return;
        }
        const button = find("#metadata-patches-save");
        button.disabled = true;
        try {
            const data = await window.metadataPatchApi.save(patches);
            patches = (data.patches ?? []).map(normalize);
            render();
            find("#metadata-patches-preview").textContent = data.compiled || loc("metadataPatches_emptyPreview");
            find("#metadata-patches-revision").textContent = data.revision
                ? `${loc("metadataPatches_revision")}: ${data.revision}`
                : "";
            toast(loc("metadataPatches_saved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        } finally {
            button.disabled = false;
        }
    });

    single.getRoute("/webui/metadata-patches").on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                if (applyServerConfig(await getServerConfig())) await load();
            })
            .catch(error => toast(error.responseText || loc("settings_changeFailed"), "danger"));
    });
})();
