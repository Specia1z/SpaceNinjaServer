#!/bin/sh
set -eu

# The Web container uses the internal Compose network; port 6688 is never published to the host.
if [ ! -f conf/irc_config.json ]; then
    printf '{"mgmt_loopback_only":false}\n' > conf/irc_config.json
else
    if jq -e 'type == "object"' conf/irc_config.json >/dev/null 2>&1; then
        if tmp=$(mktemp conf/irc_config.json.XXXXXX); then
            if jq '.mgmt_loopback_only = false' conf/irc_config.json > "$tmp" &&
                chmod 644 "$tmp" && mv "$tmp" conf/irc_config.json; then
                :
            else
                rm -f "$tmp" || true
                echo 'Could not update IRC management config; starting IRC with its existing settings.' >&2
            fi
        else
            echo 'Could not stage IRC management config; starting IRC with its existing settings.' >&2
        fi
    else
        # The IRC server would discard invalid JSON, restoring its loopback-only management default.
        if ! printf '{"mgmt_loopback_only":false}\n' > conf/irc_config.json; then
            echo 'Invalid IRC config could not be repaired; management will remain loopback-only.' >&2
        fi
    fi
fi

exec stdbuf -oL -eL ./warframe-irc-server
