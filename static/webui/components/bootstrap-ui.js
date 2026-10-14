(() => {
    let modal;
    let modalInstance;
    let titleElement;
    let messageElement;
    let iconElement;
    let confirmButton;
    let cancelButton;
    let promptInput;
    let resolvePending;
    let promptMode = false;
    let pendingResult;

    const finish = result => {
        if (!resolvePending) return;
        const resolve = resolvePending;
        resolvePending = undefined;
        pendingResult = undefined;
        promptMode = false;
        promptInput?.remove();
        promptInput = undefined;
        resolve(result);
    };

    const ensureModal = () => {
        if (modal) return true;
        if (!window.bootstrap?.Modal) return false;

        modal = document.createElement("div");
        modal.className = "modal fade webui-confirm-modal";
        modal.tabIndex = -1;
        modal.setAttribute("aria-labelledby", "webui-dialog-title");
        modal.setAttribute("aria-describedby", "webui-dialog-message");
        modal.setAttribute("aria-hidden", "true");
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0 pb-0">
                        <div class="webui-confirm-icon" aria-hidden="true"><i class="bi"></i></div>
                        <h2 class="modal-title fs-5" id="webui-dialog-title"></h2>
                        <button type="button" class="btn-close ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body pt-3">
                        <p class="webui-confirm-message mb-0" id="webui-dialog-message"></p>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal"></button>
                        <button type="button" class="btn btn-danger"></button>
                    </div>
                </div>
            </div>`;
        document.body.append(modal);

        titleElement = modal.querySelector(".modal-title");
        messageElement = modal.querySelector(".webui-confirm-message");
        iconElement = modal.querySelector(".webui-confirm-icon i");
        [cancelButton, confirmButton] = modal.querySelectorAll(".modal-footer button");
        modalInstance = window.bootstrap.Modal.getOrCreateInstance(modal);
        modal.addEventListener("hidden.bs.modal", () => finish(pendingResult ?? (promptMode ? null : false)));
        confirmButton.addEventListener("click", () => {
            pendingResult = promptMode ? promptInput.value : true;
            modalInstance.hide();
        });
        modal.addEventListener("shown.bs.modal", () => {
            if (promptInput) promptInput.focus();
            else confirmButton.focus();
        });
        return true;
    };

    const confirm = ({
        title,
        message,
        confirmLabel,
        cancelLabel,
        variant = "danger",
        icon = "bi-exclamation-triangle-fill"
    }) => {
        if (!ensureModal()) {
            console.error("Bootstrap Modal is unavailable; confirmation was cancelled.");
            return Promise.resolve(false);
        }
        if (resolvePending) return Promise.resolve(false);

        const localized = key => (typeof window.loc === "function" ? window.loc(key) : key);
        const safeVariant = ["danger", "primary", "warning", "success"].includes(variant) ? variant : "danger";
        const safeIcon = /^[a-z0-9-]+$/.test(icon) ? icon : "bi-exclamation-triangle-fill";
        modal.querySelector(".btn-close").setAttribute("aria-label", localized("ui_cancel"));
        titleElement.textContent = title ?? localized("ui_confirm");
        messageElement.textContent = message ?? "";
        iconElement.className = `bi ${safeIcon}`;
        confirmButton.className = `btn btn-${safeVariant}`;
        confirmButton.textContent = confirmLabel ?? localized("ui_confirm");
        cancelButton.textContent = cancelLabel ?? localized("ui_cancel");

        return new Promise(resolve => {
            resolvePending = resolve;
            promptMode = false;
            messageElement.classList.remove("d-none");
            modalInstance.show();
        });
    };

    const prompt = ({ title, message, defaultValue = "", confirmLabel, cancelLabel }) => {
        if (!ensureModal()) {
            console.error("Bootstrap Modal is unavailable; prompt was cancelled.");
            return Promise.resolve(null);
        }
        if (resolvePending) return Promise.resolve(null);

        const localized = key => (typeof window.loc === "function" ? window.loc(key) : key);
        promptMode = true;
        titleElement.textContent = title ?? localized("ui_prompt");
        messageElement.textContent = message ?? "";
        messageElement.classList.toggle("d-none", !message);
        iconElement.className = "bi bi-pencil-square";
        modal.querySelector(".btn-close").setAttribute("aria-label", localized("ui_cancel"));
        cancelButton.textContent = cancelLabel ?? localized("ui_cancel");
        confirmButton.className = "btn btn-primary";
        confirmButton.textContent = confirmLabel ?? localized("ui_save");
        promptInput = document.createElement("input");
        promptInput.className = "form-control mt-3 webui-prompt-input";
        promptInput.type = "text";
        promptInput.value = defaultValue;
        promptInput.setAttribute("aria-label", title ?? localized("ui_prompt"));
        messageElement.after(promptInput);
        promptInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                confirmButton.click();
            }
        });

        return new Promise(resolve => {
            resolvePending = resolve;
            modalInstance.show();
        });
    };

    window.webuiComponents = Object.freeze({ confirm, prompt });

    document.addEventListener("webui:translations-ready", () => {
        if (modal && !resolvePending) {
            cancelButton.textContent = window.loc("ui_cancel");
            modal.querySelector(".btn-close").setAttribute("aria-label", window.loc("ui_cancel"));
        }
    });
})();
