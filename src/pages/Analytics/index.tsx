import { useEffect, useMemo, useState } from "react";
import { getBoardData } from "../../services/taskService";
import { Columns, TaskT } from "../../types";
import { useBoards } from "../../context/useBoards";

type ProjectMeta = {
  name: string;
  description: string;
  ownerName: string;
  teamMembers: string;
};

const getProjectMetaKey = (boardId: string) =>
  `rtm_project_meta_v1_${boardId}`;

const DEFAULT_PROJECT_META: ProjectMeta = {
  name: "Project",
  description: "",
  ownerName: "Admin",
  teamMembers: "Team",
};

const loadProjectMeta = (boardId: string): ProjectMeta => {
  try {
    const raw = localStorage.getItem(getProjectMetaKey(boardId));
    if (!raw) return DEFAULT_PROJECT_META;
    const parsed = JSON.parse(raw) as Partial<ProjectMeta>;
    return { ...DEFAULT_PROJECT_META, ...parsed };
  } catch {
    return DEFAULT_PROJECT_META;
  }
};

const saveProjectMeta = (boardId: string, meta: ProjectMeta) => {
  try {
    localStorage.setItem(getProjectMetaKey(boardId), JSON.stringify(meta));
  } catch {
    // ignore
  }
};

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
  const { activeBoardId } = useBoards();
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProjectMeta>(DEFAULT_PROJECT_META);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!activeBoardId) {
          setColumns({});
          return;
        }
        const data = await getBoardData(activeBoardId, { autoInit: false });
        setColumns(data);
      } catch (e) {
        if (e && typeof e === "object") {
          const code = "code" in e ? String((e as { code?: unknown }).code) : "";
          const message =
            "message" in e ? String((e as { message?: unknown }).message) : "";
          if (code === "permission-denied") {
            setError(
              `Permission denied while loading analytics (board: ${activeBoardId}).`
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
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeBoardId) return;
    setMeta(loadProjectMeta(activeBoardId));
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeBoardId) return;
    saveProjectMeta(activeBoardId, meta);
  }, [activeBoardId, meta]);

  if (!activeBoardId) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 gap-3">
        <div className="text-xl font-bold text-gray-800">No project selected</div>
        <div className="text-gray-600 text-center max-w-md">
          Open a project first so analytics can calculate tasks, progress, and workload.
        </div>
      </div>
    );
  }

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
    </div>
  );
};

export default Analytics;
