export type SessionStatus = "draft" | "active" | "completed" | "archived";
export type SessionType = "interview" | "meeting" | "general";

export type SessionSummary = {
  id: string;
  title: string;
  session_type: SessionType;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};
