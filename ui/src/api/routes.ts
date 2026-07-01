/**
 * HTTP path builders for the Agent OS FastAPI surface.
 * Swagger UI: `{agentOSUrl}/docs` — OpenAPI: `{agentOSUrl}/openapi.json`
 */

const enc = (segment: string) => encodeURIComponent(segment)

/** Core & platform */
export const APIRoutes = {
  Root: (agentOSUrl: string) => `${agentOSUrl}/`,
  Info: (agentOSUrl: string) => `${agentOSUrl}/info`,
  Config: (agentOSUrl: string) => `${agentOSUrl}/config`,
  Status: (agentOSUrl: string) => `${agentOSUrl}/health`,
  DatasetUpload: (agentOSUrl: string) => `${agentOSUrl}/datasets/upload`,
  Dashboard: (agentOSUrl: string) => `${agentOSUrl}/dashboard`,
  Metrics: (agentOSUrl: string) => `${agentOSUrl}/metrics`,
  MetricsRefresh: (agentOSUrl: string) => `${agentOSUrl}/metrics/refresh`,
  Models: (agentOSUrl: string) => `${agentOSUrl}/models`,
  Registry: (agentOSUrl: string) => `${agentOSUrl}/registry`,
  Components: (agentOSUrl: string) => `${agentOSUrl}/components`,

  /** Agents */
  GetAgents: (agentOSUrl: string) => `${agentOSUrl}/agents`,
  GetAgent: (agentOSUrl: string, agentId: string) =>
    `${agentOSUrl}/agents/${enc(agentId)}`,
  ListAgentRuns: (agentOSUrl: string, agentId: string) =>
    `${agentOSUrl}/agents/${enc(agentId)}/runs`,
  AgentRun: (agentOSUrl: string, agentId: string) =>
    `${agentOSUrl}/agents/${enc(agentId)}/runs`,
  GetAgentRun: (agentOSUrl: string, agentId: string, runId: string) =>
    `${agentOSUrl}/agents/${enc(agentId)}/runs/${enc(runId)}`,
  CancelAgentRun: (agentOSUrl: string, agentId: string, runId: string) =>
    `${agentOSUrl}/agents/${enc(agentId)}/runs/${enc(runId)}/cancel`,
  ContinueAgentRun: (agentOSUrl: string, agentId: string, runId: string) =>
    `${agentOSUrl}/agents/${enc(agentId)}/runs/${enc(runId)}/continue`,

  /** Teams */
  GetTeams: (agentOSUrl: string) => `${agentOSUrl}/teams`,
  GetTeam: (agentOSUrl: string, teamId: string) =>
    `${agentOSUrl}/teams/${enc(teamId)}`,
  ListTeamRuns: (agentOSUrl: string, teamId: string) =>
    `${agentOSUrl}/teams/${enc(teamId)}/runs`,
  TeamRun: (agentOSUrl: string, teamId: string) =>
    `${agentOSUrl}/teams/${enc(teamId)}/runs`,
  GetTeamRun: (agentOSUrl: string, teamId: string, runId: string) =>
    `${agentOSUrl}/teams/${enc(teamId)}/runs/${enc(runId)}`,
  CancelTeamRun: (agentOSUrl: string, teamId: string, runId: string) =>
    `${agentOSUrl}/teams/${enc(teamId)}/runs/${enc(runId)}/cancel`,

  /** Workflows */
  GetWorkflows: (agentOSUrl: string) => `${agentOSUrl}/workflows`,
  GetWorkflow: (agentOSUrl: string, workflowId: string) =>
    `${agentOSUrl}/workflows/${enc(workflowId)}`,
  WorkflowRun: (agentOSUrl: string, workflowId: string) =>
    `${agentOSUrl}/workflows/${enc(workflowId)}/runs`,
  GetWorkflowRun: (agentOSUrl: string, workflowId: string, runId: string) =>
    `${agentOSUrl}/workflows/${enc(workflowId)}/runs/${enc(runId)}`,
  CancelWorkflowRun: (agentOSUrl: string, workflowId: string, runId: string) =>
    `${agentOSUrl}/workflows/${enc(workflowId)}/runs/${enc(runId)}/cancel`,

  /** Sessions (shared by agents, teams, workflows) */
  GetSessions: (agentOSUrl: string) => `${agentOSUrl}/sessions`,
  CreateSession: (agentOSUrl: string) => `${agentOSUrl}/sessions`,
  DeleteSessionsBulk: (agentOSUrl: string) => `${agentOSUrl}/sessions`,
  GetSessionById: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${enc(sessionId)}`,
  UpdateSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${enc(sessionId)}`,
  RenameSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${enc(sessionId)}/rename`,
  DeleteSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${enc(sessionId)}`,
  /** Runs for a session */
  GetSession: (agentOSUrl: string, sessionId: string) =>
    `${agentOSUrl}/sessions/${enc(sessionId)}/runs`,
  GetSessionRun: (agentOSUrl: string, sessionId: string, runId: string) =>
    `${agentOSUrl}/sessions/${enc(sessionId)}/runs/${enc(runId)}`,

  /** Human-in-the-loop approvals */
  ListApprovals: (agentOSUrl: string) => `${agentOSUrl}/approvals`,
  ApprovalCount: (agentOSUrl: string) => `${agentOSUrl}/approvals/count`,
  GetApproval: (agentOSUrl: string, approvalId: string) =>
    `${agentOSUrl}/approvals/${enc(approvalId)}`,
  DeleteApproval: (agentOSUrl: string, approvalId: string) =>
    `${agentOSUrl}/approvals/${enc(approvalId)}`,
  ResolveApproval: (agentOSUrl: string, approvalId: string) =>
    `${agentOSUrl}/approvals/${enc(approvalId)}/resolve`,
  ApprovalStatus: (agentOSUrl: string, approvalId: string) =>
    `${agentOSUrl}/approvals/${enc(approvalId)}/status`,

  /** Knowledge base */
  KnowledgeConfig: (agentOSUrl: string) => `${agentOSUrl}/knowledge/config`,
  KnowledgeSearch: (agentOSUrl: string) => `${agentOSUrl}/knowledge/search`,
  KnowledgeContent: (agentOSUrl: string) => `${agentOSUrl}/knowledge/content`,
  KnowledgeContentById: (agentOSUrl: string, contentId: string) =>
    `${agentOSUrl}/knowledge/content/${enc(contentId)}`,
  KnowledgeContentStatus: (agentOSUrl: string, contentId: string) =>
    `${agentOSUrl}/knowledge/content/${enc(contentId)}/status`,
  KnowledgeRemoteContent: (agentOSUrl: string) =>
    `${agentOSUrl}/knowledge/remote-content`,
  KnowledgeSources: (agentOSUrl: string, knowledgeId: string) =>
    `${agentOSUrl}/knowledge/${enc(knowledgeId)}/sources`,
  KnowledgeSourceFiles: (
    agentOSUrl: string,
    knowledgeId: string,
    sourceId: string
  ) =>
    `${agentOSUrl}/knowledge/${enc(knowledgeId)}/sources/${enc(sourceId)}/files`,

  /** Long-term memory */
  Memories: (agentOSUrl: string) => `${agentOSUrl}/memories`,
  MemoryById: (agentOSUrl: string, memoryId: string) =>
    `${agentOSUrl}/memories/${enc(memoryId)}`,
  MemoryTopics: (agentOSUrl: string) => `${agentOSUrl}/memory_topics`,
  OptimizeMemories: (agentOSUrl: string) => `${agentOSUrl}/optimize-memories`,
  UserMemoryStats: (agentOSUrl: string) => `${agentOSUrl}/user_memory_stats`,

  /** Dynamic components / configs */
  GetComponent: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${enc(componentId)}`,
  UpdateComponent: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${enc(componentId)}`,
  DeleteComponent: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${enc(componentId)}`,
  ComponentConfigs: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${enc(componentId)}/configs`,
  ComponentConfigCurrent: (agentOSUrl: string, componentId: string) =>
    `${agentOSUrl}/components/${enc(componentId)}/configs/current`,
  ComponentConfigVersion: (
    agentOSUrl: string,
    componentId: string,
    version: string
  ) =>
    `${agentOSUrl}/components/${enc(componentId)}/configs/${enc(version)}`,
  SetCurrentComponentConfig: (
    agentOSUrl: string,
    componentId: string,
    version: string
  ) =>
    `${agentOSUrl}/components/${enc(componentId)}/configs/${enc(version)}/set-current`,

  /** Cron / schedules */
  Schedules: (agentOSUrl: string) => `${agentOSUrl}/schedules`,
  ScheduleById: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${enc(scheduleId)}`,
  ScheduleEnable: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${enc(scheduleId)}/enable`,
  ScheduleDisable: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${enc(scheduleId)}/disable`,
  ScheduleTrigger: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${enc(scheduleId)}/trigger`,
  ScheduleRuns: (agentOSUrl: string, scheduleId: string) =>
    `${agentOSUrl}/schedules/${enc(scheduleId)}/runs`,
  ScheduleRunById: (
    agentOSUrl: string,
    scheduleId: string,
    runId: string
  ) =>
    `${agentOSUrl}/schedules/${enc(scheduleId)}/runs/${enc(runId)}`,

  /** Evaluations */
  EvalRuns: (agentOSUrl: string) => `${agentOSUrl}/eval-runs`,
  EvalRunById: (agentOSUrl: string, evalRunId: string) =>
    `${agentOSUrl}/eval-runs/${enc(evalRunId)}`,

  /** Observability */
  Traces: (agentOSUrl: string) => `${agentOSUrl}/traces`,
  TracesFilterSchema: (agentOSUrl: string) =>
    `${agentOSUrl}/traces/filter-schema`,
  TracesSearch: (agentOSUrl: string) => `${agentOSUrl}/traces/search`,
  TraceById: (agentOSUrl: string, traceId: string) =>
    `${agentOSUrl}/traces/${enc(traceId)}`,
  TraceSessionStats: (agentOSUrl: string) =>
    `${agentOSUrl}/trace_session_stats`,

  /** Database maintenance */
  MigrateAllDatabases: (agentOSUrl: string) =>
    `${agentOSUrl}/databases/all/migrate`,
  MigrateDatabase: (agentOSUrl: string, dbId: string) =>
    `${agentOSUrl}/databases/${enc(dbId)}/migrate`
} as const
