# Native Learning Validation Runbook

## Purpose

This runbook prepares an authenticated Android/iOS validation of the device-dependent flows added to Amin Ka Master. It does not claim the browser preview can simulate native gestures, printing, protected app storage, or every government portal.

| Flow | Android/iOS check | Expected safe outcome |
|---|---|---|
| AI image preview | Sign in as a Student, choose a map/document, crop it, open the preview, pinch with two fingers, remove it, and verify the composer remains above the keyboard. | Zoom resets when the gesture ends. Removing the image prevents attachment. The preview is local until explicit send. |
| Conversion report | Save at least one conversion, use **Export PDF**, and open the report. | The PDF is written under app-private protected storage and opens only in the internal reader. It is not shared automatically. |
| Government reference | Open a reviewed state card while online, then test with the network disabled. | Only approved hosts load in the in-app browser. HTTP/network failure exposes a retry state rather than handing off to an external browser. |
| Long mock test | Create a 120- or 180-minute staff draft, add questions, publish through the existing permission flow, and take it as an enrolled Student. | The Student sees the server-issued timer, can navigate/mark questions locally, confirms submit, and receives server-derived review/history. |

> Use a test account and non-sensitive images/documents. Do not treat the Toolkit conversion, GPS estimate, or portal content as a certified legal survey or record decision.
