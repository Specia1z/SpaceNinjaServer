const importInventoryEditor = document.getElementById("import-inventory");
const importForm = document.getElementById("import-form");

function setImportSample(key) {
    const sample = window.webuiImportSamples?.[key];
    if (!sample || !importInventoryEditor) return;

    importInventoryEditor.value = JSON.stringify(sample, null, 2);
    importInventoryEditor.dispatchEvent(new Event("input", { bubbles: true }));
    importInventoryEditor.focus();

    document.querySelectorAll("[data-import-sample]").forEach(button => {
        const selected = button.dataset.importSample == key;
        button.setAttribute("aria-pressed", String(selected));
    });
}

async function doImport() {
    let inventory;
    try {
        inventory = JSON.parse(importInventoryEditor.value);
    } catch (error) {
        toast(error.message, "danger");
        importInventoryEditor.focus();
        return;
    }

    try {
        await revalidateAuthz();
        const error = await $.post({
            url: "/custom/import?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify({ inventory })
        });

        if (error) {
            toast(error == "noKnownKey" ? loc("code_nothingToDo") : error, "danger");
        } else {
            toast(loc("code_succImport"), "success");
        }
        updateInventory();
    } catch (error) {
        toast(error.responseText ?? error.message ?? String(error), "danger");
        console.error(error);
    }
}

async function doExport() {
    try {
        await revalidateAuthz();
        const data = await $.get("/custom/export?" + window.authz);
        const blob = new Blob([JSON.stringify(data, null, "\t")], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sns-export-${window.accountId}.json`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
        toast(error.responseText ?? error.message ?? String(error), "danger");
        console.error(error);
    }
}

importForm?.addEventListener("submit", event => {
    event.preventDefault();
    void doImport();
});

document.querySelector('[data-import-action="export"]')?.addEventListener("click", () => {
    void doExport();
});

document.querySelectorAll("[data-import-sample]").forEach(button => {
    button.addEventListener("click", () => setImportSample(button.dataset.importSample));
});

importInventoryEditor?.addEventListener("input", () => {
    document.querySelectorAll('[data-import-sample][aria-pressed="true"]').forEach(button => {
        button.setAttribute("aria-pressed", "false");
    });
});
