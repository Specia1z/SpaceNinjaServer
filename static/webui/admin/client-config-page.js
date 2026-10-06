(() => {
    const route = "/webui/client-config";

    single.getRoute(route).on("beforeload", () => {
        void awaitAuthz()
            .then(() => getServerConfig().then(applyServerConfig))
            .catch(error => toast(error.responseText || "Could not load client configuration.", "danger"));
    });
})();
