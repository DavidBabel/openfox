---
id: mark-done
name: Mark Task as Done
---

Mark the task you are currently working on as done using the `project_tasks` tool.

1. Use `project_tasks` with `action=list` to find the task bound to your current session (the one in the In Progress column).
2. Confirm the work is genuinely complete before proceeding.
3. Move it: `action=move`, `taskId=<id>`, `to='done'`.
4. If the move is blocked by unmet column gates, the error lists the missing fields: fill each with `action=set_gate_value` (`taskId`, `gateId`, `value` — provide real proof/evidence as part of your work), then retry the move.
5. If you get a CONFLICT, someone else changed the task: re-list and retry.
6. If the task is already done, report that instead of re-moving it.
7. Confirm the final state to the user.
