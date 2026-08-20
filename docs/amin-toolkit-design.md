# Amin Master Toolkit: Implementation Boundaries

## Vision-enabled AI Doubt Solver

Students may select an image from the library or take a photo after the operating system grants camera permission. The selected image is reduced on-device to a bounded Base64 payload and submitted only with the Student's question to the existing server-side Gemini boundary. The image is not stored in the LMS database, storage service, audit log, chat history, telemetry, or offline downloads. Gemini provider secrets remain server-only. The interface must clearly state that the response is educational guidance, not an official land-record verification or survey certification.

The existing Doubt Solver is already Student-only, preserves a local text chat history, uses a server-only Gemini key, and returns a visible fallback when the provider is unavailable. The extension must preserve these behaviors while adding an optional bounded image field; it must not add image persistence or weaken the existing Student role check.

Google's official Gemini image-understanding guidance states that inline image data counts toward a 20 MB total request limit. The application therefore limits the locally prepared image field to 3.5 million Base64 characters before combining it with the question and server instructions. Source: https://ai.google.dev/gemini-api/docs/image-understanding

## GPS perimeter estimate

The GPS tool requests foreground location only while the Student actively maps a plot. It calculates an approximate area on-device. A Student may explicitly save a custom-named map; only then are the perimeter points written to the device-local AsyncStorage history so the map can be reopened after an app restart. No point is sent to the LMS API, analytics, audit log, server database, or provider. Reset clears only the unsaved current perimeter and does not remove saved maps. The tool must disclose that GPS accuracy, device position, terrain, and path quality affect the estimate; it is not a legal boundary survey.

## Official land-record portals

The portal directory must contain a small, code-reviewed allowlist of official state government land-record URLs. The WebView must keep navigation in-app only when the target remains on the official host. Any external destination must be blocked with a native explanation rather than opened in a browser.

The initial reviewed directory uses Bihar Bhumi at `https://biharbhumi.bihar.gov.in/Biharbhumi/`, which presents itself as the Revenue Bihar gateway, and the national Department of Land Resources at `https://dolr.gov.in/en/`, which identifies itself as part of the Ministry of Rural Development. Only these hosts, including their subdomains where required by an official portal, should be permitted in the in-app browser.

The Uttar Pradesh Bhulekh domain `https://upbhulekh.gov.in/` was reached directly and identified as the Bhulekh portal. The Madhya Pradesh official `https://mpbhulekh.gov.in/` domain is corroborated by an official district-government land-record reference, but its live browser navigation closed the connection in this environment; the existing native WebView error state must remain in place rather than assuming provider availability. The reviewed Rajasthan portal candidate is the Rajasthan Government Apna Khata domain `https://apnakhata.rajasthan.gov.in/`.

## Region-aware local units

The converter always retains acre, hectare, square feet, and square metres as standard units. Bigha, Katha, and Dhur appear only when the Student selects a code-reviewed state/region system that defines them. The initial systems are a common Bihar reference (1 Bigha = 20 Katha = 400 Dhur), an Uttar Pradesh Pucca Bigha reference, and a metric-only fallback. The application never presents a single India-wide Bigha/Katha/Dhur conversion; a Student must verify local district or revenue-record practice before relying on any local-unit reference.

The upgraded state-first selector lists all 28 States and 8 Union Territories. Every State/UT begins with a `Standard units only` profile for acre, hectare, square feet, and square metres. Bihar, Uttar Pradesh, Madhya Pradesh, and Rajasthan additionally offer a clearly labelled reference profile, which is never automatically selected and carries a district/tehsil confirmation warning. The supporting DILRMP material explains that land administration is a State List responsibility and varies by regional nomenclature, which is why a universal local-unit catalogue is intentionally not asserted. [1]

[1] [Department of Land Resources, Government of India — DILRMP](https://dolr.gov.in/en/programmes-schemes/dilrmp-2/)

## Gemini Vision crop/adjust workflow

Choosing an image opens the platform's native image picker or camera with its native Crop / Adjust step enabled. Only after this review does the app locally resize/compress the selected image to a bounded JPEG/Base64 payload and show a cropped preview. The selected bytes remain ephemeral client state, are sent only with the next Student question to the existing server-only Gemini boundary, and clear after sending or removal. The app does not create a gallery copy, remote image store, chat attachment record, telemetry record, or download artifact.

## Compass

The compass uses the native magnetometer only on Android/iOS after checking availability. The screen must explain that magnetic interference and calibration affect its indicated heading, and it must show a graceful unavailable state on web or devices without the sensor.

## Additive navigation

The Student dashboard already presents the AI Doubt Solver, AI Quiz, and Study Coach as independent shortcut cards. The Student Account learning group already contains protected learning utilities. The Toolkit will be linked from both locations, while the shared Student route gate and Developer feature matrix enforce one `amin_toolkit` capability rather than creating a duplicate permission system.
