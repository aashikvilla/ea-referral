# Ashik character direction

Ashik is an original, independent guide character. The visual direction is a
warm, approachable man with medium-brown skin, voluminous swept dark hair, a
short beard, over-ear headphones, and a cobalt hoodie. He is not presented as
an EA employee or as the person who decides whether a referral is approved.

The character is a procedural Three.js scene rather than a sequence of static
images. Separate head, torso, shoulder, elbow, wrist, and hand groups let the
pose respond to the current task. Face and gaze movement stay subtle; reduced
motion preferences suppress continuous idle movement and transitions. The
server-rendered SVG fallback keeps Ashik visible until the WebGL scene is
ready, and remains available if WebGL cannot start.

| State         | Use                                                                   |
| ------------- | --------------------------------------------------------------------- |
| `idle`        | Waiting for a choice; small blink, breath, and gaze response.         |
| `welcome`     | Landing greeting; open wave.                                          |
| `thinking`    | Considering an answer or validating a job identifier; hand near chin. |
| `checking`    | An availability or request-status check is in progress.               |
| `pointing`    | A next action or role lookup is revealed.                             |
| `success`     | A request was durably accepted; modest raised-arm gesture.            |
| `unavailable` | The service cannot verify or continue; calm, clear pause gesture.     |

Keep the pose aligned with the visible message and real application state. Do
not animate success for a local-only or failed submission, and keep motion
calm enough that the character supports the task instead of competing with it.
