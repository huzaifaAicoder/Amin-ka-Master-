# Authenticated Mobile Media QA

## Automated evidence completed

The authenticated authorization, private-resource policy, PDF/video audit enum, YouTube URL parsing, and provider fallback code paths were validated by TypeScript and 30 focused security/media assertions. No Android device is attached to this environment, and iOS simulation is unavailable; native provider playback and screen-capture behavior therefore require a physical device.

## Android and iOS walkthrough

1. Open the current project in Expo Go and sign in as an enrolled Student with a course that has a published, managed, `downloadAllowed` video.
2. In the course resource list, start the managed-video download. Confirm that progress appears, then use pause, resume, and cancel once each.
3. After a completed download, open **Downloads**, verify the storage total, open the video, background the app, return, and close the viewer. Confirm that audio stops when the viewer closes and the video remains private to the app.
4. Start a second download, disable the network before completion, and confirm the app remains responsive and the incomplete file does not open as completed content. Re-enable the network and retry the download.
5. Open a YouTube Short, then an Instagram Short. Confirm that only the visible Short produces audio while swiping rapidly through three items.
6. If a provider declines inline playback, verify the native fallback says playback is unavailable, retains Short text/social actions, offers **Retry**, and permits **Share link**.
7. For Android, attempt a screenshot or screen recording in the protected offline viewer. For iOS, check the app-switcher privacy/capture behavior. Record the OS version and provider URL used with any issue.

## Expected limitations

YouTube and Instagram can deny embeds based on URL, region, login state, content owner, or provider policy. A provider refusal should show the native fallback rather than raw WebView platform errors. Native capture deterrence is platform-dependent and cannot block another physical camera.
