import type { BoardMember } from "../../types/collaboration";
import type { Sprint } from "../../types/sprints";
import type { BoardFilters, SwimlaneMode } from "./boardTypes";

type BoardFiltersBarProps = {
  filters: BoardFilters;
  swimlane: SwimlaneMode;
  tags: string[];
  members: BoardMember[];
  sprints: Sprint[];
  onChangeFilters: (patch: Partial<BoardFilters>) => void;
  onChangeSwimlane: (next: SwimlaneMode) => void;
  onClear: () => void;
};

const BoardFiltersBar = ({
  filters,
  swimlane,
  tags,
  members,
  sprints,
  onChangeFilters,
  onChangeSwimlane,
  onClear,
}: BoardFiltersBarProps) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
      <select
        value={filters.assignee}
        onChange={(e) => onChangeFilters({ assignee: e.target.value })}
        className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
      >
        <option value="all">All assignees</option>
        {members.map((member) => (
          <option key={member.uid} value={member.uid}>
            {member.displayName}
          </option>
        ))}
      </select>
      <select
        value={filters.priority}
        onChange={(e) => onChangeFilters({ priority: e.target.value })}
        className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
      >
        <option value="all">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select
        value={filters.tag}
        onChange={(e) => onChangeFilters({ tag: e.target.value })}
        className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
      >
        <option value="all">All tags</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      <select
        value={filters.due}
        onChange={(e) => onChangeFilters({ due: e.target.value })}
        className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
      >
        <option value="all">All due dates</option>
        <option value="today">Due today</option>
        <option value="week">Due this week</option>
        <option value="overdue">Overdue</option>
        <option value="none">No due date</option>
      </select>
      <select
        value={filters.sprint}
        onChange={(e) => onChangeFilters({ sprint: e.target.value })}
        className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
      >
        <option value="all">All sprints</option>
        <option value="active">Active sprint</option>
        <option value="backlog">Backlog only</option>
        {sprints.map((sprint) => (
          <option key={sprint.id} value={sprint.id}>
            {sprint.name}
          </option>
        ))}
      </select>
      <select
        value={swimlane}
        onChange={(e) => onChangeSwimlane(e.target.value as SwimlaneMode)}
        className="h-9 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
      >
        <option value="none">No swimlane</option>
        <option value="assignee">Swimlane: Assignee</option>
        <option value="priority">Swimlane: Priority</option>
      </select>
      <button
        type="button"
        onClick={onClear}
        className="h-9 px-3 rounded-md bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200"
      >
        Clear filters
      </button>
    </div>
  );
};

export default BoardFiltersBar;

