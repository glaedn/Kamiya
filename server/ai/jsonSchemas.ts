export const intentResponseSchema = {
  type: "object",
  properties: {
    reasoning: { type: "string" },
    intent: {
      type: "string",
      enum: [
        "planning",
        "task_management",
        "task_submission",
        "automation",
        "knowledge",
        "search",
        "statistics",
        "navigation",
        "community",
        "administration",
        "conversation",
        "settings"
      ]
    },
    confidence: { type: "number" },
    entities: { type: "object" },
    required_inputs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          status: { type: "string", enum: ["fulfilled", "missing", "needs_confirmation"] },
          value: {},
          question: { type: "string" }
        },
        required: ["field", "status"]
      }
    },
    next_action: {
      type: "string",
      enum: [
        "ask_missing_inputs",
        "create_project",
        "show_tasks",
        "submit_task",
        "search_cerbanimo",
        "show_stats",
        "show_profile",
        "show_notifications",
        "switch_mode",
        "show_modes",
        "open_page",
        "show_help",
        "queue_automation",
        "show_settings",
        "respond"
      ]
    }
  },
  required: ["reasoning", "intent", "confidence", "entities", "required_inputs", "next_action"]
};

export const planningResponseSchema = {
  type: "object",
  properties: {
    reasoning: { type: "string" },
    fulfilled_fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          status: { type: "string", enum: ["fulfilled", "missing", "needs_confirmation"] },
          value: {},
          question: { type: "string" }
        },
        required: ["field", "status"]
      }
    },
    missing_fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          status: { type: "string", enum: ["fulfilled", "missing", "needs_confirmation"] },
          value: {},
          question: { type: "string" }
        },
        required: ["field", "status"]
      }
    },
    recommended_next_questions: { type: "array", items: { type: "string" } },
    draft: {
      type: "object",
      properties: {
        title: { type: "string" },
        mission: { type: "string" },
        desiredOutcome: { type: "string" },
        audience: { type: "string" },
        timeline: { type: "string" },
        constraints: { type: "string" },
        successCriteria: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      }
    },
    ready_to_create: { type: "boolean" }
  },
  required: [
    "reasoning",
    "fulfilled_fields",
    "missing_fields",
    "recommended_next_questions",
    "draft",
    "ready_to_create"
  ]
};

export const chatTitleResponseSchema = {
  type: "object",
  properties: {
    chatName: { type: "string" }
  },
  required: ["chatName"]
};
