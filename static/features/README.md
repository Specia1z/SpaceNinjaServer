# PlayWF Feature Packages

`manifest.json` declares the `.pwfpkg` files that the Bootstrapper may fetch.
The server adds an RSA-PSS/SHA-256 signature before returning the manifest to a
client; the local source file does not contain the generated signature.
Package files must be placed below this directory and must match the declared
size and SHA-256 digest.

Example:

```json
{
    "schema": 1,
    "features": [
        {
            "id": "example-feature",
            "version": "1.0.0",
            "file": "example-feature-1.0.0.pwfpkg",
            "size": 1234,
            "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            "enabled": true,
            "capabilities": ["metadata"],
            "entrypoints": ["PlayWF/features/entrypoints/install.pluto"],
            "minGameVersion": 2026001,
            "maxGameVersion": 2026999
        }
    ]
}
```

`file` is relative to this directory. Keep feature IDs and versions limited to
letters, numbers, `.`, `_`, `-`, and `+`. Set `enabled` to `false` to keep a
package declared but inactive without deleting the package file.

`minGameVersion` and `maxGameVersion` are optional inclusive numeric bounds.
The client ignores a feature outside those bounds. Each `id`/`version` pair
and each `file` path must be unique within the manifest. The server also
verifies the declared size and SHA-256 digest before serving a package.

The server exposes the manifest at `/custom/featureManifest.json` and an
enabled package at `/custom/featurePackages/:featureId/:version`.

Client defaults are managed separately from Feature Packages. Administrators
can edit them at `/webui/client-config`; clients fetch the allowlisted result
from `/custom/clientConfig.json` during startup. Do not put credentials or
private keys in the public client configuration.
