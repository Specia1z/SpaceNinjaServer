#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

if [ ! -f config.json ]; then
    cp config-vanilla.json config.json
fi

./node publicExportUpdater.mjs --auto || true
exec ./node --enable-source-maps build/src/index.js "$@"
