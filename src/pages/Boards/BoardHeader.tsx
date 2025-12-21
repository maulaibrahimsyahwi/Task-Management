import type { BoardMember } from "../../types/collaboration";

type BoardHeaderProps = {
  title: string;
  description: string;
  sprintText: string;
  members: BoardMember[];
  roleLabel: string;
};

const getInitials = (displayName: string) =>
  displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const BoardHeader = ({
  title,
  description,
  sprintText,
  members,
  roleLabel,
}: BoardHeaderProps) => {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="text-xl font-bold text-gray-800">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
        <div className="text-xs text-gray-500 mt-1">{sprintText}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {members.slice(0, 5).map((member) => (
            <div
              key={member.id}
              className="w-8 h-8 rounded-full bg-indigo-600 text-white text-[11px] font-bold grid place-items-center border-2 border-white"
              title={member.displayName}
            >
              {getInitials(member.displayName)}
            </div>
          ))}
        </div>
        <span className="text-xs font-semibold text-gray-500 capitalize">
          {roleLabel}
        </span>
      </div>
    </div>
  );
};

export default BoardHeader;

