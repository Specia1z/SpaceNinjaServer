(() => {
    const root = document.querySelector("[data-route='/webui/pluto-scripts']");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    const state = {
        scripts: [],
        revision: "",
        dirty: false,
        busy: false
    };

    const markDirty = () => {
        state.dirty = true;
        renderStatus();
    };

    const renderStatus = () => {
        const status = find("#pluto-scripts-save-status");
        status.textContent = loc(
            state.busy ? "plutoScripts_savingStatus" : state.dirty ? "plutoScripts_unsavedStatus" : "plutoScripts_savedStatus"
        );
        find("#pluto-scripts-save").disabled = state.busy || !state.dirty;
        find("#pluto-scripts-add").disabled = state.busy;
    };

    const removeScript = index => {
        state.scripts.splice(index, 1);
        markDirty();
        render();
    };

    const render = () => {
        const list = find("#pluto-scripts-list");
        const empty = find("#pluto-scripts-empty");
        list.replaceChildren();
        empty.classList.toggle("d-none", state.scripts.length > 0);

        state.scripts.forEach((script, index) => {
            const editor = document.createElement("article");
            editor.className = "pluto-script-editor card mb-3";

            const header = document.createElement("div");
            header.className = "card-header d-flex flex-wrap align-items-center gap-2";

            const nameLabel = document.createElement("label");
            nameLabel.className = "visually-hidden";
            nameLabel.textContent = loc("plutoScripts_name");
            const name = document.createElement("input");
            name.className = "form-control font-monospace pluto-script-name";
            name.type = "text";
            name.maxLength = 128;
            name.value = script.name;
            name.placeholder = loc("plutoScripts_namePlaceholder");
            name.disabled = state.busy;
            nameLabel.htmlFor = `pluto-script-name-${index}`;
            name.id = nameLabel.htmlFor;
            name.addEventListener("input", () => {
                script.name = name.value;
                markDirty();
            });

            const enabledWrap = document.createElement("div");
            enabledWrap.className = "form-check form-switch ms-auto";
            const enabled = document.createElement("input");
            enabled.className = "form-check-input";
            enabled.type = "checkbox";
            enabled.checked = script.enabled !== false;
            enabled.disabled = state.busy;
            enabled.id = `pluto-script-enabled-${index}`;
            enabled.addEventListener("change", () => {
                script.enabled = enabled.checked;
                markDirty();
            });
            const enabledLabel = document.createElement("label");
            enabledLabel.className = "form-check-label";
            enabledLabel.htmlFor = enabled.id;
            enabledLabel.textContent = loc("plutoScripts_enabled");
            enabledWrap.append(enabled, enabledLabel);

            const remove = document.createElement("button");
            remove.className = "btn btn-sm btn-outline-danger";
            remove.type = "button";
            remove.title = loc("plutoScripts_delete");
            remove.setAttribute("aria-label", loc("plutoScripts_delete"));
            remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
            remove.disabled = state.busy;
            remove.addEventListener("click", () => removeScript(index));

            header.append(nameLabel, name, enabledWrap, remove);

            const body = document.createElement("div");
            body.className = "card-body";
            const sourceLabel = document.createElement("label");
            sourceLabel.className = "form-label";
            sourceLabel.htmlFor = `pluto-script-source-${index}`;
            sourceLabel.textContent = loc("plutoScripts_source");
            const source = document.createElement("textarea");
            source.className = "form-control font-monospace pluto-script-source";
            source.id = sourceLabel.htmlFor;
            source.rows = 18;
            source.spellcheck = false;
            source.value = script.source;
            source.disabled = state.busy;
            source.addEventListener("input", () => {
                script.source = source.value;
                markDirty();
            });
            body.append(sourceLabel, source);
            editor.append(header, body);
            list.append(editor);
        });
        renderStatus();
    };

    const load = async () => {
        const data = await window.plutoScriptsApi.list();
        state.scripts = (data.scripts ?? []).map(script => ({
            name: script.name ?? "",
            source: script.source ?? "",
            enabled: script.enabled !== false
        }));
        state.revision = data.revision ?? "";
        state.dirty = false;
        render();
    };

    find("#pluto-scripts-add").addEventListener("click", () => {
        state.scripts.push({ name: "new-script", source: "", enabled: true });
        markDirty();
        render();
        const names = root.querySelectorAll(".pluto-script-name");
        names[names.length - 1]?.focus();
    });

    find("#pluto-scripts-save").addEventListener("click", async () => {
        if (state.busy || !state.dirty) return;
        state.busy = true;
        renderStatus();
        try {
            const data = await window.plutoScriptsApi.save(state.scripts);
            state.scripts = (data.scripts ?? []).map(script => ({
                name: script.name ?? "",
                source: script.source ?? "",
                enabled: script.enabled !== false
            }));
            state.revision = data.revision ?? "";
            state.dirty = false;
            toast(loc("plutoScripts_saved"), "success");
        } catch (error) {
            toast(error.responseText || loc("settings_changeFailed"), "danger");
        } finally {
            state.busy = false;
            render();
        }
    });

    single.getRoute("/webui/pluto-scripts").on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                if (applyServerConfig(await getServerConfig())) await load();
            })
            .catch(error => toast(error.responseText || loc("settings_changeFailed"), "danger"));
    });
})();
