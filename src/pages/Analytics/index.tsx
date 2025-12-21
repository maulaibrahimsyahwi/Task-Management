import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBoardData } from "../../services/taskService";
import { Columns, TaskT } from "../../types";
import { useBoards } from "../../context/useBoards";
import { useProjects } from "../../context/useProjects";
import { getBoardByProjectId } from "../../services/boardService";
import { getProjectById } from "../../services/projectService";
import { subscribeSprints } from "../../services/sprintService";
import type { Project } from "../../types/collaboration";
import type { Sprint } from "../../types/sprints";

type ProjectMeta = {
  name: string;
  description: string;
  ownerName: string;
  teamMembers: string;
};

const getProjectMetaKey = (projectId: string) =>
  `rtm_project_meta_v1_${projectId}`;

const DEFAULT_PROJECT_META: ProjectMeta = {
  name: "Project",
  description: "",
  ownerName: "Admin",
  teamMembers: "Team",
};

const loadProjectMeta = (
  projectId: string,
  defaults: ProjectMeta
): ProjectMeta => {
  try {
    const raw = localStorage.getItem(getProjectMetaKey(projectId));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<ProjectMeta>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
};

const saveProjectMeta = (projectId: string, meta: ProjectMeta) => {
  try {
    localStorage.setItem(getProjectMetaKey(projectId), JSON.stringify(meta));
  } catch {
    // ignore
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

const isClosedListName = (name: string) =>
  /done|closed|complete|completed|finish|selesai/i.test(name);

const formatDateId = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const getInitials = (name: string) => {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const second = parts.length > 1 ? parts[1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
};

const formatNumber = (value: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toFixed(rounded % 1 === 0 ? 0 : 2);
};

const niceStep = (value: number) => {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const pow = Math.pow(10, exponent);
  const fraction = value / pow;

  if (fraction <= 1) return 1 * pow;
  if (fraction <= 2) return 2 * pow;
  if (fraction <= 2.5) return 2.5 * pow;
  if (fraction <= 5) return 5 * pow;
  return 10 * pow;
};

const Analytics = () => {
  const { projectId } = useParams();
  const { projects, activeProjectId, setActiveProjectId } = useProjects();
  const { setActiveBoardId } = useBoards();

  const [project, setProject] = useState<Project | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProjectMeta>(DEFAULT_PROJECT_META);
  const [sprints, setSprints] = useState<Sprint[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setColumns({});
        setProject(null);
        setBoardId(null);

        if (!projectId) {
          setError("No project selected.");
          return;
        }

        if (activeProjectId !== projectId) {
          setActiveProjectId(projectId);
        }

        let resolvedProject = projects.find((p) => p.id === projectId) ?? null;
        if (!resolvedProject) {
          resolvedProject = await getProjectById(projectId);
        }
        if (!resolvedProject) {
          setError("Project not found or you don't have access.");
          return;
        }
        setProject(resolvedProject);

        let resolvedBoardId =
          typeof resolvedProject.defaultBoardId === "string" &&
          resolvedProject.defaultBoardId.trim().length > 0
            ? resolvedProject.defaultBoardId.trim()
            : null;

        if (!resolvedBoardId) {
          const board = await getBoardByProjectId(resolvedProject.id);
          resolvedBoardId = board?.id ?? null;
        }

        if (!resolvedBoardId) {
          setError("This project doesn't have a board yet.");
          setColumns({});
          return;
        }
        setBoardId(resolvedBoardId);
        setActiveBoardId(resolvedBoardId);

        const data = await getBoardData(resolvedBoardId, { autoInit: false });
        setColumns(data);
      } catch (e) {
        if (e && typeof e === "object") {
          const code = "code" in e ? String((e as { code?: unknown }).code) : "";
          const message =
            "message" in e ? String((e as { message?: unknown }).message) : "";
          if (code === "permission-denied") {
            setError(
              `Permission denied while loading analytics (project: ${projectId}).`
            );
          } else {
            setError(message || "Failed to load analytics.");
          }
        } else {
          setError("Failed to load analytics.");
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [
    activeProjectId,
    projectId,
    projects,
    setActiveBoardId,
    setActiveProjectId,
  ]);

  useEffect(() => {
    if (!boardId) return;
    const unsubscribe = subscribeSprints(boardId, setSprints, (err) => {
      console.error("Failed to load sprints for analytics:", err);
    });
    return () => unsubscribe();
  }, [boardId]);

  useEffect(() => {
    if (!projectId) return;
    const defaults: ProjectMeta = {
      ...DEFAULT_PROJECT_META,
      name: project?.name ?? DEFAULT_PROJECT_META.name,
      description: project?.description ?? DEFAULT_PROJECT_META.description,
    };
    setMeta(loadProjectMeta(projectId, defaults));
  }, [project?.description, project?.name, projectId]);

  useEffect(() => {
    if (!projectId) return;
    saveProjectMeta(projectId, meta);
  }, [meta, projectId]);

  const columnMeta = useMemo(() => {
    const metaById: Record<
      string,
      { name: string; stage?: string; wipLimit?: number }
    > = {};
    Object.entries(columns).forEach(([colId, col]) => {
      metaById[colId] = { name: col.name, stage: col.stage, wipLimit: col.wipLimit };
    });
    return metaById;
  }, [columns]);

  const summary = useMemo(() => {
    const allTasks: TaskT[] = [];
    const openTasks: TaskT[] = [];
    const closedTasks: TaskT[] = [];

    let totalEstimateMins = 0;
    let loggedMins = 0;
    let startMs = Number.POSITIVE_INFINITY;
    let lastMs = 0;
    let latestDueMs = 0;

    Object.entries(columns).forEach(([, col]) => {
      const closed = col.stage === "done" || isClosedListName(col.name);
      col.items.forEach((task) => {
        allTasks.push(task);
        totalEstimateMins += task.deadline || 0;
        loggedMins += task.timeLoggedMins || 0;
        if (closed) {
          closedTasks.push(task);
        } else {
          openTasks.push(task);
        }

        if (typeof task.createdAt === "number") {
          startMs = Math.min(startMs, task.createdAt);
          lastMs = Math.max(lastMs, task.createdAt);
        }
        if (typeof task.dueDate === "string") {
          const parsed = Date.parse(task.dueDate);
          if (!Number.isNaN(parsed)) {
            latestDueMs = Math.max(latestDueMs, parsed);
          }
        }
      });
    });

    if (!Number.isFinite(startMs)) startMs = Date.now();
    if (lastMs === 0) lastMs = startMs;
    if (latestDueMs === 0) latestDueMs = startMs + 7 * 24 * 60 * 60 * 1000;

    const totalTasks = allTasks.length;
    const closedCount = closedTasks.length;
    const openCount = openTasks.length;
    const progressPct = totalTasks === 0 ? 0 : Math.round((closedCount / totalTasks) * 100);

    const unassignedCount = allTasks.filter((t) => !t.assigneeId).length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const overdueCount = openTasks.filter((t) => {
      if (!t.dueDate) return false;
      const parsed = Date.parse(t.dueDate);
      if (Number.isNaN(parsed)) return false;
      return parsed < todayStart.getTime();
    }).length;

    const estimateHours = totalEstimateMins / 60;
    const loggedHours = loggedMins / 60;
    const varianceHours = Math.max(0, estimateHours - loggedHours);

    const openPct = totalTasks === 0 ? 0 : Math.round((openCount / totalTasks) * 100);
    const closedPct = totalTasks === 0 ? 0 : Math.max(0, 100 - openPct);

    const maxValue = Math.max(estimateHours, loggedHours, varianceHours, 1);
    const step = niceStep(maxValue / 4);
    const chartMax = step * 4;
    const ticks = [0, step, step * 2, step * 3, chartMax];

    return {
      allTasks,
      openTasks,
      closedTasks,
      openCount,
      closedCount,
      totalTasks,
      progressPct,
      unassignedCount,
      overdueCount,
      openPct,
      closedPct,
      estimateHours,
      loggedHours,
      varianceHours,
      startMs,
      endMs: latestDueMs,
      lastMs,
      chartMax,
      ticks,
    };
  }, [columns]);

  const flowMetrics = useMemo(() => {
    const taskMeta = Object.entries(columns).flatMap(([colId, col]) => {
      const closed = col.stage === "done" || isClosedListName(col.name);
      return col.items.map((task) => ({
        task,
        columnId: colId,
        closed,
        columnName: col.name,
        wipLimit: col.wipLimit,
      }));
    });

    const wipByColumn = Object.entries(columns).map(([colId, col]) => ({
      id: colId,
      name: col.name,
      count: col.items.length,
      wipLimit: col.wipLimit,
    }));

    const overLimit = wipByColumn.filter(
      (w) => typeof w.wipLimit === "number" && w.count > (w.wipLimit ?? 0)
    );

    const closedDurations = taskMeta
      .filter((t) => t.closed)
      .map((t) => {
        if (typeof t.task.createdAt !== "number") return null;
        if (typeof t.task.completedAt !== "number") return null;
        const diff = t.task.completedAt - t.task.createdAt;
        return diff > 0 ? diff / DAY_MS : null;
      })
      .filter((v): v is number => typeof v === "number");

    const averageCycle =
      closedDurations.length === 0
        ? 0
        : closedDurations.reduce((a, b) => a + b, 0) / closedDurations.length;
    const medianCycle = (() => {
      if (!closedDurations.length) return 0;
      const sorted = [...closedDurations].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      return sorted[mid];
    })();

    const throughput7d = taskMeta.filter((t) => {
      if (!t.closed) return false;
      if (typeof t.task.completedAt !== "number") return false;
      return t.task.completedAt >= Date.now() - 7 * DAY_MS;
    }).length;

    const aging = taskMeta
      .filter((t) => !t.closed)
      .map((t) => {
        const created = typeof t.task.createdAt === "number" ? t.task.createdAt : Date.now();
        const age = Math.max(0, Date.now() - created) / DAY_MS;
        return { ...t, age };
      })
      .sort((a, b) => b.age - a.age)
      .slice(0, 3);

    return {
      wipByColumn,
      overLimit,
      averageCycle,
      medianCycle,
      throughput7d,
      aging,
    };
  }, [columns]);

  const sprintAnalytics = useMemo(() => {
    if (!sprints.length) return null;
    const active =
      sprints.find((s) => s.status === "active") ??
      sprints.find((s) => s.status === "planned") ??
      sprints[0];

    if (!active) return null;

    const sprintTasks = summary.allTasks.filter((t) => t.sprintId === active.id);
    const closedSprintTasks = sprintTasks.filter((t) => {
      const status = (t as TaskT & { status?: string }).status;
      const meta = status ? columnMeta[status] : undefined;
      const colStage = meta?.stage;
      const colName = meta?.name || "";
      return colStage === "done" || isClosedListName(colName);
    });

    const total = sprintTasks.length;
    const done = closedSprintTasks.length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

    return {
      active,
      total,
      done,
      open: total - done,
      progress,
    };
  }, [columnMeta, sprints, summary.allTasks]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-200">
          Loading analytics...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 gap-3">
        <div className="text-xl font-bold text-gray-800">Analytics unavailable</div>
        <div className="text-gray-600 text-center max-w-md">{error}</div>
        <Link
          to="/projects"
          className="text-sm font-bold text-orange-500 hover:text-orange-600"
        >
          Go to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
        <div className="flex md:flex-row flex-col gap-8 justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-gray-800">
              Project info &amp; description
            </div>
            {project ? (
              <div className="mt-1 text-sm text-gray-500 font-semibold">
                {project.name}
              </div>
            ) : null}
            <input
              value={meta.name}
              onChange={(e) => setMeta((m) => ({ ...m, name: e.target.value }))}
              className="mt-2 w-full text-sm font-semibold text-gray-700 outline-none bg-transparent"
              placeholder="Project name"
            />
            <textarea
              value={meta.description}
              onChange={(e) =>
                setMeta((m) => ({ ...m, description: e.target.value }))
              }
              placeholder="Add a short project description..."
              className="mt-3 w-full min-h-[90px] resize-none text-sm text-gray-700 outline-none bg-transparent"
            />
          </div>

          <div className="md:w-[520px] w-full flex flex-col gap-5">
            <div className="flex items-start justify-between gap-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 font-semibold w-[110px]">
                    Project admin
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold grid place-items-center text-sm">
                      {getInitials(meta.ownerName)}
                    </div>
                    <input
                      value={meta.ownerName}
                      onChange={(e) =>
                        setMeta((m) => ({ ...m, ownerName: e.target.value }))
                      }
                      className="text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                      placeholder="Admin name"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 font-semibold w-[110px]">
                    Team
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center -space-x-2">
                      {meta.teamMembers
                        .split(",")
                        .map((n) => n.trim())
                        .filter(Boolean)
                        .slice(0, 4)
                        .map((name) => (
                          <div
                            key={name}
                            className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold grid place-items-center text-[11px] border-2 border-white"
                            title={name}
                          >
                            {getInitials(name)}
                          </div>
                        ))}
                    </div>
                    <input
                      value={meta.teamMembers}
                      onChange={(e) =>
                        setMeta((m) => ({ ...m, teamMembers: e.target.value }))
                      }
                      className="text-sm font-semibold text-gray-800 outline-none bg-transparent min-w-0"
                      placeholder="Team (comma separated)"
                    />
                  </div>
                </div>
              </div>

              <div className="min-w-[180px]">
                <div className="text-sm text-gray-500 font-semibold">
                  Progress: {summary.progressPct}%
                </div>
                <div className="mt-2 w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600"
                    style={{ width: `${summary.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
              <div>
                <div className="text-sm text-gray-500 font-semibold">
                  Start date
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-1">
                  {formatDateId(new Date(summary.startMs))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-semibold">
                  End date
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-1">
                  {formatDateId(new Date(summary.endMs))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-semibold">
                  Last change
                </div>
                <div className="text-lg font-semibold text-gray-800 mt-1">
                  {formatDateId(new Date(summary.lastMs))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-gray-800">Tasks</div>

          <div className="mt-5 flex md:flex-row flex-col items-center gap-8">
            <div
              className="relative w-[260px] h-[260px] rounded-full flex-shrink-0"
              style={{
                background: `conic-gradient(from -90deg, #84cc16 0 ${summary.closedPct}%, #9ca3af ${summary.closedPct}% 100%)`,
              }}
              aria-label="Tasks: Open vs Closed"
            >
              <div className="absolute inset-[55px] bg-white rounded-full" />

              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white font-bold text-2xl">
                {summary.closedPct}%
              </div>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white font-bold text-2xl">
                {summary.openPct}%
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <div className="flex items-center gap-3">
                <span className="w-10 h-6 rounded-md bg-gray-400 inline-block" />
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">
                    Open
                  </span>
                  <span className="text-sm font-bold text-gray-800">
                    {summary.openCount}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-6 rounded-md bg-lime-500 inline-block" />
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-semibold text-gray-700">
                    Closed
                  </span>
                  <span className="text-sm font-bold text-gray-800">
                    {summary.closedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 divide-x divide-gray-200">
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-gray-600">Total tasks</span>
              <span className="text-xl font-bold text-gray-800">
                {summary.totalTasks}
              </span>
            </div>
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-gray-600">Unassigned tasks</span>
              <span className="text-xl font-bold text-gray-800">
                {summary.unassignedCount}
              </span>
            </div>
            <div className="flex items-center justify-between px-2">
              <span className="text-sm text-gray-600">Overdue tasks</span>
              <span className="text-xl font-bold text-gray-800">
                {summary.overdueCount}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-bold text-gray-800">Time on tasks</div>
              <div className="text-sm text-gray-600">
                Based on task estimates (deadline mins).
              </div>
            </div>
            <span className="px-4 py-2 rounded-full bg-gray-100 text-gray-800 text-xs font-bold">
              ACTUAL TO PLANNED
            </span>
          </div>

          <div className="relative mt-6 h-[300px]">
            <div className="absolute inset-0">
              {summary.ticks
                .slice()
                .reverse()
                .map((t) => (
                  <div
                    key={t}
                    className="absolute left-0 right-0 flex items-center gap-3"
                    style={{
                      top: `${((summary.chartMax - t) / summary.chartMax) * 100}%`,
                    }}
                  >
                    <span className="w-10 text-xs text-gray-600 text-right">
                      {formatNumber(t)}
                    </span>
                    <div className="flex-1 h-px bg-blue-200/60" />
                  </div>
                ))}
            </div>

            <div className="absolute left-12 right-2 bottom-10 top-0 flex items-end justify-around gap-8">
              {[
                {
                  label: "Total time log",
                  value: summary.loggedHours,
                },
                {
                  label: "Total estimation",
                  value: summary.estimateHours,
                },
                {
                  label: "Variance",
                  value: summary.varianceHours,
                },
              ].map((bar) => {
                const heightPct =
                  summary.chartMax === 0
                    ? 0
                    : Math.max(0, Math.min(1, bar.value / summary.chartMax));
                return (
                  <div
                    key={bar.label}
                    className="flex flex-col items-center justify-end gap-2 w-[110px] h-full"
                  >
                    <div className="w-full flex items-end justify-center h-full">
                      <div
                        className="w-full bg-blue-700 rounded-lg flex items-start justify-center"
                        style={{
                          height: `${heightPct * 100}%`,
                          minHeight: bar.value > 0 ? 8 : 0,
                        }}
                      >
                        {bar.value > 0 ? (
                          <span className="text-white font-bold text-sm mt-2">
                            {formatNumber(bar.value)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-700 text-center">
                      {bar.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="absolute left-12 right-2 bottom-8 h-px bg-gray-200" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 grid-cols-1 gap-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-lg font-bold text-gray-800">Flow health</div>
              <div className="text-sm text-gray-600">
                WIP by column &amp; limit breaches.
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              KANBAN
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {flowMetrics.wipByColumn.map((wip) => (
              <div
                key={wip.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  flowMetrics.overLimit.some((o) => o.id === wip.id)
                    ? "border-red-200 bg-red-50"
                    : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  <span className="text-sm font-semibold text-gray-800">
                    {wip.name}
                  </span>
                </div>
                <div className="text-sm font-bold text-gray-800">
                  {wip.count}
                  {typeof wip.wipLimit === "number" ? ` / ${wip.wipLimit}` : ""}
                </div>
              </div>
            ))}
          </div>

          {flowMetrics.overLimit.length ? (
            <div className="mt-3 text-sm text-red-600 font-semibold">
              Warning: {flowMetrics.overLimit.length} column(s) over WIP limit — tuntaskan dulu sebelum tarik task baru.
            </div>
          ) : (
            <div className="mt-3 text-sm text-green-600 font-semibold">
              WIP masih aman. Jaga ritme kerja.
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-lg font-bold text-gray-800">
                Cycle time &amp; throughput
              </div>
              <div className="text-sm text-gray-600">
                Lead time dihitung dari created → selesai.
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            {[
              {
                label: "Avg cycle (hari)",
                value: flowMetrics.averageCycle,
              },
              {
                label: "Median cycle (hari)",
                value: flowMetrics.medianCycle,
              },
              {
                label: "Throughput (7d)",
                value: flowMetrics.throughput7d,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3"
              >
                <div className="text-xs text-gray-500 font-semibold">
                  {item.label}
                </div>
                <div className="text-xl font-bold text-gray-800 mt-1">
                  {typeof item.value === "number"
                    ? formatNumber(item.value)
                    : item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-800 mb-2">
              Oldest open tasks
            </div>
            {flowMetrics.aging.length === 0 ? (
              <div className="text-sm text-gray-500">Tidak ada task terbuka.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {flowMetrics.aging.map((item) => (
                  <div
                    key={item.task.id}
                    className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-800">
                        {item.task.title || "Untitled task"}
                      </span>
                      <span className="text-xs text-gray-500">
                        Kolom: {item.columnName}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-800">
                      {formatNumber(item.age)}d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {sprintAnalytics ? (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-lg font-bold text-gray-800">
                Sprint analytics
              </div>
              <div className="text-sm text-gray-600">
                Menampilkan sprint aktif / berikutnya.
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold">
              SPRINT
            </span>
          </div>

          <div className="mt-4 grid md:grid-cols-4 grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 font-semibold">Sprint</div>
              <div className="text-lg font-bold text-gray-800">
                {sprintAnalytics.active.name}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold">Status</div>
              <div className="text-sm font-bold text-gray-800 capitalize">
                {sprintAnalytics.active.status}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold">Tasks</div>
              <div className="text-sm font-bold text-gray-800">
                {sprintAnalytics.done}/{sprintAnalytics.total} selesai
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 font-semibold">Dates</div>
              <div className="text-sm font-semibold text-gray-800">
                {sprintAnalytics.active.startDate || "—"} →{" "}
                {sprintAnalytics.active.endDate || "—"}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Progress: {sprintAnalytics.progress}%
            </div>
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600"
                style={{ width: `${sprintAnalytics.progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : sprints.length ? (
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-gray-800">Sprint analytics</div>
          <div className="text-sm text-gray-600 mt-1">
            Belum ada sprint aktif. Aktifkan sprint untuk melihat progress.
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Analytics;
