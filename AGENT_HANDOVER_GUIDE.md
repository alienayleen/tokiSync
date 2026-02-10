# Agent Collaboration & Handover Guide

## 🤝 Protocol: Multi-Agent Cooperation

To ensure consistency and efficiency across different agent sessions, follow these rules:

1. **Mandatory Bootstrapping**: Start by reading `CORE_CONTEXT.md`. This is the ground truth.
2. **Read Source of Truth**: Then read `task.md`, `HANDOVER_CORE.md`, and `SPEC_*.md`.
3. **Analyze Before Act**: Thoroughly analyze the existing code logic before making changes.
4. **Self-Documenting Code**: Include clear comments on the Purpose and Results of your edits.
5. **Update Progress**: Once a task is completed, update the corresponding `[ ]` to `[x]` in `task.md`.
6. **Log Technical Findings**: If you discover architectural issues or blockers, record them in the `## 🛠️ Technical Analysis` section of `HANDOVER_CORE.md`.

---

## 🚀 Active Task Handover: GAS Server Implementation (v1.5.0)

**Assignee**: Backend Developer Agent
**Objective**: Update `SyncService.gs` to support `tags` in `info.json`.

### 📝 Context

The current `saveSeriesInfo` function in `google_app_script/TokiSync/SyncService.gs` manually constructs the metadata object and misses the `tags` field sent by the client. This blocks the Advanced Metadata feature.

### 🛠️ Execution Steps

1. **Modify `SyncService.gs`**:
   - Locate `function saveSeriesInfo(data, rootFolderId)`.
   - Update the `infoData.metadata` object to include `tags: data.tags || []`.
2. **Verify Integrity**: Ensure other fields like `authors`, `status`, and `category` remain intact.
3. **Deployment**: (If the user has `clasp` configured) Run `clasp push` or provide the code snippet for manual update.

### 🔗 Reference Document

[SPEC_METADATA_v1.5.0.md](file:///Users/pray4skylark/Documents/WorkSpace/tokiSync/SPEC_METADATA_v1.5.0.md)

---

## 📋 Future Handover Queue

- **Task 2**: Client-Side Extraction (`parser.js`) - _Awaiting Task 1 Completion_
- **Task 3**: Unified Menu Modal (`ui.js` & `main.js`) - _Awaiting Task 2 Completion_
- **Task 4**: UI/UX Refinement (Dark Mode & Mobile) - _Awaiting Task 3 Completion_
