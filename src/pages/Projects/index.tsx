import { useEffect, useMemo, useState } from "react";
import { getBoardData } from "../../services/taskService";
import { Columns, TaskT } from "../../types";
import { useBoards } from "../../context/useBoards";

type TagGroup = {
  title: string;
  count: number;
  tasks: TaskT[];
};

const Projects = () => {
  const { activeBoardId } = useBoards();
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string>("all");

  useEffect(() => {
    const run = async () => {
      try {
        if (!activeBoardId) {
          setColumns({});
          return;
        }
        const data = await getBoardData(activeBoardId);
        setColumns(data);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [activeBoardId]);

  const groups = useMemo<TagGroup[]>(() => {
    const allTasks = Object.values(columns).flatMap((c) => c.items);
    const byTag = new Map<string, TaskT[]>();
    allTasks.forEach((task) => {
      (task.tags || []).forEach((tag) => {
        const key = tag.title.trim();
        if (!key) return;
        const current = byTag.get(key) || [];
        byTag.set(key, [...current, task]);
      });
    });

    const entries: TagGroup[] = Array.from(byTag.entries()).map(
      ([title, tasks]) => ({ title, tasks, count: tasks.length })
    );
    entries.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
    return entries;
  }, [columns]);

  const visibleTasks = useMemo(() => {
    if (selectedTag === "all") {
      return Object.values(columns).flatMap((c) => c.items);
    }
    const group = groups.find((g) => g.title === selectedTag);
    return group?.tasks || [];
  }, [columns, groups, selectedTag]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center py-10">
        <span className="text-lg font-semibold text-gray-200">
          Loading projects...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <div className="text-lg font-bold text-gray-800">Projects</div>
        <div className="text-sm text-gray-600">
          Grouped by task tags (each tag = a project).
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTag("all")}
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${
              selectedTag === "all"
                ? "bg-orange-400 text-white border-orange-400"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          {groups.map((g) => (
            <button
              key={g.title}
              onClick={() => setSelectedTag(g.title)}
              className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                selectedTag === g.title
                  ? "bg-orange-400 text-white border-orange-400"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
              title={`${g.count} tasks`}
            >
              {g.title} ({g.count})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm">
        <div className="text-sm text-gray-600">
          Showing <span className="font-semibold">{visibleTasks.length}</span>{" "}
          tasks
          {selectedTag !== "all" ? (
            <>
              {" "}
              tagged <span className="font-semibold">{selectedTag}</span>
            </>
          ) : null}
          .
        </div>
        {visibleTasks.length === 0 ? (
          <div className="mt-4 text-sm text-gray-600">No tasks found.</div>
        ) : (
          <div className="mt-4 grid md:grid-cols-2 grid-cols-1 gap-3">
            {visibleTasks.map((task) => (
              <div
                key={task.id}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-gray-800">
                    {task.title}
                  </div>
                  <div
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      task.priority === "high"
                        ? "bg-red-100 text-red-700"
                        : task.priority === "medium"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {task.priority || "none"}
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-600">
                  {task.description}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {task.tags?.map((tag) => (
                    <span
                      key={tag.title}
                      className="px-2 py-0.5 text-[12px] font-semibold rounded-md"
                      style={{ backgroundColor: tag.bg, color: tag.text }}
                    >
                      {tag.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
