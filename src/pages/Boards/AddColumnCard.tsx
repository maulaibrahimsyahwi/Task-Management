import { Plus, X } from "lucide-react";
import { useState } from "react";

type AddColumnCardVariant = "board" | "empty";

type AddColumnCardProps = {
  canManage: boolean;
  onAdd: (title: string) => Promise<boolean> | boolean;
  variant: AddColumnCardVariant;
  addText: string;
  disabledText?: string;
};

const AddColumnCard = ({
  canManage,
  onAdd,
  variant,
  addText,
  disabledText = "Admin only",
}: AddColumnCardProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    const ok = await onAdd(nextTitle);
    if (!ok) return;
    setTitle("");
    setOpen(false);
  };

  const collapsedClassName =
    variant === "empty"
      ? "w-full rounded-lg p-3 flex items-center justify-center gap-2 font-medium bg-gray-100 hover:bg-gray-200 cursor-pointer text-gray-700"
      : `w-full rounded-lg p-3 flex items-center gap-2 font-medium transition-all ${
          canManage
            ? "bg-white/50 hover:bg-white/80 cursor-pointer text-gray-700"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        }`;

  const expandedClassName =
    variant === "empty"
      ? "w-full bg-white rounded-lg p-3 shadow-sm flex flex-col gap-2 border border-gray-200"
      : "w-full bg-white rounded-lg p-3 shadow-sm flex flex-col gap-2";

  if (!open) {
    return (
      <div
        onClick={() => {
          if (canManage) setOpen(true);
        }}
        className={collapsedClassName}
      >
        <Plus size={20} />
        <span>{canManage ? addText : disabledText}</span>
      </div>
    );
  }

  return (
    <div className={expandedClassName}>
      <input
        autoFocus
        type="text"
        placeholder="Enter list title..."
        className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:border-orange-400"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          className="px-3 py-1 bg-orange-400 text-white rounded text-sm hover:bg-orange-500"
        >
          Add list
        </button>
        <X
          size={20}
          className="cursor-pointer text-gray-500 hover:text-gray-700"
          onClick={() => setOpen(false)}
        />
      </div>
    </div>
  );
};

export default AddColumnCard;
