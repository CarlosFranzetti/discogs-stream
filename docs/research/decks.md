# Decks mode research: DJ platter, mixer conventions, browser feasibility

Scope: research only. No files in /home/user/discogs-stream were edited.
Budget used: 8 searches, 5 page reads (plus one local grep of a saved scrape of the YouTube API reference, which is not a web read).

Confidence tags: [SRC] = read in a source this session. [EXC] = seen only as a search excerpt. [GK] = general knowledge, not confirmed here. "not confirmed" = not established.

---

## 1. How DJ software models the platter

- [SRC] Mixxx (DDJ-SX mapping, manual 2.5): the jog wheel has two zones. The platter (top) does **scratching when Vinyl mode is on** and **pitch bend when Vinyl mode is off**. The side ring (edge) **always pitch-bends**. SHIFT+platter and SHIFT+side use a sensitivity multiplier (`jogwheelShiftMultiplier`).
- [EXC] Mixxx forum: with vinyl mode off, touching either the surface or the edge only pitch-bends; the rubber edge pitch-bends when touched. VirtualDJ forum: "in Vinyl mode, using the outer part of the jog to pitch bend a track will temporarily alter its key too."
- [SRC] Mixxx DDJ-SX: the VINYL button toggles vinyl (scratch) mode per deck. The jog wheel has a separate "GRID ADJUST" hold mode, and a "touch/rotate" mode that adjusts the beat grid. Those are hold-to-modify modes, not default playback.
- [GK] A full platter revolution at 33 1/3 rpm = 60/33.33 = **1.8 s**. In a vinyl-mode model, one revolution maps to 1.8 s of audio at 1.0x. The position marker is drawn at `(playbackSeconds mod 1.8) / 1.8 * 360` degrees. This is arithmetic, not a sourced claim.
- [SRC] Mixxx DDJ-SX tempo: the TEMPO slider range is a setting (`rateRange`). SHIFT+KEYLOCK doubles the range step by step until 100%, then resets. A long press of KEYLOCK resets pitch/tempo to 0. A "CUE" press sets or jumps to the cue point. "PLAY/PAUSE" held while playing starts a brake effect; release pauses. These are the cue, tempo-reset and brake conventions.
- [GK] Typical pitch ranges on hardware: +/-8%, +/-16%, +/-50%, plus "wide" modes. Fader resolution is typically 10-bit or more on hardware. Not confirmed here.
- [GK] Hot cue = a stored position set and recalled by a pad. Tempo reset = return the rate to 1.0 (Mixxx does this on a long press of KEYLOCK).
- Reference apps: Serato DJ, rekordbox, Traktor and djay were not read this session. Mixxx (manual, forum) and VirtualDJ forum excerpts are the only DJ-software sources here.

## 2. Mixer conventions

- **Crossfader curves** [SRC] (math.stackexchange 4621, answer by Keith Irwin): a constant-power curve is valid if f(x)^2 + f(1-x)^2 = 1. The answer's family:
  - Constant power, n=0: `f(x) = cos(pi/2 * x)`, and the other channel is `f(1-x)`.
  - General sharp/smooth family: `f(x) = cos(pi/4 * ((2x-1)^(2n+1) + 1))`. n=1 is "slow fade", n=3 "slow cut", n=10 "fast cut" (the answer's labels). The mid plateau is about 0.707 (1/sqrt(2)), and the outer edge reaches 1 on one side and 0 on the other. Checked by hand: x=0 gives 1, x=0.5 gives cos(pi/4) = 0.707, x=1 gives 0.
  - Linear (general knowledge, consistent with the answer's "Intermediate"): `A = x`, `B = 1-x`. Not constant power: the centre sum of power is 0.5 (-3 dB), so the mix sounds dipped.
  - The question (math SE) notes "Transition" and "Dipped" curves exist, with no formula confirmed in the thread for dipped beyond a suggestion of `1-(x-1)^2`. Not confirmed as a real mixer curve.
- **Mixxx** [SRC] exposes a "Crossfader curve" front-panel control, and a crossfader assign per deck (left A, right B, THRU centre).
- **Channel fader**: deck volume. **TRIM**: gain before EQ. **EQ HIGH/MID/LOW**: 3-band EQ, with a filter/kill on the DJ hardware. Mixxx maps these to deck EQ/filter [SRC].
- **Headphone cue (PFL)** [SRC]: CUE toggles pre-fader listen per deck. HEADPHONES MIX selects cue vs main. Master cue toggles, and split cue sends cue to headphones and main to the output. This needs a second audio output.
- **Why pre-listen is hard in a browser** [SRC: Andy Gallagher blog, "iOS still does not support having multiple simultaneous audio outputs"]. Routing two outputs needs `AudioContext.setSinkId` (MDN link cited) and the browser and OS must support it. Not confirmed for every browser. Desktop Chrome supports `setSinkId`; treat per-deck headphone cue as a later feature.

## 3. Browser feasibility

### 3a. Web Audio on a cross-origin `<audio>`
- [SRC] WebAudio/web-audio-api issue 2453: per the spec's security section, a `MediaElementAudioSourceNode` **outputs zeroes** for cross-origin media that is not CORS-enabled. The element still plays. Calling `createMediaElementSource` on such an element silences it unless it is connected elsewhere (the reporter's description; the Chromium issue 41168658 excerpt says audio stops when `createMediaElementSource` is called and resumes when the source is connected to the destination).
- [EXC] StackOverflow excerpt: fix is to set `crossorigin="anonymous"` on the element **and** the server must send `Access-Control-Allow-Origin`. The reporter notes some hosts do not send the header for media responses.
- [SRC] Issue 2453 also says there is no built-in way to detect CORS restriction on a media element. Proposal to expose a CORS status on the element is open (ExternalDependency label; not resolved as of the read).
- **Practical answer**: the EQ/filter chain works **only** if the stream URL returns `Access-Control-Allow-Origin` for the app origin and the element is created with `crossOrigin`. Without it, the Web Audio branch is silent. Plain `<audio>` `volume`, `playbackRate` and `preservesPitch` are element properties, not Web Audio, so they are not blocked by CORS [GK; the element continues to play when not routed; the 2453 issue confirms audio is not silenced at the element level].
- **Action**: test the actual googlevideo / Invidious / yt-dlp stream URLs for `Access-Control-Allow-Origin` before designing around the EQ. Not confirmed for any specific host.

### 3b. `HTMLMediaElement.playbackRate`
- [EXC, MDN] `playbackRate` is the element's rate; `preservesPitch` (default true) can be set false for turntable pitch. The app already does this.
- [EXC, SO] Firefox clamps the effective rate to **0.0625 to 16.0** (per an old StackOverflow answer citing Firefox source). Chrome range not confirmed here, but the same order of magnitude is expected [GK].
- [SRC, Andy Gallagher] "Naive" negative `playbackRate` is "only supported in some WebKit-based browsers". Chrome users are out of luck.
- [EXC, MDN compat] Negative `playbackRate` (reverse): Safari full support; Chrome, Edge, Firefox, Opera listed as **No support**. A caniuse excerpt lists Chrome version ranges with support, but the table text is ambiguous. **Reverse playback on the `<audio>` engine: not confirmed for Chrome/Firefox. Assume unsupported.**
- [EXC, iodigital] `AudioBufferSourceNode.playbackRate = -2` "won't work" (Chrome).
- Also [EXC] the YouTube iframe rounds unsupported rates toward 1 (already established).

### 3c. Scratching in a browser
- [EXC, MDN] `AudioBufferSourceNode.playbackRate` works for positive rates after `decodeAudioData`. The MDN sample sets `source.playbackRate.value` while playing.
- [SRC, Andy Gallagher] Reverse playback is built by reversing the channel data of a decoded `AudioBuffer` and tracking position. Position tracking via `currentTime` is too imprecise for a scratch; he uses an extra channel with the playback percentage read through an `AnalyserNode`.
- [EXC, iodigital "Scratching the web"] Decodes with `fetch` -> `decodeAudioData` -> `AudioBufferSourceNode`, and reverses by swapping in a reversed buffer and starting at `duration - timePlayed`.
- **Realism for streamed audio**: decoding requires fetching the whole stream with CORS. Memory cost: a 4-minute stereo track at 44.1 kHz float32 = 240 * 44100 * 2 * 4 bytes = **about 85 MB** per deck. Not confirmed whether googlevideo/Invidious URLs allow CORS fetches from a browser; assume not until tested.
- [GK] `AudioWorklet` can do sample-accurate scratch on a decoded buffer, but it has the same CORS and decode constraints. Not researched beyond general knowledge.
- [GK] Seek-based "scratch" on an `<audio>` or iframe (repeated `currentTime` writes) causes audible clicks and cannot reverse smoothly. The iframe cannot be seeked fast enough for a scratch.

### 3d. Trackpad input
- [EXC, MDN WheelEvent] `deltaMode` is baseline (all major browsers). Two-finger trackpad scroll produces `wheel` events, not pointer events. `deltaX` and `deltaY` are in pixels on macOS trackpads (deltaMode 0) [GK; the deltaMode value for trackpads was not read directly].
- [EXC, MDN MouseEvent.ctrlKey + tigerabrodi blog] **Pinch-to-zoom arrives as a `wheel` event with `ctrlKey === true`**, with small `deltaY` values (about 0.5 to 3). Ctrl+mouse wheel also sets `ctrlKey`, with large deltas. Distinguish by `ctrlKey` (or `metaKey`), not by delta size. `deltaX` is ~0 for pinch.
- [EXC] The trackpad and mouse produce identical `wheel` events; there is no "trackpad" flag. Clamp deltas to tune feel.
- [GK] Momentum/inertia: macOS sends momentum `wheel` events after the fingers lift, so a scroll-based nudge keeps moving. Not confirmed here; test on the target trackpad.
- [GK] Pointer Events: a trackpad tap-drag or click-drag produces `pointerdown/move/up`. Use `setPointerCapture` to keep tracking outside the element. `requestPointerLock` gives unbounded motion but needs a user gesture and an Esc exit. Not confirmed in a source read.
- [GK] Safari gesture events (`gesturestart/change/end`, with `scale` and `rotation`) exist only in Safari. Not confirmed this session; treat as Safari-only.
- **Mapping**: edge = two-finger scroll/drag at radius > ~0.8 of the platter = nudge (pitch bend, `deltaY` to rate offset). Top = pointer drag inside the platter = scratch (angular velocity from `pointer` vectors: `omega = (x*dy - y*dx) / r^2`, which drives the playback position). Pinch (`ctrlKey` wheel) is free to map to a fader or zoom. [GK for the formula]

### 3e. Two YouTube iframe players at once
- [SRC, YouTube iframe API reference, read from a saved copy] `player.setVolume(volume)` takes an integer 0 to 100. `getVolume()` returns 0 to 100. `mute()` / `unMute()` / `isMuted()` exist.
- [SRC] `setPlaybackRate(suggestedRate)`: rounds to the nearest supported value **toward 1** (already established). `getAvailablePlaybackRates()` returns the valid set for the cued or playing video. `onPlaybackRateChange` fires only on actual changes.
- [EXC, SitePoint/SO] Controlling several players' volume from JS via `setVolume` is common; no documented limit on the number of iframe players was found.
- [GK] Autoplay: the browser requires a user gesture before unmuted audio starts. Once the user has interacted, a second player started from a gesture usually plays. Not confirmed here.
- [GK] Two iframes = two separate audio pipelines. They cannot be routed through Web Audio (cross-origin iframe), so the EQ, filter and crossfader curve cannot apply to iframe audio. Mixing is done by per-player `setVolume` only.
- **YouTube terms of service**: not researched in this session (no budget). **Not confirmed.** Before shipping any overlapping playback or fader-driven mixing, read the YouTube Terms and the IFrame API terms. Note the app already plays one iframe; two overlapping iframes need the same review.

### 3f. Existing browser DJ apps mixing YouTube
- [EXC] GitHub topic "dj" lists a repository described as "a sleek DJ interface for mixing two YouTube videos side by side", built with vanilla HTML/CSS/JS. Not opened; pitch handling not confirmed.
- [EXC] Reddit r/linuxaudio: a browser open-source DJ mixer seeking "key-lock" DSP help. Indicates key-lock is an open problem for browser DJ tools. Not opened.
- [EXC] GitHub topic "auto-dj": "explainable automatic DJ mixing in the browser" (Web Audio + Python beat analysis). Not opened.
- YouDJ and you.dj were named in the brief but not searched. **Not confirmed** how they handle pitch.

## 4. Recommended architecture (for a first version)

1. **Both engines (iframe and `<audio>`)**: transport (play, pause, seek by cue point), per-deck channel fader via `setVolume` (0-100) or `audio.volume`, the crossfader via computed per-deck gains (constant-power `cos(pi/2 x)`), mute/cue as state only, and tempo-reset to 1.0.
2. **`<audio>` engine only**: per-deck pitch via `playbackRate` with `preservesPitch = false` (+/-8% slider, then wider ranges). Keep the +/-8% range for pitch fader; the platter nudge (edge) also needs this engine, because the iframe rounds small changes to 1.
3. **`<audio>` engine only, if CORS allows**: EQ and filter via `createMediaElementSource` (3-band EQ chain). Check the stream's `Access-Control-Allow-Origin` first; if absent, disable EQ on that deck and show a notice.
4. **Trackpad nudge (edge, `<audio>` engine)**: wheel `deltaY` (ignore `ctrlKey` pinch) to a temporary rate offset, returning to the set pitch on release. Works on the iframe only as a seek-based approximation, so leave it off there.
5. **Scratch (platter top)**: leave out of v1. It needs decoded buffers (about 85 MB per 4-minute deck), reversed buffers, and CORS fetch of the stream, none of which is confirmed. Reverse playback on `<audio>` is unsupported in Chrome and Firefox.
6. **Iframe engine**: keep the existing single-player flow. Two-deck overlap via iframe is a separate decision pending the YouTube terms review.
7. **Crossfader**: constant-power curve applied to per-deck gain nodes (Web Audio path) or to `volume` values (iframe path). Sharp "cut" curves can come later via the n-family formula.
8. **Platter visual**: rotate a marker by `(position mod 1.8 s) / 1.8 s` (33 1/3 rpm). Draw it from the time update, not from the pointer.
9. **Input**: Pointer Events with `setPointerCapture` on the platter for scratch/drag; wheel with `preventDefault` for nudge; ignore `ctrlKey` wheels.
10. **Not in v1**: reverse playback, true scratch, headphone pre-listen (needs `setSinkId` and a second output), key-lock, and the iframe-to-Web-Audio EQ path (not possible).
11. **Test first** (before any build): (a) CORS headers on the actual stream URLs, (b) Chrome and Safari `playbackRate` range and `preservesPitch` behaviour, (c) trackpad `wheel` deltas and momentum on the target laptop.

## 5. Source URLs

Read in full or in part this session:
- https://manual.mixxx.org/2.5/en/hardware/controllers/pioneer_ddj_sx
- https://math.stackexchange.com/questions/4621/simple-formula-for-curve-of-dj-crossfader-volume-dipped
- https://www.andy-gallagher.com/blog/web-audio-madness-negative-playback-rate/
- https://github.com/WebAudio/web-audio-api/issues/2453
- https://developers.google.com/youtube/iframe_api_reference (read via a saved copy of the scrape; the grep covered playback rate and volume sections only)

Seen as search excerpts only (not opened):
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch
- https://caniuse.com/mdn-api_htmlmediaelement_playbackrate_negative_values
- https://stackoverflow.com/questions/30970920/html5-video-what-is-the-maximum-playback-rate
- https://github.com/MicrosoftEdge/WebView2Feedback/issues/2307
- https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_manipulation
- https://stackoverflow.com/questions/59016637/the-htmlmediaelement-passed-to-createmediaelementsource-has-a-cross-origin-resou
- https://issues.chromium.org/41168658
- https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event
- https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent
- https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/ctrlKey
- https://tigerabrodi.blog/how-to-handle-trackpad-pinch-to-zoom-vs-two-finger-scroll-in-javascript-canvas-apps
- https://stackoverflow.com/questions/74312612/trackpad-pinch-causes-wheel-js-event-with-ctrlkey-true-how-to-tell-if-the-u
- https://mixxx.discourse.group/t/touch-wheel-plays-only-while-touching-stops-when-let-go-wrong-way-round/26409
- https://virtualdj.com/forums/184368/Old_versions/Pitch_bending_with_touch_jogwheel.html
- https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/playbackRate
- https://techhub.iodigital.com/articles/scratching-the-web
- https://www.reddit.com/r/linuxaudio/comments/1x3qx1d/browserbased_opensource_dj_mixer_for_linux_and/
- https://github.com/topics/dj?l=javascript&o=asc&s=stars
- https://github.com/topics/auto-dj
- https://www.ranecommercial.com/legacy/note146.html
- https://stackoverflow.com/questions/77926730/how-to-execute-volume-changes-on-a-youtube-iframe-from-javascript
