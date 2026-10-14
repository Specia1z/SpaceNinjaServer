window.adminUsersApi = {
    list: () => $.get("/custom/getRegisteredLosers?" + window.authz),
    broadcastInbox: payload =>
        $.ajax({
            url: "/custom/createMessage?" + window.authz,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(payload)
        }),
    async announceIrc(message) {
        const response = await fetch("/custom/admin/irc-announcement?" + window.authz, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message })
        });
        if (!response.ok) {
            const error = new Error(response.status === 502 ? "unavailable" : "failed");
            error.status = response.status;
            throw error;
        }
    }
};
