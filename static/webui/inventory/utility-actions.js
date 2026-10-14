async function doQuestUpdate(operation, itemType) {
    await revalidateAuthz();
    await new Promise(resolve => {
        $.post({
            url: "/custom/manageQuests?" + window.authz + "&operation=" + operation + "&itemType=" + itemType,
            contentType: "application/json"
        })
            .then(function (didAnything) {
                if (didAnything) updateInventory();
                else toast(loc("code_nothingToDo"));
            })
            .always(() => resolve());
    });
}

async function doBulkQuestUpdate(operation) {
    await revalidateAuthz();
    await new Promise(resolve => {
        $.post({
            url: "/custom/manageQuests?" + window.authz + "&operation=" + operation,
            contentType: "application/json"
        })
            .then(function (didAnything) {
                if (didAnything) updateInventory();
                else toast(loc("code_nothingToDo"));
            })
            .always(() => resolve());
    });
}

function setBooster(ItemType, ExpiryDate) {
    revalidateAuthz().then(() => {
        $.post({
            url: "/custom/setBooster?" + window.authz,
            contentType: "application/json",
            data: JSON.stringify([{ ItemType, ExpiryDate }])
        }).done(function (newBoosters) {
            inventory_data.Boosters = newBoosters;
            populateInventoryRoute();
        });
    });
}

function doAcquireBooster() {
    const uniqueName = getKey(document.getElementById("acquire-type-Boosters"));
    if (!uniqueName) {
        $("#acquire-type-Boosters").addClass("is-invalid").focus();
        return;
    }
    setBooster(uniqueName, Math.floor(Date.now() / 1000 + 3 * 24 * 60 * 60));
    document.getElementById("acquire-type-Boosters").value = "";
}

function doChangeBoosterExpiry(ItemType, ExpiryDateInput) {
    const ExpiryDate = Math.floor(new Date(ExpiryDateInput.value).getTime() / 1000);
    if (isNaN(ExpiryDate)) {
        $(ExpiryDateInput).addClass("is-invalid").focus();
        return;
    }
    setBooster(ItemType, ExpiryDate);
}

function formatDatetime(fmt, date) {
    if (typeof date === "number") date = new Date(date);
    return fmt.replace(/(%[yY]|%m|%[Dd]|%H|%h|%M|%[Ss]|%[Pp])/g, match => {
        switch (match) {
            case "%Y":
                return date.getFullYear().toString();
            case "%y":
                return date.getFullYear().toString().slice(-2);
            case "%m":
                return (date.getMonth() + 1).toString().padStart(2, "0");
            case "%D":
            case "%d":
                return date.getDate().toString().padStart(2, "0");
            case "%H":
                return date.getHours().toString().padStart(2, "0");
            case "%h":
                return (date.getHours() % 12).toString().padStart(2, "0");
            case "%M":
                return date.getMinutes().toString().padStart(2, "0");
            case "%S":
            case "%s":
                return date.getSeconds().toString().padStart(2, "0");
            case "%P":
            case "%p":
                return date.getHours() < 12 ? "am" : "pm";
            default:
                return match;
        }
    });
}
