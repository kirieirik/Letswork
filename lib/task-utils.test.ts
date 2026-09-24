import { describe, expect, it } from "vitest";
import { filterTasks, getTaskCounts } from "./task-utils";

const today = new Date("2026-09-24T12:00:00Z");
const people = [{ id: "emma", name: "Emma Johansson" }, { id: "lars", name: "Lars Nilsson" }];
const tasks = [
  { id: "overdue", title: "Old task", description: "Needs attention", assigneeId: "emma", dueDate: "2026-09-23", status: "open" as const, createdAt: "2026-09-20", completedAt: null, deletedAt: null },
  { id: "soon", title: "Prepare report", description: "Sales figures", assigneeId: "lars", dueDate: "2026-09-25", status: "open" as const, createdAt: "2026-09-21", completedAt: null, deletedAt: null },
  { id: "none", title: "Archive files", description: "No deadline", assigneeId: null, dueDate: null, status: "open" as const, createdAt: "2026-09-22", completedAt: null, deletedAt: null },
  { id: "done", title: "Finished task", description: "Done", assigneeId: "emma", dueDate: null, status: "completed" as const, createdAt: "2026-09-18", completedAt: "2026-09-23T14:00:00Z", deletedAt: null },
  { id: "deleted", title: "Hidden task", description: "Deleted", assigneeId: "emma", dueDate: null, status: "open" as const, createdAt: "2026-09-22", completedAt: null, deletedAt: "2026-09-23T10:00:00Z" },
];

describe("task filters", () => {
  it("filters overdue, due soon, completed, and deleted tasks", () => {
    expect(filterTasks(tasks, "overdue", "", "emma", people, today).map((task) => task.id)).toEqual(["overdue"]);
    expect(filterTasks(tasks, "soon", "", "emma", people, today).map((task) => task.id)).toEqual(["soon"]);
    expect(filterTasks(tasks, "completed", "", "emma", people, today).map((task) => task.id)).toEqual(["done"]);
    expect(filterTasks(tasks, "all", "", "emma", people, today).map((task) => task.id)).toEqual(["overdue", "soon", "none"]);
  });

  it("searches title, description, and assignee", () => {
    expect(filterTasks(tasks, "all", "sales", "emma", people, today).map((task) => task.id)).toEqual(["soon"]);
    expect(filterTasks(tasks, "all", "emma", "lars", people, today).map((task) => task.id)).toEqual(["overdue"]);
  });

  it("counts active, assigned, overdue, soon, and completed tasks", () => {
    expect(getTaskCounts(tasks, "emma", today)).toEqual({ all: 3, mine: 1, overdue: 1, soon: 1, completed: 1 });
  });
});