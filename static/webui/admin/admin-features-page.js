(() => {
    const root = document.getElementById("admin-features-route");
    if (!root) return;

    const find = selector => root.querySelector(selector);
    const defaultSettings = {
        enabled: false,
        sender: "PlayWF",
        subject: "Welcome to PlayWF",
        body: "Welcome to PlayWF, Tenno! Thank you for joining us. Your starter rewards are attached to this message.",
        icon: "/Lotus/Interface/Icons/Npcs/Lotus_d.png",
        rewards: [{ ItemType: "PremiumCredits", ItemCount: 200 }]
    };
    let settings = structuredClone(defaultSettings);

    const showAccessDenied = () => {
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.remove("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.add("d-none"));
    };

    const showAdminContent = () => {
        root.querySelectorAll(".admin-hide").forEach(element => element.classList.add("d-none"));
        root.querySelectorAll(".admin-show").forEach(element => element.classList.remove("d-none"));
    };

    const renderRewards = () => {
        const list = find("#admin-feature-rewards");
        const empty = find("#admin-feature-rewards-empty");
        list.replaceChildren();
        empty.classList.toggle("d-none", settings.rewards.length > 0);

        settings.rewards.forEach((reward, index) => {
            const row = document.createElement("div");
            row.className = "admin-feature-reward-row";

            const itemField = document.createElement("div");
            itemField.className = "admin-features-field admin-feature-reward-item";
            const itemLabel = document.createElement("label");
            itemLabel.className = "form-label";
            itemLabel.htmlFor = `admin-feature-reward-item-${index}`;
            itemLabel.textContent = loc("admin_featureRewardType");
            const itemInput = document.createElement("input");
            itemInput.className = "form-control font-monospace";
            itemInput.id = `admin-feature-reward-item-${index}`;
            itemInput.value = reward.ItemType;
            itemInput.placeholder = loc("admin_featureRewardTypePlaceholder");
            itemInput.required = true;
            const syncItemType = () => {
                reward.ItemType = itemInput.value;
            };
            itemInput.addEventListener("input", syncItemType);
            itemInput.addEventListener("change", syncItemType);
            itemField.append(itemLabel, itemInput);

            const quantityField = document.createElement("div");
            quantityField.className = "admin-features-field admin-feature-reward-quantity";
            const quantityLabel = document.createElement("label");
            quantityLabel.className = "form-label";
            quantityLabel.htmlFor = `admin-feature-reward-quantity-${index}`;
            quantityLabel.textContent = loc("admin_featureRewardQuantity");
            const quantityInput = document.createElement("input");
            quantityInput.className = "form-control";
            quantityInput.id = `admin-feature-reward-quantity-${index}`;
            quantityInput.type = "number";
            quantityInput.min = "1";
            quantityInput.max = "999999999";
            quantityInput.step = "1";
            quantityInput.value = String(reward.ItemCount);
            quantityInput.required = true;
            quantityInput.addEventListener("input", () => {
                reward.ItemCount = Number(quantityInput.value);
            });
            quantityField.append(quantityLabel, quantityInput);

            const remove = document.createElement("button");
            remove.className = "btn btn-sm btn-outline-danger admin-feature-reward-remove";
            remove.type = "button";
            remove.title = loc("admin_featureRemoveReward");
            remove.setAttribute("aria-label", loc("admin_featureRemoveReward"));
            remove.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
            remove.addEventListener("click", () => {
                settings.rewards.splice(index, 1);
                renderRewards();
            });

            row.append(itemField, quantityField, remove);
            list.append(row);
            window.adminDataPage?.setupItemPicker(itemInput.id);
        });
    };

    const applySettings = value => {
        settings = {
            ...structuredClone(defaultSettings),
            ...(value ?? {}),
            rewards: (value?.rewards ?? defaultSettings.rewards).map(reward => ({ ...reward }))
        };
        find("#admin-feature-welcome-enabled").checked = settings.enabled === true;
        find("#admin-feature-welcome-sender").value = settings.sender;
        find("#admin-feature-welcome-subject").value = settings.subject;
        find("#admin-feature-welcome-body").value = settings.body;
        find("#admin-feature-welcome-icon").value = settings.icon;
        renderRewards();
    };

    const collectSettings = () => ({
        enabled: find("#admin-feature-welcome-enabled").checked,
        sender: find("#admin-feature-welcome-sender").value.trim(),
        subject: find("#admin-feature-welcome-subject").value.trim(),
        body: find("#admin-feature-welcome-body").value,
        icon: find("#admin-feature-welcome-icon").value.trim(),
        rewards: settings.rewards.map(reward => ({
            ItemType: reward.ItemType.trim(),
            ItemCount: Number(reward.ItemCount)
        }))
    });

    const showNotice = (message, variant) => {
        const notice = find("#admin-feature-notice");
        notice.className = `alert alert-${variant}`;
        notice.textContent = message;
    };

    const save = async event => {
        event.preventDefault();
        const payload = collectSettings();
        if (
            payload.rewards.some(
                reward => !reward.ItemType || !Number.isSafeInteger(reward.ItemCount) || reward.ItemCount < 1
            )
        ) {
            showNotice(loc("admin_featureRewardInvalid"), "danger");
            return;
        }
        const button = find("#admin-feature-save");
        button.disabled = true;
        try {
            const response = await window.adminFeaturesApi.save(payload);
            applySettings(response.newAccountWelcome);
            showNotice(loc("admin_featureSaved"), "success");
        } catch (error) {
            showNotice(error.responseText || loc("admin_featureSaveFailed"), "danger");
        } finally {
            button.disabled = false;
        }
    };

    find("#admin-new-account-welcome-form").addEventListener("submit", event => void save(event));
    find("#admin-feature-add-reward").addEventListener("click", () => {
        settings.rewards.push({ ItemType: "", ItemCount: 1 });
        renderRewards();
    });
    find("#admin-feature-reset").addEventListener("click", () => applySettings(defaultSettings));

    single.getRoute("/webui/admin-features").on("beforeload", () => {
        void awaitAuthz().then(async () => {
            try {
                const response = await window.adminFeaturesApi.get();
                showAdminContent();
                await window.adminItemCatalog.load(window.lang);
                applySettings(response.newAccountWelcome);
            } catch (error) {
                showAccessDenied();
                if (error?.responseText) toast(error.responseText, "danger");
            }
        });
    });
})();
