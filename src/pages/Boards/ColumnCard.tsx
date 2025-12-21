import {
  Draggable,
  Droppable,
  type DraggableProvided,
  type DroppableProvided,
} from "@hello-pangea/dnd";
import { Plus, Settings, Trash2 } from "lucide-react";
import { useMemo } from "react";
import Task from "../../components/Task";
import type { Column, TaskT } from "../../types";
import type { BoardMember } from "../../types/collaboration";
import type { UiPreferences } from "../../types/ui";
import type { ColumnEditState, SwimlaneMode } from "./boardTypes";

type SwimlaneGroup = { key: string; label: string; tasks: TaskT[] };

const getSwimlaneGroups = (
  tasks: TaskT[],
  swimlane: SwimlaneMode,
  members: BoardMember[]
): SwimlaneGroup[] => {
  if (swimlane === "none") {
    return [{ key: "all", label: "All tasks", tasks }];
  }

  const groups = new Map<string, SwimlaneGroup>();
  const pushTask = (key: string, label: string, task: TaskT) => {
    const existing = groups.get(key);
    if (existing) {
      existing.tasks.push(task);
      return;
    }
    groups.set(key, { key, label, tasks: [task] });
  };

  if (swimlane === "assignee") {
    const nameById = new Map(
      members.map((member) => [member.uid, member.displayName])
    );
    tasks.forEach((task) => {
      const key = task.assigneeId || "unassigned";
      const label =
        key === "unassigned" ? "Unassigned" : nameById.get(key) || "Member";
      pushTask(key, label, task);
    });
    const orderedKeys = [
      ...members.map((member) => member.uid).filter((key) => groups.has(key)),
      ...(groups.has("unassigned") ? ["unassigned"] : []),
    ];
    const extraKeys = Array.from(groups.keys()).filter(
      (key) => !orderedKeys.includes(key)
    );
    return [...orderedKeys, ...extraKeys]
      .map((key) => groups.get(key))
      .filter(Boolean) as SwimlaneGroup[];
  }

  const order = ["high", "medium", "low", "none"];
  tasks.forEach((task) => {
    const key = task.priority || "none";
    const label =
      key === "high"
        ? "High"
        : key === "medium"
        ? "Medium"
        : key === "low"
        ? "Low"
        : "None";
    pushTask(key, label, task);
  });
  const orderedKeys = order.filter((key) => groups.has(key));
  const extraKeys = Array.from(groups.keys()).filter(
    (key) => !orderedKeys.includes(key)
  );
  return [...orderedKeys, ...extraKeys]
    .map((key) => groups.get(key))
    .filter(Boolean) as SwimlaneGroup[];
};

type ColumnCardProps = {
  columnId: string;
  column: Column;
  provided: DraggableProvided;
  isFiltering: boolean;
  canManageLists: boolean;
  members: BoardMember[];
  uiPreferences?: UiPreferences;
  swimlane: SwimlaneMode;
  matchesFilters: (task: TaskT) => boolean;
  columnEdit: ColumnEditState;
  onStartEdit: (columnId: string, column: Column) => void;
  onChangeEdit: (patch: Partial<Omit<ColumnEditState, "columnId">>) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onOpenAddTask: (columnId: string) => void;
  onOpenTask: (task: TaskT) => void;
  onDeleteColumn: (columnId: string) => void;
};

const ColumnCard = ({
  columnId,
  column,
  provided,
  isFiltering,
  canManageLists,
  members,
  uiPreferences,
  swimlane,
  matchesFilters,
  columnEdit,
  onStartEdit,
  onChangeEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenAddTask,
  onOpenTask,
  onDeleteColumn,
}: ColumnCardProps) => {
  const isEditing = columnEdit.columnId === columnId;

  const memberByUid = useMemo(() => {
    const map = new Map<string, BoardMember>();
    members.forEach((m) => map.set(m.uid, m));
    return map;
  }, [members]);

  const visibleTasks = useMemo(
    () => column.items.filter(matchesFilters),
    [column.items, matchesFilters]
  );

  const groups = useMemo(
    () => getSwimlaneGroups(visibleTasks, swimlane, members),
    [members, swimlane, visibleTasks]
  );

  const countText = useMemo(() => {
    if (isFiltering) return `${visibleTasks.length} / ${column.items.length}`;
    if (column.wipLimit) return `${column.items.length} / ${column.wipLimit}`;
    return String(column.items.length);
  }, [column.items.length, column.wipLimit, isFiltering, visibleTasks.length]);

  const wipReached =
    typeof column.wipLimit === "number" &&
    column.wipLimit > 0 &&
    column.items.length >= column.wipLimit;

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className="flex flex-col gap-0 min-w-[290px]"
    >
      <Droppable
        droppableId={columnId}
        key={columnId}
        isDropDisabled={isFiltering}
      >
        {(droppableProvided: DroppableProvided) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className="flex flex-col w-full gap-3 items-center py-5"
          >
            <div
              {...provided.dragHandleProps}
              className={`flex items-center justify-between py-[10px] w-full bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px] px-3 ${
                wipReached ? "border border-red-200" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                {column.name}
                <span className="bg-gray-200 text-xs px-2 py-1 rounded-full text-gray-600">
                  {countText}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canManageLists ? (
                  <button
                    type="button"
                    onClick={() => onStartEdit(columnId, column)}
                    className="text-gray-400 hover:text-gray-700"
                    title="Column settings"
                  >
                    <Settings size={16} />
                  </button>
                ) : null}
                <Trash2
                  size={18}
                  className="text-gray-400 hover:text-red-500 cursor-pointer"
                  onClick={() => onDeleteColumn(columnId)}
                />
              </div>
            </div>

            {isEditing ? (
              <div className="w-full bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={columnEdit.name}
                    onChange={(e) => onChangeEdit({ name: e.target.value })}
                    className="w-full h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
                    placeholder="List name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      value={columnEdit.wipLimit}
                      onChange={(e) =>
                        onChangeEdit({ wipLimit: e.target.value })
                      }
                      className="w-full h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
                      placeholder="WIP limit"
                    />
                    <select
                      value={columnEdit.stage}
                      onChange={(e) =>
                        onChangeEdit({
                          stage: e.target.value as ColumnEditState["stage"],
                        })
                      }
                      className="w-full h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
                    >
                      <option value="">Stage (auto)</option>
                      <option value="backlog">Backlog</option>
                      <option value="todo">To do</option>
                      <option value="in_progress">In progress</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="px-3 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onSaveEdit}
                      className="px-3 py-1.5 rounded-md bg-orange-400 text-white text-xs font-semibold hover:bg-orange-500"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {(() => {
              let taskIndex = 0;
              return groups.map((group) => (
                <div key={group.key} className="w-full flex flex-col gap-2">
                  {swimlane !== "none" ? (
                    <div className="w-full text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                      {group.label}
                    </div>
                  ) : null}
                  {group.tasks.map((task: TaskT) => {
                    const index = taskIndex;
                    taskIndex += 1;
                    return (
                      <Draggable
                        key={task.id.toString()}
                        draggableId={task.id.toString()}
                        index={index}
                        isDragDisabled={isFiltering}
                      >
                        {(taskProvided: DraggableProvided) => (
                          <Task
                            provided={taskProvided}
                            task={task}
                            onClick={onOpenTask}
                            assignee={
                              task.assigneeId
                                ? memberByUid.get(task.assigneeId)
                                : undefined
                            }
                            uiPreferences={uiPreferences}
                          />
                        )}
                      </Draggable>
                    );
                  })}
                </div>
              ));
            })()}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
      <div
        onClick={() => onOpenAddTask(columnId)}
        className="flex cursor-pointer items-center justify-center gap-1 py-[10px] w-full opacity-90 bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px] hover:bg-gray-50 transition-colors"
      >
        <Plus color={"#555"} size={20} />
        Add Task
      </div>
    </div>
  );
};

export default ColumnCard;

