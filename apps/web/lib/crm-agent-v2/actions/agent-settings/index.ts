import type { CrmAgentActionDefinition } from "../types";
import { agentAutopilotDisableAction } from "./agent.autopilot-disable";
import { agentAutopilotEnableAction } from "./agent.autopilot-enable";
import { agentAutopilotSetLevelAction } from "./agent.autopilot-set-level";
import { agentCancelTaskAction } from "./agent.cancel-task";
import { agentMemoryDeleteAction } from "./agent.memory-delete";
import { agentMemoryUpdateAction } from "./agent.memory-update";
import { agentMemoryViewAction } from "./agent.memory-view";
import { agentPolicyUpdateAction } from "./agent.policy-update";
import { agentPolicyViewAction } from "./agent.policy-view";
import { agentResumeTaskAction } from "./agent.resume-task";
import { agentViewRunsAction } from "./agent.view-runs";
import { agentViewTraceAction } from "./agent.view-trace";

export const agentSettingsActions: CrmAgentActionDefinition[] = [
  agentAutopilotDisableAction,
  agentAutopilotEnableAction,
  agentAutopilotSetLevelAction,
  agentCancelTaskAction,
  agentMemoryDeleteAction,
  agentMemoryUpdateAction,
  agentMemoryViewAction,
  agentPolicyUpdateAction,
  agentPolicyViewAction,
  agentResumeTaskAction,
  agentViewRunsAction,
  agentViewTraceAction,
];
