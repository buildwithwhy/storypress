# Memory videos (hidden rollout)

Client-rendered memory videos ship behind `STORYPRESS_VIDEO`, per the approved
spec "hidden client-side memory videos" (October 30, 2026).

- `STORYPRESS_VIDEO=true` exposes the capability in the services payload
  (`video: { enabled: true }` on `GET /api/story`). Any other value — or the
  variable unset — leaves it off. Only the exact string `true` enables it.
- With the flag off, nothing renders anywhere: the capability is a payload
  field, not a route. Enabling is an environment change, never a code change.
- The video assembles silently in the browser from the approved edition
  snapshot and delivers by download or share sheet. No server rendering, no
  storage, no AI video APIs; story content never leaves the device.
- The video manifest schema carries an optional `audioTrack` narration seam
  that v1 never fills. Self-recorded narration stays on-device when it
  arrives; AI narration and generated motion are later, separately-specced
  layers (see the spec's roadmap).
- On the paper stage, an approved keepsake shows a video action beside share
  images only when the services payload reports `video.enabled` — the section
  is absent, not disabled, when either the flag or the approval is missing.
  Rendering and delivery stay client-side; no navigation entries anywhere
  else.
