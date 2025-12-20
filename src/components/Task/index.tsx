import { DraggableProvided } from "@hello-pangea/dnd";
import { Clock } from "lucide-react";
import { TaskT } from "../../types";
import type { UiPreferences } from "../../types/ui";
import type { BoardMember } from "../../types/collaboration";

interface TaskProps {
  task: TaskT;
  provided: DraggableProvided;
  onClick: (task: TaskT) => void;
  uiPreferences?: UiPreferences;
  assignee?: BoardMember;
}

const Task = ({ task, provided, onClick, uiPreferences, assignee }: TaskProps) => {
  const { title, description, priority, deadline, image, alt, tags } = task;
  const showImages = uiPreferences?.showImages ?? true;
  const showTags = uiPreferences?.showTags ?? true;
  const showDescriptions = uiPreferences?.showDescriptions ?? true;
  const compactMode = uiPreferences?.compactMode ?? false;
  const checklistItems = task.checklist || [];
  const checklistDone = checklistItems.filter((item) => item.done).length;
  const loggedMins = task.timeLoggedMins || 0;
  const initials = assignee?.displayName
    ? assignee.displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
    : "";

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onClick(task)}
      className={`w-full cursor-grab bg-[#fff] flex flex-col justify-between items-start shadow-sm rounded-xl hover:shadow-md transition-shadow ${
        compactMode ? "gap-2 px-3 py-3" : "gap-3 px-3 py-4"
      }`}
    >
      {showImages && image && (
        <img
          src={image}
          alt={alt || "Task Image"}
          className="w-full h-[170px] rounded-lg object-cover"
        />
      )}

      {showTags ? (
        <div className="flex items-center gap-2">
          {tags?.map((tag) => (
            <span
              key={tag.title}
              className="px-[10px] py-[2px] text-[13px] font-medium rounded-md"
              style={{ backgroundColor: tag.bg, color: tag.text }}
            >
              {tag.title}
            </span>
          ))}
        </div>
      ) : null}
      <div className="w-full flex items-start flex-col gap-0">
        <span className="text-[15.5px] font-medium text-[#555]">{title}</span>
        {showDescriptions ? (
          <span className="text-[13.5px] text-gray-500">{description}</span>
        ) : null}
      </div>
      <div className="w-full border border-dashed border-gray-200"></div>
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Clock color={"#666"} size={19} />
          <span className="text-[13px] text-gray-700">{deadline} mins</span>
        </div>
        <div className="flex items-center gap-2">
          {checklistItems.length > 0 ? (
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {checklistDone}/{checklistItems.length}
            </span>
          ) : null}
          {loggedMins > 0 ? (
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {loggedMins}m
            </span>
          ) : null}
          {assignee ? (
            <div
              className="w-7 h-7 rounded-full bg-indigo-600 text-white text-[11px] font-bold grid place-items-center"
              title={assignee.displayName}
            >
              {initials}
            </div>
          ) : null}
          <div
            className={`w-[60px] rounded-full h-[5px] ${
              priority === "high"
                ? "bg-red-500"
                : priority === "medium"
                ? "bg-orange-500"
                : "bg-blue-500"
            }`}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default Task;
