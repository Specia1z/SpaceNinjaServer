// This is specific to the PlayWF Bootstrapper: https://openwf.io/bootstrapper-manual
export interface ITunables {
    prohibit_skip_mission_start_timer?: boolean;
    prohibit_disable_profanity_filter?: boolean;
    prohibit_fov_override?: boolean;
    prohibit_freecam?: boolean;
    prohibit_teleport?: boolean;
    prohibit_scripts?: boolean;
    prohibit_local_metadata_patches?: boolean;
    disable_websocket?: boolean;
    motd?: string;
    token?: string;
    nrs?: string;
    irc?: string;
    udp_proxy_upstream?: string;
    force_native_proxy?: boolean;
    metadata_patches?: string;
    metadata_patches_revision?: string;
    store_item_rules?: string;
    client_version_status?: string;
    client_version_expected_buildlab?: string;
    client_version_popup_title?: string;
    client_version_popup_message?: string;
}
