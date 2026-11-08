# Aashik character direction

Aashik is an original guide character for an independent personal referral
service. The visual direction is a warm, approachable man with medium-brown
skin, voluminous swept dark hair, a short beard, headphones, and a cobalt
hoodie. The page is not an official EA product, and Aashik does not decide
whether a referral is approved.

The portrait set is generated from one canonical identity image so that the
face, clothing, crop, and lighting stay consistent across states. The images
use a shared transparent square canvas and are decorative; visible guide copy
communicates each state. Motion stays light: a slow breath, a short pose
crossfade after the incoming image decodes, and a checking indicator only while
a check is in progress. Reduced-motion preferences switch poses immediately
and stop continuous animation.

| State         | Use                                                                   |
| ------------- | --------------------------------------------------------------------- |
| `idle`        | Waiting for a choice; use the quiet welcome portrait.                 |
| `welcome`     | Landing greeting; open wave.                                          |
| `thinking`    | Considering an answer or validating a job identifier; hand near chin. |
| `checking`    | An availability or status check is in progress; show an indicator.    |
| `need-info`   | Open-palm prompt for information the candidate can choose to provide. |
| `looks-good`  | A role or resume check is verified and the next step is ready.        |
| `pointing`    | A next action or role lookup is revealed.                             |
| `submitted`   | A request was durably accepted; use the reserved receipt pose.        |
| `unavailable` | The service cannot verify or continue; calm, clear pause gesture.     |

Keep the pose aligned with the visible message and real application state. Do
not show the submitted pose for a local-only or failed submission, and keep
motion calm enough that the character supports the task instead of competing
with it.
