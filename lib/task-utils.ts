export type TaskView = "all" | "mine" | "overdue" | "soon" | "completed";

export type TaskLike = {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  status: "open" | "completed";
  createdAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

type PersonLike = { id: string; name: string };

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export const isTaskOverdue = (task: TaskLike, today: Date) => Boolean(task.dueDate && task.dueDate < dateKey(today));

export function filterTasks<T extends TaskLike>(tasks: T[], view: TaskView, query: string, actorId: string, people: PersonLike[], today: Date): T[] {
  const todayKey = dateKey(today);
  const soonKey = dateKey(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
  const normalized = query.toLowerCase().trim();
  return tasks
    .filter((task) => !task.deletedAt)
    .filter((task) => {
      if (view === "completed") return task.status === "completed";
      if (task.status === "completed") return false;
      if (view === "mine") return task.assigneeId === actorId;
      if (view === "overdue") return isTaskOverdue(task, today);
      if (view === "soon") return Boolean(task.dueDate && task.dueDate >= todayKey && task.dueDate <= soonKey);
      return true;
    })
    .filter((task) => !normalized || `${task.title} ${task.description} ${people.find((person) => person.id === task.assigneeId)?.name ?? ""}`.toLowerCase().includes(normalized))
    .sort((a, b) => {
      if (view === "completed") return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
      return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || b.createdAt.localeCompare(a.createdAt);
    });
}

export function getTaskCounts(tasks: TaskLike[], actorId: string, today: Date) {
  const active = tasks.filter((task) => task.status === "open" && !task.deletedAt);
  const soonKey = dateKey(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000));
  return {
    all: active.length,
    mine: active.filter((task) => task.assigneeId === actorId).length,
    overdue: active.filter((task) => isTaskOverdue(task, today)).length,
    soon: active.filter((task) => task.dueDate && task.dueDate >= dateKey(today) && task.dueDate <= soonKey).length,
    completed: tasks.filter((task) => task.status === "completed" && !task.deletedAt).length,
  };
}