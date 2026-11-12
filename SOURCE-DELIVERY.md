# Source delivery through GitHub tickets

Cloudflare is no longer an active intake path for S03E01. Deliveries are announced through a GitHub Issue in the public project repository:

https://github.com/OldMetalmind/S03e01-night-status/issues/new?template=source-delivery.yml

## Required ticket contents

The ticket must include:

1. A stable delivery/package identifier.
2. One directly downloadable resource URL per source.
3. A mapping to `SRC-01` through `SRC-05`.
4. Original filenames and MIME types when known.
5. Checksums and byte sizes when available.
6. Expiry or access notes.

## Security boundary

The issue is public. Do not include:

- credentials, API keys, bearer tokens, or cookies;
- private signed URLs containing access tokens;
- original source content pasted into the issue;
- confidential product details that are not needed to identify the resource.

The resource URLs must be safe to publish and accessible without credentials. The harness downloads resources from the ticket into private local review storage, records their checksums, and does not commit the originals to either public repository.

`SRC-06` remains the live tram 3 board on the Challenge page and is not delivered through this ticket.

## Intake workflow

1. Course or sender opens a **Source delivery** ticket using the issue form.
2. Harness records the ticket number and exact issue body in the private processing log.
3. Harness downloads each mapped resource and verifies its checksum and byte size.
4. Harness preserves each original outside GitHub and updates the private source index.
5. Harness closes the ticket only after all mapped resources are accounted for; delivery problems remain open and are described in the ticket.
6. Review notes and sanitized requirements are produced privately, then the accepted requirements are published to the page.

This ticket is an intake notification, not a place to publish evidence or final requirements.
