export const Events = {
  ProjectCreated: "project_created",
  FloorplanUploaded: "floorplan_uploaded",
  PdfRendered: "pdf_rendered",
  PlanParseStarted: "plan_parse_started",
  PlanParseCompleted: "plan_parse_completed",
  ManualEditStarted: "manual_edit_started",
  ScaleConfirmed: "scale_confirmed",
  PlanConfirmed: "plan_confirmed",
  ModelGenerated: "model_generated",
  VariantPromptSubmitted: "variant_prompt_submitted",
  VariantGenerated: "variant_generated",
  WalkthroughStarted: "walkthrough_started",
  ShareCreated: "share_created",
  ReportExported: "report_exported"
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
