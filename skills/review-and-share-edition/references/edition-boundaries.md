# Edition boundaries

A private story contains testimony and working material. A shared edition contains only approved output. Never attach the full story JSON or transcript when someone asked to share the newspaper.

Within Storypress:
- The narrator checks the review box before export or link creation.
- Server code checks ownership and approval again before sharing.
- A saved story has an optimistic revision number; a stale revision must not overwrite another saved copy.
- A link uses an unguessable token and returns no-store/noindex responses. Anyone with the URL can read it. Noindex is not access control.
- Private edits do not alter a shared edition until the narrator explicitly updates it.
- Revoking a link clears its token and published snapshot.
- The raw recording is temporary on the device and is not part of an edition export.

A paid AI allowance is unrelated to the narrator's right to edit, save, download or print. Do not lock already created stories behind an AI quota failure.
