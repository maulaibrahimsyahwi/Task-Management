import { useEffect, useMemo, useState } from "react";
import { useAuth, getUserLabel } from "../../context/useAuth";
import { useBoards } from "../../context/useBoards";
import { getBoardData, subscribeBoardData } from "../../services/taskService";
import { logActivity, subscribeBoardMembers } from "../../services/collaborationService";
import {
  createAutomationRule,
  deleteAutomationRule,
  subscribeAutomationRules,
  updateAutomationRule,
} from "../../services/automationService";
import type { Columns } from "../../types";
import type { BoardMember } from "../../types/collaboration";
import type {
  AutomationActionType,
  AutomationRule,
  AutomationTrigger,
} from "../../types/automation";

const Workflows = () => {
  const { user, profile } = useAuth();
  const { activeBoardId } = useBoards();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [columns, setColumns] = useState<Columns>({});
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [ruleName, setRuleName] = useState("");
  const [trigger, setTrigger] = useState<AutomationTrigger>("task:move");
  const [columnId, setColumnId] = useState("");
  const [actionType, setActionType] = useState<AutomationActionType>("assign");
  const [actionValue, setActionValue] = useState<string>("");

  useEffect(() => {
    if (!activeBoardId) {
      setColumns({});
      return;
    }
    return subscribeBoardData(activeBoardId, setColumns);
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeBoardId) {
      setMembers([]);
      return;
    }
    return subscribeBoardMembers(activeBoardId, setMembers);
  }, [activeBoardId]);

  useEffect(() => {
    if (!activeBoardId) {
      setRules([]);
      return;
    }
    return subscribeAutomationRules(activeBoardId, setRules);
  }, [activeBoardId]);

  const columnOptions = useMemo(
    () =>
      Object.entries(columns).map(([id, col]) => ({
        id,
        name: col.name,
      })),
    [columns]
  );

  const exportJson = async () => {
    try {
      setBusy(true);
      setMessage(null);
      if (!activeBoardId) {
        setMessage("Select a board first.");
        return;
      }
      const data = await getBoardData(activeBoardId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `board-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage("Exported board data.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const copyJson = async () => {
    try {
      setBusy(true);
      setMessage(null);
      if (!activeBoardId) {
        setMessage("Select a board first.");
        return;
      }
      const data = await getBoardData(activeBoardId);
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setMessage("Copied board JSON to clipboard.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Copy failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRule = async () => {
    if (!activeBoardId || !user || !ruleName.trim()) return;
    if (trigger === "task:move" && !columnId) return;
    let parsedValue: string | number = actionValue;
    if (actionType === "set_due_in_days") {
      const days = Number(actionValue);
      if (!days || Number.isNaN(days) || days <= 0) return;
      parsedValue = days;
    }
    if (actionType === "assign" && !actionValue) return;
    if (actionType === "set_priority" && !actionValue) return;

    const rule = await createAutomationRule({
      boardId: activeBoardId,
      name: ruleName.trim(),
      trigger,
      columnId: trigger === "task:move" ? columnId : undefined,
      actionType,
      actionValue: parsedValue,
      createdBy: user.uid,
    });
    await logActivity({
      boardId: activeBoardId,
      actorUid: user.uid,
      actorName: getUserLabel(user, profile),
      message: `added automation "${rule.name}"`,
      type: "automation:create",
    });
    setRuleName("");
    setActionValue("");
  };

  const toggleRule = async (rule: AutomationRule) => {
    await updateAutomationRule(rule.id, { enabled: !rule.enabled });
  };

  const removeRule = async (rule: AutomationRule) => {
    if (!activeBoardId || !user) return;
    await deleteAutomationRule(rule.id);
    await logActivity({
      boardId: activeBoardId,
      actorUid: user.uid,
      actorName: getUserLabel(user, profile),
      message: `deleted automation "${rule.name}"`,
      type: "automation:delete",
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 pb-8">
      <div className="bg-white rounded-lg p-5 shadow-sm">
        <div className="text-lg font-bold text-gray-800">Workflows</div>
        <div className="text-sm text-gray-600">
          Quick utilities and automation rules.
        </div>
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm flex flex-col gap-3">
        <button
          onClick={exportJson}
          disabled={busy}
          className="w-full md:w-[260px] px-4 py-2 rounded-md bg-orange-400 text-white font-semibold hover:bg-orange-500 disabled:opacity-60"
        >
          Export board JSON
        </button>
        <button
          onClick={copyJson}
          disabled={busy}
          className="w-full md:w-[260px] px-4 py-2 rounded-md bg-gray-900 text-white font-semibold hover:bg-gray-800 disabled:opacity-60"
        >
          Copy board JSON
        </button>
        {message ? (
          <div className="text-sm text-gray-700">{message}</div>
        ) : null}
      </div>

      <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-100">
        <div className="text-lg font-bold text-gray-800">Automation rules</div>
        <div className="text-sm text-gray-600">
          Apply automatic actions when tasks are created or moved.
        </div>

        <div className="mt-4 grid md:grid-cols-5 grid-cols-1 gap-3">
          <input
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="Rule name"
            className="h-10 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
          />
          <select
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}
            className="h-10 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="task:create">On task create</option>
            <option value="task:move">On task move</option>
          </select>
          <select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="h-10 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
            disabled={trigger !== "task:move"}
          >
            <option value="">Select column</option>
            {columnOptions.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
          <select
            value={actionType}
            onChange={(e) =>
              setActionType(e.target.value as AutomationActionType)
            }
            className="h-10 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
          >
            <option value="assign">Assign member</option>
            <option value="set_due_in_days">Set due in days</option>
            <option value="set_priority">Set priority</option>
          </select>
          {actionType === "assign" ? (
            <select
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              className="h-10 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
            >
              <option value="">Select member</option>
              {members.map((member) => (
                <option key={member.uid} value={member.uid}>
                  {member.displayName}
                </option>
              ))}
            </select>
          ) : actionType === "set_priority" ? (
            <select
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              className="h-10 px-2 rounded-md bg-slate-100 border border-slate-300 text-sm"
            >
              <option value="">Select priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          ) : (
            <input
              type="number"
              min={1}
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              placeholder="Days"
              className="h-10 px-3 rounded-md bg-slate-100 border border-slate-300 outline-none text-sm"
            />
          )}
        </div>

        <button
          type="button"
          onClick={handleCreateRule}
          disabled={!ruleName.trim()}
          className="mt-3 px-4 py-2 rounded-md bg-orange-400 text-white text-sm font-semibold hover:bg-orange-500 disabled:opacity-60"
        >
          Add automation
        </button>

        <div className="mt-5 flex flex-col gap-3">
          {rules.length === 0 ? (
            <div className="text-sm text-gray-600">
              No automation rules yet.
            </div>
          ) : (
            rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-800">
                    {rule.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {rule.trigger} · {rule.actionType}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRule(rule)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                      rule.enabled
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {rule.enabled ? "Enabled" : "Disabled"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRule(rule)}
                    className="px-3 py-1.5 rounded-md bg-red-100 text-red-600 text-xs font-semibold hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Workflows;
