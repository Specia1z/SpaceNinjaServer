#!/bin/sh
set -eu

# The Web container uses the internal Compose network; port 6688 is never published to the host.
if [ ! -f conf/irc_config.json ]; then
    printf '{"mgmt_loopback_only":false}\n' > conf/irc_config.json
else
    tmp=$(mktemp conf/irc_config.json.XXXXXX)
    jq '.mgmt_loopback_only = false' conf/irc_config.json > "$tmp"
    chmod 644 "$tmp"
    mv "$tmp" conf/irc_config.json
fi

exec stdbuf -oL -eL ./warframe-irc-server
