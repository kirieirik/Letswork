"use client";

import {
  Archive,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  LayoutList,
  Menu,
  Plus,
  Search,
  Settings,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { FormEvent, startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";
import type { DatabaseTask, DatabaseTaskUpdate, Profile } from "@/lib/types";
import { filterTasks, getTaskCounts, isTaskOverdue } from "@/lib/task-utils";

type Status = "open" | "completed";
type View = "all" | "mine" | "overdue" | "soon" | "completed" | "people";
type Person = { id: string; name: string; email?: string; initials: string; color: string };
type Task = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  progress: number;
  status: Status;
  createdAt: string;
  createdBy: string;
  completedAt: string | null;
  completedBy: string | null;
  deletedAt: string | null;
};
type TaskUpdate = { id: string; taskId: string; authorId: string; progress: number; body: string; createdAt: string };

const people: Person[] = [
  { id: "emma", name: "Emma Johansson", initials: "EJ", color: "#e9d5ff" },
  { id: "lars", name: "Lars Nilsson", initials: "LN", color: "#bfdbfe" },
  { id: "sofie", name: "Sofie Berg", initials: "SB", color: "#fed7aa" },
  { id: "anders", name: "Anders Holm", initials: "AH", color: "#bbf7d0" },
  { id: "maria", name: "Maria Lind", initials: "ML", color: "#fecdd3" },
];

const currentUser = people[0];
const today = new Date();
const isoDate = (offset: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const seedTasks: Task[] = [
  { id: "1", title: "Prepare monthly report", description: "Complete the latest sales figures and prepare a short summary for management.", assigneeId: "emma", dueDate: isoDate(0), progress: 0, status: "open", createdAt: "2026-09-20T09:00:00Z", createdBy: "anders", completedAt: null, completedBy: null, deletedAt: null },
  { id: "2", title: "Update website content", description: "Refresh the services page with the new copy from marketing.", assigneeId: "lars", dueDate: isoDate(4), progress: 0, status: "open", createdAt: "2026-09-21T10:00:00Z", createdBy: "emma", completedAt: null, completedBy: null, deletedAt: null },
  { id: "3", title: "Order office supplies", description: "Check the storage room and order printer paper, coffee, and pens.", assigneeId: "sofie", dueDate: null, progress: 0, status: "open", createdAt: "2026-09-19T08:30:00Z", createdBy: "maria", completedAt: null, completedBy: null, deletedAt: null },
  { id: "4", title: "Plan team meeting", description: "Find a time that works for everyone and prepare an agenda.", assigneeId: "emma", dueDate: isoDate(8), progress: 0, status: "open", createdAt: "2026-09-18T11:00:00Z", createdBy: "emma", completedAt: null, completedBy: null, deletedAt: null },
  { id: "5", title: "Review safety procedures", description: "Read through the updated office safety procedures.", assigneeId: "anders", dueDate: isoDate(-2), progress: 0, status: "open", createdAt: "2026-09-17T14:30:00Z", createdBy: "lars", completedAt: null, completedBy: null, deletedAt: null },
  { id: "6", title: "Client follow-up emails", description: "Follow up with the three clients from last week's meeting.", assigneeId: null, dueDate: null, progress: 0, status: "open", createdAt: "2026-09-16T12:00:00Z", createdBy: "maria", completedAt: null, completedBy: null, deletedAt: null },
  { id: "7", title: "Archive Q2 invoices", description: "Move signed invoices into the shared archive.", assigneeId: "maria", dueDate: isoDate(-4), progress: 100, status: "completed", createdAt: "2026-09-10T12:00:00Z", createdBy: "emma", completedAt: "2026-09-22T14:32:00Z", completedBy: "maria", deletedAt: null },
];

const formatDate = (value: string | null) => {
  if (!value) return "No due date";
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};
const isToday = (value: string | null) => value === today.toISOString().slice(0, 10);
const personFor = (id: string | null, roster: Person[] = people) => roster.find((person) => person.id === id);
const profileToPerson = (profile: Profile): Person => ({ id: profile.id, name: profile.full_name, email: profile.email, initials: profile.full_name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), color: "#dbe4ff" });
const rowToTask = (row: DatabaseTask): Task => ({ id: row.id, title: row.title, description: row.description, assigneeId: row.assignee_id, dueDate: row.due_date, progress: row.progress ?? (row.status === "completed" ? 100 : 0), status: row.status, createdAt: row.created_at, createdBy: row.created_by, completedAt: row.completed_at, completedBy: row.completed_by, deletedAt: row.deleted_at });
const rowToTaskUpdate = (row: DatabaseTaskUpdate): TaskUpdate => ({ id: row.id, taskId: row.task_id, authorId: row.author_id, progress: row.progress, body: row.body, createdAt: row.created_at });

export default function Home() {
    const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(() => {
    if (typeof window === "undefined") return seedTasks;
    const stored = window.localStorage.getItem("company-tasks");
    return stored ? JSON.parse(stored) as Task[] : seedTasks;
  });
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"create" | "complete" | "delete" | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [editing, setEditing] = useState(false);
  const [roster, setRoster] = useState<Person[]>(people);
  const [activePerson, setActivePerson] = useState<Person>(currentUser);
  const [actorId, setActorId] = useState(currentUser.id);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("Creative Co.");
  const [authReady, setAuthReady] = useState(false);
  const [remoteMode, setRemoteMode] = useState<boolean | null>(null);
  const [dataError, setDataError] = useState("");
  const [taskUpdates, setTaskUpdates] = useState<Record<string, TaskUpdate[]>>({});
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const notify = (message: string, kind: "success" | "error" = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3500);
  };
  const signOut = async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  useEffect(() => {
    const demoMode = new URLSearchParams(window.location.search).get("demo") === "1";
    startTransition(() => {
      setRemoteMode(demoMode ? false : isSupabaseConfigured());
      if (demoMode) setAuthReady(true);
    });
  }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("demo") === "1") return;
    const supabase = createClient();
    if (!supabase) return;
    let mounted = true;
    let taskChannel: ReturnType<typeof supabase.channel> | undefined;
    let updateChannel: ReturnType<typeof supabase.channel> | undefined;
    const loadRemoteData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!session) { setAuthReady(true); return; }
      setAuthUserId(session.user.id);
      setActorId(session.user.id);
      const { data: currentProfile, error: profileError } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      if (profileError || !currentProfile) { setDataError(profileError?.message ?? "Your profile is not set up yet."); setAuthReady(true); return; }
      setOrganizationId(currentProfile.organization_id);
      const { data: organization } = await supabase.from("organizations").select("name").eq("id", currentProfile.organization_id).single();
      if (organization?.name) setOrganizationName(organization.name);
      setActivePerson(profileToPerson(currentProfile as Profile));
      const [{ data: profiles, error: profilesError }, { data: remoteTasks, error: tasksError }] = await Promise.all([
        supabase.from("profiles").select("*").eq("organization_id", currentProfile.organization_id).eq("active", true).order("full_name"),
        supabase.from("tasks").select("*").eq("organization_id", currentProfile.organization_id).order("created_at", { ascending: false }),
      ]);
      if (!mounted) return;
      if (profilesError || tasksError) setDataError(profilesError?.message ?? tasksError?.message ?? "Could not load workspace data.");
      if (profiles) setRoster((profiles as Profile[]).map(profileToPerson));
      if (remoteTasks) setTasks((remoteTasks as DatabaseTask[]).map(rowToTask));
      taskChannel = supabase.channel(`tasks:${currentProfile.organization_id}`).on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `organization_id=eq.${currentProfile.organization_id}` }, (payload) => {
        if (!mounted) return;
        setTasks((current) => {
          if (payload.eventType === "INSERT") {
            const incomingTask = rowToTask(payload.new as DatabaseTask);
            return current.some((task) => task.id === incomingTask.id) ? current : [incomingTask, ...current];
          }
          if (payload.eventType === "UPDATE") return current.map((task) => task.id === payload.new.id ? rowToTask(payload.new as DatabaseTask) : task);
          if (payload.eventType === "DELETE") return current.filter((task) => task.id !== payload.old.id);
          return current;
        });
      }).subscribe();
      updateChannel = supabase.channel(`task-updates:${currentProfile.organization_id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "task_updates", filter: `organization_id=eq.${currentProfile.organization_id}` }, (payload) => {
        if (!mounted) return;
        const incomingUpdate = rowToTaskUpdate(payload.new as DatabaseTaskUpdate);
        setTaskUpdates((current) => {
          const existing = current[incomingUpdate.taskId] ?? [];
          if (existing.some((update) => update.id === incomingUpdate.id)) return current;
          return { ...current, [incomingUpdate.taskId]: [incomingUpdate, ...existing] };
        });
      }).subscribe();
      setAuthReady(true);
    };
    loadRemoteData().catch((error: Error) => { if (mounted) { setDataError(error.message); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAuthUserId(session?.user.id ?? null));
    return () => { mounted = false; listener.subscription.unsubscribe(); if (taskChannel) void supabase.removeChannel(taskChannel); if (updateChannel) void supabase.removeChannel(updateChannel); };
  }, []);
  useEffect(() => {
    if (remoteMode !== true) window.localStorage.setItem("company-tasks", JSON.stringify(tasks));
  }, [tasks, remoteMode]);
  useEffect(() => {
    if (!selectedId || remoteMode !== true) return;
    const supabase = createClient();
    if (!supabase) return;
    supabase.from("task_updates").select("*").eq("task_id", selectedId).order("created_at", { ascending: false }).then(({ data, error }) => {
      if (error) notify(error.message, "error");
      else if (data) setTaskUpdates((current) => ({ ...current, [selectedId]: (data as DatabaseTaskUpdate[]).map(rowToTaskUpdate) }));
    });
  }, [selectedId, remoteMode]);

  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const visibleTasks = useMemo(() => filterTasks(tasks, view === "people" ? "all" : view, query, actorId, roster, today), [tasks, view, query, actorId, roster]);
  const counts = getTaskCounts(tasks, actorId, today);
  const assignedCounts = roster.reduce<Record<string, number>>((result, person) => {
    result[person.id] = tasks.filter((task) => task.assigneeId === person.id && task.status === "open" && !task.deletedAt).length;
    return result;
  }, {});

  const updateTask = async (changes: Partial<Task>, successMessage?: string) => {
    if (!selected) return false;
    if (remoteMode) {
      const payload: Record<string, string | number | null> = { updated_at: new Date().toISOString() };
      if ("title" in changes) payload.title = changes.title ?? null;
      if ("description" in changes) payload.description = changes.description ?? null;
      if ("assigneeId" in changes) payload.assignee_id = changes.assigneeId ?? null;
      if ("dueDate" in changes) payload.due_date = changes.dueDate ?? null;
      if ("status" in changes) payload.status = changes.status ?? null;
      if ("completedAt" in changes) payload.completed_at = changes.completedAt ?? null;
      if ("completedBy" in changes) payload.completed_by = changes.completedBy ?? null;
      if ("progress" in changes) payload.progress = changes.progress ?? null;
      if ("deletedAt" in changes) payload.deleted_at = changes.deletedAt ?? null;
      const { error } = await createClient()!.from("tasks").update(payload).eq("id", selected.id);
      if (error) { setDataError(error.message); notify(error.message, "error"); return false; }
    }
    setTasks((current) => current.map((task) => task.id === selected.id ? { ...task, ...changes, updatedAt: new Date().toISOString() } as Task : task));
    if (successMessage) notify(successMessage);
    return true;
  };
  const addTaskUpdate = async (body: string, progress: number) => {
    if (!selected || !body.trim()) return false;
    if (remoteMode === true) {
      const { data, error } = await createClient()!.from("task_updates").insert({ organization_id: organizationId, task_id: selected.id, author_id: actorId, progress, body: body.trim() }).select().single();
      if (error || !data) { notify(error?.message ?? "Could not save update.", "error"); return false; }
      const saved = rowToTaskUpdate(data as DatabaseTaskUpdate);
      setTaskUpdates((current) => ({ ...current, [selected.id]: [saved, ...(current[selected.id] ?? [])] }));
    } else {
      const saved = { id: crypto.randomUUID(), taskId: selected.id, authorId: actorId, progress, body: body.trim(), createdAt: new Date().toISOString() };
      setTaskUpdates((current) => ({ ...current, [selected.id]: [saved, ...(current[selected.id] ?? [])] }));
    }
    notify("Update added");
    return true;
  };
  const navItems: { id: View; label: string; icon: typeof LayoutList; count?: number }[] = [
    { id: "all", label: "All tasks", icon: LayoutList, count: counts.all },
    { id: "mine", label: "My tasks", icon: UserRound, count: counts.mine },
    { id: "overdue", label: "Overdue", icon: Clock3, count: counts.overdue },
    { id: "soon", label: "Due soon", icon: CalendarDays, count: counts.soon },
    { id: "completed", label: "Completed", icon: Check, count: counts.completed },
    { id: "people", label: "People", icon: Users },
  ];

  if ((remoteMode === null && !authReady) || (remoteMode && !authReady)) return <main className="loading-screen">Loading your workspace...</main>;
  if (remoteMode && !authUserId) return <main className="auth-required"><h1>Sign in to continue</h1><p>{dataError || "Your company tasks are private to your workspace."}</p><a className="primary-button" href="/login">Go to sign in</a></main>;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Check size={17} strokeWidth={3} /></span><span>Company Tasks</span></div>
        <div className="workspace-switcher"><span className="workspace-dot">{organizationName.charAt(0).toUpperCase()}</span><span><strong>{organizationName}</strong><small>Company workspace</small></span><ChevronDown size={15} /></div>
        <nav aria-label="Task views">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ id, label, icon: Icon, count }) => <button className={`nav-item ${view === id ? "active" : ""}`} key={id} onClick={() => { setView(id); setMobileNav(false); }}><Icon size={17} /><span>{label}</span>{count ? <b>{count}</b> : null}</button>)}
        </nav>
        <div className="sidebar-bottom"><button className="nav-item"><Settings size={17} /><span>Settings</span></button><button className="profile" onClick={signOut} aria-label="Sign out"><span className="avatar" style={{ background: activePerson.color }}>{activePerson.initials}</span><span><strong>{activePerson.name}</strong><small>Sign out</small></span><MoreDots /></button></div>
      </aside>
      {mobileNav && <button className="scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <section className="content-area">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="topbar-title"><span className="eyebrow">Shared workspace</span><h1>{navItems.find((item) => item.id === view)?.label}</h1></div><div className="top-actions"><div className="search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" aria-label="Search tasks" /><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><span className="avatar avatar-top" style={{ background: activePerson.color }}>{activePerson.initials}</span><button className="primary-button" onClick={() => setDialog("create")}><Plus size={17} /> New task</button></div></header>
        <div className="mobile-tabs">{navItems.slice(0, 4).map(({ id, label }) => <button className={view === id ? "active" : ""} key={id} onClick={() => setView(id)}>{label}</button>)}</div>
        {view === "people" ? <PeoplePanel roster={roster} assignedCounts={assignedCounts} /> : <div className="list-wrap"><div className="list-heading"><div><h2>{view === "completed" ? "Completed tasks" : "Open tasks"}</h2><p>{visibleTasks.length} {visibleTasks.length === 1 ? "task" : "tasks"} {query ? "matching your search" : "in this view"}</p></div><button className="filter-button"><Archive size={15} /> Filter <ChevronDown size={14} /></button></div><div className="task-list">{visibleTasks.map((task) => <TaskRow key={task.id} task={task} roster={roster} onSelect={() => { setSelectedId(task.id); setEditing(false); }} onComplete={() => { setSelectedId(task.id); setDialog("complete"); }} />)}{visibleTasks.length === 0 && <div className="empty"><span className="empty-icon"><Search size={21} /></span><h3>{query ? "No tasks found" : "Nothing here yet"}</h3><p>{query ? "Try a different title, description, or assignee." : "Create a task to get the team moving."}</p>{!query && <button className="primary-button" onClick={() => setDialog("create")}><Plus size={17} /> New task</button>}</div>}</div></div>}
      </section>
      {selected && <TaskDetails task={selected} roster={roster} updates={taskUpdates[selected.id] ?? []} editing={editing} setEditing={setEditing} onClose={() => setSelectedId(null)} onUpdate={updateTask} onAddUpdate={addTaskUpdate} onDelete={() => setDialog("delete")} onComplete={() => setDialog("complete")} />}
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.message}</div>}
      {dialog === "create" && <TaskForm roster={roster} actorId={actorId} organizationId={organizationId} remoteMode={remoteMode === true} onClose={() => setDialog(null)} onError={(message) => notify(message, "error")} onCreate={(task) => { setTasks((current) => [task, ...current]); setDialog(null); notify("Task created"); }} />}
      {dialog === "complete" && selected && <ConfirmDialog title="Close task?" message="Do you really want to mark this task as completed?" confirm="Yes, mark as completed" onClose={() => setDialog(null)} onConfirm={async () => { if (await updateTask({ status: "completed", progress: 100, completedAt: new Date().toISOString(), completedBy: actorId }, "Task completed")) { setDialog(null); setSelectedId(null); } }} />}
      {dialog === "delete" && selected && <ConfirmDialog title="Delete task?" message="This task will be hidden from the workspace, but its record will be kept." confirm="Delete task" destructive onClose={() => setDialog(null)} onConfirm={async () => { if (await updateTask({ deletedAt: new Date().toISOString() }, "Task deleted")) { setDialog(null); setSelectedId(null); } }} />}
    </main>
  );
}

function PeoplePanel({ roster, assignedCounts }: { roster: Person[]; assignedCounts: Record<string, number> }) {
  return <div className="people-wrap"><div className="list-heading"><div><h2>Company people</h2><p>{roster.length} active {roster.length === 1 ? "member" : "members"} in this workspace</p></div></div><div className="people-list">{roster.map((person) => <div className="person-row" key={person.id}><span className="avatar" style={{ background: person.color }}>{person.initials}</span><div className="person-info"><strong>{person.name}</strong><span>{person.email ?? "Workspace member"}</span></div><span className="person-task-count">{assignedCounts[person.id] ?? 0} open {(assignedCounts[person.id] ?? 0) === 1 ? "task" : "tasks"}</span><span className="active-badge"><span /> Active</span></div>)}</div></div>;
}

function TaskRow({ task, roster, onSelect, onComplete }: { task: Task; roster: Person[]; onSelect: () => void; onComplete: () => void }) {
  const person = personFor(task.assigneeId, roster);
  return <div className="task-row"><button className={`task-check ${task.status === "completed" ? "checked" : ""}`} onClick={onComplete} aria-label={`Complete ${task.title}`}>{task.status === "completed" && <Check size={13} />}</button><button className="task-main" onClick={onSelect}><strong>{task.title}</strong>{task.description && <span>{task.description}</span>}</button><div className="assignee">{person ? <><span className="avatar small" style={{ background: person.color }}>{person.initials}</span><span>{person.name.split(" ")[0]}</span></> : <span className="unassigned">Unassigned</span>}</div><div className={`due-date ${isTaskOverdue(task, today) ? "overdue" : ""} ${isToday(task.dueDate) ? "today" : ""}`}>{task.dueDate && <CalendarDays size={14} />}{task.dueDate ? isToday(task.dueDate) ? "Today" : formatDate(task.dueDate) : "—"}</div></div>;
}

function TaskDetails({ task, roster, updates, editing, setEditing, onClose, onUpdate, onAddUpdate, onDelete, onComplete }: { task: Task; roster: Person[]; updates: TaskUpdate[]; editing: boolean; setEditing: (value: boolean) => void; onClose: () => void; onUpdate: (changes: Partial<Task>, successMessage?: string) => Promise<boolean>; onAddUpdate: (body: string, progress: number) => Promise<boolean>; onDelete: () => void; onComplete: () => void }) {
  const person = personFor(task.assigneeId, roster);
  return <aside className="details-panel"><div className="details-top"><span className="eyebrow">Task details</span><button className="icon-button" onClick={onClose} aria-label="Close details"><X size={19} /></button></div>{editing ? <EditFields task={task} roster={roster} onUpdate={onUpdate} onDone={() => setEditing(false)} /> : <><div className="details-title"><button className={`task-check large ${task.status === "completed" ? "checked" : ""}`} onClick={onComplete}>{task.status === "completed" && <Check size={15} />}</button><h2>{task.title}</h2></div><div className="detail-meta"><div><span>Assigned to</span><strong>{person ? <><span className="avatar small" style={{ background: person.color }}>{person.initials}</span>{person.name}</> : "Unassigned"}</strong></div><div><span>Due date</span><strong className={isTaskOverdue(task, today) ? "text-overdue" : ""}>{formatDate(task.dueDate)}</strong></div></div><div className="description"><span>Description</span><p>{task.description || "No description added."}</p></div>{task.status === "completed" && <div className="completion-note"><Check size={16} /><span>Completed {task.completedAt ? new Date(task.completedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}{task.completedBy ? ` by ${personFor(task.completedBy, roster)?.name ?? "a team member"}` : ""}</span></div>}<div className="audit"><p>Created by {personFor(task.createdBy, roster)?.name ?? "team member"}</p><p>{new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p></div><div className="details-actions">{task.status === "open" && <button className="secondary-button" onClick={() => setEditing(true)}>Edit task</button>}<button className="danger-button" onClick={onDelete}><Trash2 size={15} /> Delete</button></div></>}<ProgressPanel key={`${task.id}-${task.progress}`} task={task} roster={roster} updates={updates} onUpdate={onUpdate} onAddUpdate={onAddUpdate} /></aside>;
}

function ProgressPanel({ task, roster, updates, onUpdate, onAddUpdate }: { task: Task; roster: Person[]; updates: TaskUpdate[]; onUpdate: (changes: Partial<Task>, successMessage?: string) => Promise<boolean>; onAddUpdate: (body: string, progress: number) => Promise<boolean> }) {
  const [progress, setProgress] = useState(task.progress);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const saveProgress = async () => { setSaving(true); await onUpdate({ progress }, "Progress updated"); setSaving(false); };
  const submitUpdate = async (event: FormEvent) => { event.preventDefault(); if (!body.trim() || saving) return; setSaving(true); const progressSaved = progress === task.progress || await onUpdate({ progress }); const saved = progressSaved && await onAddUpdate(body, progress); setSaving(false); if (saved) setBody(""); };
  return <section className="progress-panel"><div className="progress-heading"><span>Progress</span><strong>{progress}%</strong></div><input className="progress-slider" type="range" min="0" max="99" value={Math.min(progress, 99)} onChange={(event) => setProgress(Number(event.target.value))} aria-label="Task progress" /><button className="secondary-button progress-save" disabled={saving || progress === task.progress || task.status === "completed"} onClick={saveProgress}>{saving ? "Saving..." : "Save progress"}</button><form className="update-form" onSubmit={submitUpdate}><label>Add an update<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="What changed?" /></label><button className="primary-button" disabled={saving || !body.trim()}>{saving ? "Adding..." : "Add update"}</button></form>{updates.length > 0 && <div className="update-history"><span className="update-label">Update history</span>{updates.map((update) => <article className="update-item" key={update.id}><div><strong>{personFor(update.authorId, roster)?.name ?? "Team member"}</strong><time>{new Date(update.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><p>{update.body}</p><small>{update.progress}% complete</small></article>)}</div>}</section>;
}

function EditFields({ task, roster, onUpdate, onDone }: { task: Task; roster: Person[]; onUpdate: (changes: Partial<Task>, successMessage?: string) => Promise<boolean>; onDone: () => void }) {
  const [title, setTitle] = useState(task.title); const [description, setDescription] = useState(task.description); const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? ""); const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); const saved = await onUpdate({ title: title.trim(), description, assigneeId: assigneeId || null, dueDate: dueDate || null }, "Task updated"); setSaving(false); if (saved) onDone(); };
  return <div className="edit-fields"><label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} /></label><label>Assignee<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{roster.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label><label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onDone}>Cancel</button><button className="primary-button" disabled={saving || !title.trim()} onClick={save}>{saving ? "Saving..." : "Save changes"}</button></div></div>;
}

function TaskForm({ roster, actorId, organizationId, remoteMode, onClose, onError, onCreate }: { roster: Person[]; actorId: string; organizationId: string | null; remoteMode: boolean; onClose: () => void; onError: (message: string) => void; onCreate: (task: Task) => void }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [assigneeId, setAssigneeId] = useState(""); const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!title.trim() || saving) return; setSaving(true); const task: Task = { id: crypto.randomUUID(), title: title.trim(), description, assigneeId: assigneeId || null, dueDate: dueDate || null, progress: 0, status: "open", createdAt: new Date().toISOString(), createdBy: actorId, completedAt: null, completedBy: null, deletedAt: null }; if (remoteMode && organizationId) { const { data, error } = await createClient()!.from("tasks").insert({ organization_id: organizationId, title: task.title, description: task.description, assignee_id: task.assigneeId, created_by: actorId, due_date: task.dueDate, progress: 0 }).select().single(); if (error || !data) { onError(error?.message ?? "Could not create task."); setSaving(false); return; } onCreate(rowToTask(data as DatabaseTask)); } else onCreate(task); setSaving(false); };
  return <div className="modal-backdrop"><form className="modal" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">New task</span><h2>Create a task</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div><label>Task title <span className="required">Required</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Prepare monthly report" /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Add a little context for your team..." /></label><div className="form-grid"><label>Assignee<select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{roster.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label><label>Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div><div className="form-actions"><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving || !title.trim()}><Plus size={16} /> {saving ? "Creating..." : "Create task"}</button></div></form></div>;
}

function ConfirmDialog({ title, message, confirm, destructive, onClose, onConfirm }: { title: string; message: string; confirm: string; destructive?: boolean; onClose: () => void; onConfirm: () => void | Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const confirmAction = async () => { if (saving) return; setSaving(true); await onConfirm(); setSaving(false); };
  return <div className="modal-backdrop"><div className="confirm-modal"><span className={`confirm-icon ${destructive ? "red" : ""}`}>{destructive ? <Trash2 size={20} /> : <Check size={20} />}</span><h2>{title}</h2><p>{message}</p><div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose}>Cancel</button><button className={destructive ? "danger-button filled" : "primary-button"} disabled={saving} onClick={confirmAction}>{saving ? "Saving..." : confirm}</button></div></div></div>;
}

function MoreDots() { return <span className="more-dots" aria-hidden="true">•••</span>; }