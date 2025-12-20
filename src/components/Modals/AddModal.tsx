/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useState, useEffect } from "react";
import { getRandomColors } from "../../helpers/getRandomColors";
import { Trash, X } from "lucide-react";
import { getRoleLabel } from "../../helpers/roles";
import type { BoardMember, TaskComment } from "../../types/collaboration";
import type { Attachment, ChecklistItem } from "../../types";
import type { TimeLog } from "../../types/time";
import { useAuth, getUserLabel } from "../../context/useAuth";
import { useBoards } from "../../context/useBoards";
import { addTaskComment, subscribeTaskComments } from "../../services/commentService";
import { logActivity } from "../../services/collaborationService";
import { addTimeLog, subscribeTimeLogs } from "../../services/timeLogService";

interface Tag {
  title: string;
  bg: string;
  text: string;
}

interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleAddTask: (taskData: any) => void;
  selectedTask?: any;
  handleDeleteTask?: (taskId: string) => void;
  members?: BoardMember[];
  currentUserId?: string;
}

const initialTaskData = {
  title: "",
  description: "",
  priority: "",
  deadline: 0,
  dueDate: "",
  assigneeId: "",
  mentions: [] as string[],
  image: "",
  alt: "",
  tags: [] as Tag[],
  checklist: [] as ChecklistItem[],
  attachments: [] as Attachment[],
  timeLoggedMins: 0,
};

const AddModal = ({
  isOpen,
  onClose,
  setOpen,
  handleAddTask,
  selectedTask,
  handleDeleteTask,
  members = [],
  currentUserId,
}: AddModalProps) => {
  const { user, profile } = useAuth();
  const { activeBoardId } = useBoards();
  const [taskData, setTaskData] = useState(initialTaskData);
  const [tagTitle, setTagTitle] = useState("");
  const [errors, setErrors] = useState<{ title?: string }>({});
  const isEditing = Boolean(selectedTask);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentSending, setCommentSending] = useState(false);
  const [checklistText, setChecklistText] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeNote, setTimeNote] = useState("");
  const [timeLogging, setTimeLogging] = useState(false);

  const formatDateTime = (value: number) =>
    new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const createId = () => {
    if ("crypto" in window && "randomUUID" in window.crypto) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const formatBytes = (value?: number) => {
    if (!value) return "";
    if (value < 1024) return `${value} B`;
    const kb = value / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  useEffect(() => {
    if (selectedTask) {
      setTaskData({
        ...initialTaskData,
        ...selectedTask,
        title: selectedTask.title || "",
        description: selectedTask.description || "",
        priority: selectedTask.priority || "",
        deadline:
          typeof selectedTask.deadline === "number"
            ? selectedTask.deadline
            : Number(selectedTask.deadline) || 0,
        dueDate: selectedTask.dueDate || "",
        assigneeId: selectedTask.assigneeId || "",
        mentions: Array.isArray(selectedTask.mentions)
          ? selectedTask.mentions
          : [],
        image: selectedTask.image || "",
        alt: selectedTask.alt || "",
        tags: selectedTask.tags || [],
        checklist: Array.isArray(selectedTask.checklist)
          ? selectedTask.checklist
          : [],
        attachments: Array.isArray(selectedTask.attachments)
          ? selectedTask.attachments
          : [],
        timeLoggedMins:
          typeof selectedTask.timeLoggedMins === "number"
            ? selectedTask.timeLoggedMins
            : 0,
      });
    } else {
      setTaskData(initialTaskData);
    }
    setTagTitle("");
    setErrors({});
    setCommentText("");
    setChecklistText("");
    setAttachmentName("");
    setAttachmentUrl("");
    setAttachmentError(null);
    setTimeMinutes("");
    setTimeNote("");
  }, [selectedTask, isOpen]);

  useEffect(() => {
    if (!selectedTask?.id || !activeBoardId) {
      setComments([]);
      return;
    }
    const unsubscribe = subscribeTaskComments(
      activeBoardId,
      selectedTask.id,
      setComments
    );
    return () => unsubscribe();
  }, [activeBoardId, selectedTask?.id]);

  useEffect(() => {
    if (!selectedTask?.id || !activeBoardId) {
      setTimeLogs([]);
      return;
    }
    return subscribeTimeLogs(activeBoardId, selectedTask.id, setTimeLogs);
  }, [activeBoardId, selectedTask?.id]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    if (name === "deadline") {
      setTaskData({ ...taskData, [name]: Number(value) || 0 });
      return;
    }
    if (name === "title" && errors.title) {
      setErrors((prev) => ({ ...prev, title: undefined }));
    }
    setTaskData({ ...taskData, [name]: value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = function (e) {
        if (e.target) {
          setTaskData({ ...taskData, image: e.target.result as string });
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleAttachmentFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!e.target.files || !e.target.files[0]) return;
    void handleUploadAttachment(e.target.files[0]);
    e.target.value = "";
  };

  const handleAddTag = () => {
    const trimmed = tagTitle.trim();
    if (trimmed === "") return;
    const exists = taskData.tags.some(
      (tag) => tag.title.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setTagTitle("");
      return;
    }
    const { bg, text } = getRandomColors();
    const newTag: Tag = { title: trimmed, bg, text };
    setTaskData({ ...taskData, tags: [...taskData.tags, newTag] });
    setTagTitle("");
  };

  const handleRemoveTag = (index: number) => {
    setTaskData({
      ...taskData,
      tags: taskData.tags.filter((_, i) => i !== index),
    });
  };

  const handleAddChecklistItem = () => {
    const trimmed = checklistText.trim();
    if (!trimmed) return;
    const nextItem: ChecklistItem = {
      id: createId(),
      text: trimmed,
      done: false,
    };
    setTaskData((prev) => ({
      ...prev,
      checklist: [...(prev.checklist || []), nextItem],
    }));
    setChecklistText("");
  };

  const handleToggleChecklistItem = (id: string) => {
    setTaskData((prev) => ({
      ...prev,
      checklist: (prev.checklist || []).map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      ),
    }));
  };

  const handleRemoveChecklistItem = (id: string) => {
    setTaskData((prev) => ({
      ...prev,
      checklist: (prev.checklist || []).filter((item) => item.id !== id),
    }));
  };

  const handleAddAttachmentLink = () => {
    const url = attachmentUrl.trim();
    if (!url) return;
    const name = attachmentName.trim() || url.replace(/^https?:\/\//, "");
    setAttachmentError(null);
    const nextAttachment: Attachment = {
      id: createId(),
      name,
      url,
      createdAt: Date.now(),
      createdBy: user?.uid || "unknown",
    };
    setTaskData((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), nextAttachment],
    }));
    setAttachmentName("");
    setAttachmentUrl("");
  };

  const handleRemoveAttachment = (id: string) => {
    setTaskData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((att) => att.id !== id),
    }));
  };

  const handleUploadAttachment = async (file: File) => {
    if (!activeBoardId || !selectedTask?.id || !user) return;
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      setAttachmentError(
        "Cloudinary config missing. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET."
      );
      return;
    }
    setAttachmentError(null);
    setAttachmentUploading(true);
    try {
      const id = createId();
      const folder =
        import.meta.env.VITE_CLOUDINARY_FOLDER || "attachments";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);
      formData.append(
        "folder",
        `${folder}/${activeBoardId}/${selectedTask.id}`
      );
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || "Upload failed.");
      }
      const resolvedName = data?.original_filename
        ? data.format
          ? `${data.original_filename}.${data.format}`
          : data.original_filename
        : file.name;
      const nextAttachment: Attachment = {
        id: String(data.public_id || id),
        name: resolvedName,
        url: data.secure_url || data.url || "",
        size: typeof data.bytes === "number" ? data.bytes : file.size,
        type: data.resource_type || file.type,
        createdAt: Date.now(),
        createdBy: user.uid,
      };
      setTaskData((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), nextAttachment],
      }));
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Upload failed."
      );
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleLogTime = async () => {
    if (!selectedTask?.id || !activeBoardId || !user) return;
    const minutes = Number(timeMinutes);
    if (!minutes || Number.isNaN(minutes) || minutes <= 0) return;
    setTimeLogging(true);
    try {
      await addTimeLog({
        boardId: activeBoardId,
        taskId: selectedTask.id,
        userId: user.uid,
        userName: getUserLabel(user, profile),
        minutes,
        note: timeNote,
      });
      setTaskData((prev) => ({
        ...prev,
        timeLoggedMins: (prev.timeLoggedMins || 0) + minutes,
      }));
      setTimeMinutes("");
      setTimeNote("");
    } finally {
      setTimeLogging(false);
    }
  };

  const handleToggleMention = (uid: string) => {
    setTaskData((prev) => {
      const exists = prev.mentions.includes(uid);
      return {
        ...prev,
        mentions: exists
          ? prev.mentions.filter((id) => id !== uid)
          : [...prev.mentions, uid],
      };
    });
  };

  const handleClearImage = () => {
    setTaskData({ ...taskData, image: "", alt: "" });
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user || !activeBoardId || !selectedTask?.id) {
      return;
    }
    setCommentSending(true);
    try {
      await addTaskComment({
        boardId: activeBoardId,
        taskId: selectedTask.id,
        message: commentText,
        authorUid: user.uid,
        authorName: getUserLabel(user, profile),
      });
      await logActivity({
        boardId: activeBoardId,
        actorUid: user.uid,
        actorName: getUserLabel(user, profile),
        message: `commented on "${selectedTask.title}"`,
        taskId: selectedTask.id,
        type: "task:comment",
      });
      setCommentText("");
    } finally {
      setCommentSending(false);
    }
  };

  const closeModal = useCallback(() => {
    setOpen(false);
    onClose();
    setTaskData(initialTaskData);
    setTagTitle("");
    setErrors({});
    setCommentText("");
    setChecklistText("");
    setAttachmentName("");
    setAttachmentUrl("");
    setAttachmentError(null);
    setTimeMinutes("");
    setTimeNote("");
    setTimeLogs([]);
  }, [onClose, setOpen]);

  const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    const trimmedTitle = taskData.title.trim();
    if (!trimmedTitle) {
      setErrors({ title: "Title is required." });
      return;
    }
    handleAddTask({ ...taskData, title: trimmedTitle });
    if (!selectedTask) {
      setTaskData(initialTaskData);
      setTagTitle("");
    }
    setErrors({});
  };

  const onDelete = () => {
    if (handleDeleteTask && selectedTask?.id) {
      if (window.confirm("Are you sure you want to delete this task?")) {
        handleDeleteTask(selectedTask.id);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeModal]);

  const checklistItems = taskData.checklist || [];
  const checklistDone = checklistItems.filter((item) => item.done).length;
  const loggedFromLogs = timeLogs.reduce(
    (sum, log) => sum + (log.minutes || 0),
    0
  );
  const totalLogged = Math.max(taskData.timeLoggedMins || 0, loggedFromLogs);

  return (
    <div
      className={`fixed inset-0 z-50 items-center justify-center ${
        isOpen ? "flex" : "hidden"
      }`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
        onClick={closeModal}
      ></div>
      <div
        className="relative w-[92%] md:w-[720px] max-h-[90vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-100"
        role="dialog"
        aria-modal="true"
      >
        <form className="flex flex-col gap-5 p-6" onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-gray-800">
                {isEditing ? "Edit Task" : "Add Task"}
              </div>
              <div className="text-sm text-gray-500">
                Fill in the task details below.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-red-600 hover:bg-red-50 text-sm font-semibold"
                  title="Delete Task"
                >
                  <Trash size={16} />
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-full hover:bg-gray-100"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={taskData.title}
                onChange={handleChange}
                placeholder="Task title"
                autoFocus
                className={`mt-2 w-full h-11 px-3 outline-none rounded-md bg-slate-100 border text-sm font-medium ${
                  errors.title ? "border-red-400" : "border-slate-300"
                }`}
              />
              {errors.title ? (
                <div className="mt-1 text-xs text-red-500">{errors.title}</div>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                value={taskData.description}
                onChange={handleChange}
                placeholder="What needs to be done?"
                className="mt-2 w-full min-h-[90px] resize-none px-3 py-2 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
              />
            </div>

            <div className="grid md:grid-cols-3 grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Priority
                </label>
                <select
                  name="priority"
                  onChange={handleChange}
                  value={taskData.priority}
                  className="mt-2 w-full h-11 px-2 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                >
                  <option value="">Select priority</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Estimation (mins)
                </label>
                <input
                  type="number"
                  name="deadline"
                  min={0}
                  step={5}
                  value={taskData.deadline}
                  onChange={handleChange}
                  placeholder="0"
                  className="mt-2 w-full h-11 px-3 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Due date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  value={taskData.dueDate}
                  onChange={handleChange}
                  className="mt-2 w-full h-11 px-3 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Assign to
                </label>
                <select
                  name="assigneeId"
                  onChange={handleChange}
                  value={taskData.assigneeId}
                  className="mt-2 w-full h-11 px-2 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                >
                  <option value="">Unassigned</option>
                  {members.map((member) => (
                    <option key={member.uid} value={member.uid}>
                      {member.displayName} ({getRoleLabel(member.role)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Mentions
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {members.length === 0 ? (
                    <span className="text-xs text-gray-500">
                      No members yet.
                    </span>
                  ) : (
                    members.map((member) => {
                      const selected = taskData.mentions.includes(member.uid);
                      return (
                        <button
                          key={member.uid}
                          type="button"
                          onClick={() => handleToggleMention(member.uid)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            selected
                              ? "bg-orange-400 text-white border-orange-400"
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                          }`}
                          title={member.email}
                        >
                          {member.displayName}
                          {member.uid === currentUserId ? " (You)" : ""}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Mentioned members will be notified in activity feed.
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Tags</label>
              <div className="mt-2 flex md:flex-row flex-col gap-2">
                <input
                  type="text"
                  value={tagTitle}
                  onChange={(e) => setTagTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add a tag"
                  className="w-full h-11 px-3 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                />
                <button
                  type="button"
                  className="md:w-auto w-full px-4 h-11 rounded-md bg-slate-700 text-white font-semibold hover:bg-slate-800"
                  onClick={handleAddTag}
                >
                  Add tag
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Press Enter to add quickly.
              </div>
              <div className="mt-2 w-full flex flex-wrap gap-2">
                {taskData.tags.map((tag, index) => (
                  <span
                    key={`${tag.title}-${index}`}
                    className="inline-flex items-center gap-1 px-[10px] py-[4px] text-[13px] font-medium rounded-md"
                    style={{ backgroundColor: tag.bg, color: tag.text }}
                  >
                    {tag.title}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(index)}
                      className="ml-1 hover:opacity-70"
                      title="Remove tag"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700">
                  Checklist
                </label>
                <span className="text-xs text-gray-500">
                  {checklistDone}/{checklistItems.length}
                </span>
              </div>
              <div className="mt-2 flex md:flex-row flex-col gap-2">
                <input
                  type="text"
                  value={checklistText}
                  onChange={(e) => setChecklistText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="Add checklist item"
                  className="w-full h-11 px-3 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="md:w-auto w-full px-4 h-11 rounded-md bg-slate-700 text-white font-semibold hover:bg-slate-800"
                >
                  Add item
                </button>
              </div>
              {checklistItems.length === 0 ? (
                <div className="mt-2 text-xs text-gray-500">
                  No checklist items yet.
                </div>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {checklistItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() => handleToggleChecklistItem(item.id)}
                      />
                      <span className={item.done ? "line-through opacity-60" : ""}>
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveChecklistItem(item.id)}
                        className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                      >
                        Remove
                      </button>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">
                Attachments
              </label>
              <div className="mt-2 grid md:grid-cols-2 grid-cols-1 gap-2">
                <input
                  type="text"
                  value={attachmentName}
                  onChange={(e) => setAttachmentName(e.target.value)}
                  placeholder="Attachment name"
                  className="h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
                />
                <input
                  type="url"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  placeholder="https://link-to-file"
                  className="h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddAttachmentLink}
                  className="px-3 py-1.5 rounded-md bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800"
                >
                  Add link
                </button>
                <label className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                  isEditing
                    ? "bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleAttachmentFileChange}
                    disabled={!isEditing || attachmentUploading}
                  />
                  {attachmentUploading ? "Uploading..." : "Upload file"}
                </label>
                {!isEditing ? (
                  <span className="text-xs text-gray-500">
                    Save the task to enable uploads.
                  </span>
                ) : null}
              </div>
              {taskData.attachments && taskData.attachments.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  {taskData.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-gray-800 truncate hover:underline"
                        >
                          {att.name}
                        </a>
                        <span className="text-xs text-gray-500">
                          {att.type || "link"} {att.size ? `· ${formatBytes(att.size)}` : ""}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(att.id)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-500">
                  No attachments yet.
                </div>
              )}
              {attachmentError ? (
                <div className="mt-2 text-xs text-red-500">
                  {attachmentError}
                </div>
              ) : null}
            </div>

            {isEditing ? (
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Comments
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full h-11 px-3 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddComment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    disabled={commentSending || !commentText.trim()}
                    className="px-4 h-11 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
                  >
                    Post
                  </button>
                </div>
                {comments.length === 0 ? (
                  <div className="mt-3 text-xs text-gray-500">
                    No comments yet.
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 max-h-[160px] overflow-y-auto">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                      >
                        <div className="text-xs font-semibold text-gray-700">
                          {comment.authorName}
                        </div>
                        <div className="text-sm text-gray-800">
                          {comment.message}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          {formatDateTime(comment.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {isEditing ? (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">
                    Time tracking
                  </label>
                  <span className="text-xs text-gray-500">
                    Logged: {totalLogged} mins
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    type="number"
                    min={0}
                    value={timeMinutes}
                    onChange={(e) => setTimeMinutes(e.target.value)}
                    placeholder="Minutes"
                    className="w-[120px] h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
                  />
                  <input
                    type="text"
                    value={timeNote}
                    onChange={(e) => setTimeNote(e.target.value)}
                    placeholder="Note (optional)"
                    className="flex-1 h-11 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleLogTime}
                    disabled={timeLogging || !timeMinutes.trim()}
                    className="px-4 h-11 rounded-md bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
                  >
                    {timeLogging ? "Logging..." : "Log time"}
                  </button>
                </div>
                {timeLogs.length === 0 ? (
                  <div className="mt-3 text-xs text-gray-500">
                    No time logs yet.
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 max-h-[160px] overflow-y-auto">
                    {timeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
                      >
                        <div className="text-xs font-semibold text-gray-700">
                          {log.userName} · {log.minutes} mins
                        </div>
                        {log.note ? (
                          <div className="text-sm text-gray-800">{log.note}</div>
                        ) : null}
                        <div className="text-[11px] text-gray-500 mt-1">
                          {formatDateTime(log.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid md:grid-cols-2 grid-cols-1 gap-3 items-start">
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Image
                </label>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mt-2 w-full text-sm"
                />
                {taskData.image ? (
                  <div className="mt-3 relative w-full">
                    <img
                      src={taskData.image}
                      alt={taskData.alt || "Task image preview"}
                      className="w-full h-[160px] rounded-lg object-cover border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="absolute top-2 right-2 bg-white/90 text-gray-700 text-xs font-semibold px-2 py-1 rounded-md shadow-sm hover:bg-white"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">
                  Image alt text
                </label>
                <input
                  type="text"
                  name="alt"
                  value={taskData.alt}
                  onChange={handleChange}
                  placeholder="Short description for the image"
                  className="mt-2 w-full h-11 px-3 outline-none rounded-md bg-slate-100 border border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              Fields marked with * are required.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 h-10 rounded-md bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 h-10 rounded-md bg-orange-400 text-white font-semibold hover:bg-orange-500"
              >
                {isEditing ? "Update Task" : "Create Task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddModal;
