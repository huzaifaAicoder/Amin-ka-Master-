# Amin Master Toolkit: Implementation Boundaries

## Vision-enabled AI Doubt Solver

Students may select an image from the library or take a photo after the operating system grants camera permission. The selected image is reduced on-device to a bounded Base64 payload and submitted only with the Student's question to the existing server-side Gemini boundary. The image is not stored in the LMS database, storage service, audit log, chat history, telemetry, or offline downloads. Gemini provider secrets remain server-only. The interface must clearly state that the response is educational guidance, not an official land-record verification or survey certification.

The existing Doubt Solver is already Student-only, preserves a local text chat history, uses a server-only Gemini key, and returns a visible fallback when the provider is unavailable. The extension must preserve these behaviors while adding an optional bounded image field; it must not add image persistence or weaken the existing Student role check.

Google's official Gemini image-understanding guidance states that inline image data counts toward a 20 MB total request limit. The application therefore limits the locally prepared image field to 3.5 million Base64 characters before combining it with the question and server instructions. Source: https://ai.google.dev/gemini-api/docs/image-understanding

## GPS perimeter estimate

The GPS tool requests foreground location only while the Student actively maps a plot. It records the perimeter points only in local screen state, calculates an approximate area on-device, and clears points when the Student resets or exits. It must disclose that GPS accuracy, device position, terrain, and path quality affect the estimate; it is not a legal boundary survey.

## Official land-record portals

The portal directory must contain a small, code-reviewed allowlist of official state government land-record URLs. The WebView must keep navigation in-app only when the target remains on the official host. Any external destination must be blocked with a native explanation rather than opened in a browser.

The initial reviewed directory uses Bihar Bhumi at `https://biharbhumi.bihar.gov.in/Biharbhumi/`, which presents itself as the Revenue Bihar gateway, and the national Department of Land Resources at `https://dolr.gov.in/en/`, which identifies itself as part of the Ministry of Rural Development. Only these hosts, including their subdomains where required by an official portal, should be permitted in the in-app browser.

## Compass

The compass uses the native magnetometer only on Android/iOS after checking availability. The screen must explain that magnetic interference and calibration affect its indicated heading, and it must show a graceful unavailable state on web or devices without the sensor.

## Additive navigation

The Student dashboard already presents the AI Doubt Solver, AI Quiz, and Study Coach as independent shortcut cards. The Student Account learning group already contains protected learning utilities. The Toolkit will be linked from both locations, while the shared Student route gate and Developer feature matrix enforce one `amin_toolkit` capability rather than creating a duplicate permission system.
