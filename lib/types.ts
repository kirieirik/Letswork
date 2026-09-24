export type TaskStatus = "open" | "completed";

export type Profile = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  active: boolean;
};

export type DatabaseTask = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  created_by: string;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};