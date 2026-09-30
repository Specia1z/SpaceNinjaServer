(() => {
    const route = "/webui/bootstrapper-version";

    single.getRoute(route).on("beforeload", () => {
        void awaitAuthz()
            .then(async () => {
                applyServerConfig(await getServerConfig());
            })
            .catch(error => toast(error.responseText || loc("settings_changeFailed"), "danger"));
    });
})();
