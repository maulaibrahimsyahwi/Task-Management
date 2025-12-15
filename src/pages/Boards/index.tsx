import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
} from "@hello-pangea/dnd";
import { useState, useEffect } from "react";
import { Columns, Column, TaskT } from "../../types";
import { onDragEnd } from "../../helpers/onDragEnd";
import { Plus, X, Trash2 } from "lucide-react";
import AddModal from "../../components/Modals/AddModal";
import Task from "../../components/Task";
import {
  getBoardData,
  addTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  addColumn,
  deleteColumn,
} from "../../services/taskService";

const Home = () => {
  const [columns, setColumns] = useState<Columns>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskT | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const fetchTasks = async () => {
    try {
      const data = await getBoardData();
      setColumns(data);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const openModal = (columnId: string) => {
    setSelectedColumn(columnId);
    setSelectedTask(null);
    setModalOpen(true);
  };

  const openEditModal = (task: TaskT) => {
    setSelectedTask(task);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedTask(null);
  };

  const handleSaveTask = async (taskData: TaskT) => {
    try {
      if (selectedTask) {
        await updateTask(taskData);
        const newColumns = { ...columns };
        Object.keys(newColumns).forEach((colId) => {
          const taskIndex = newColumns[colId].items.findIndex(
            (t) => t.id === taskData.id
          );
          if (taskIndex > -1) {
            newColumns[colId].items[taskIndex] = taskData;
          }
        });
        setColumns(newColumns);
      } else {
        const newTask = await addTask(taskData, selectedColumn);
        const newBoard = { ...columns };
        newBoard[selectedColumn].items.push(newTask as TaskT);
        setColumns(newBoard);
      }
      closeModal();
    } catch (error) {
      console.error("Error saving task:", error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      const newColumns = { ...columns };
      Object.keys(newColumns).forEach((colId) => {
        newColumns[colId].items = newColumns[colId].items.filter(
          (t) => t.id !== taskId
        );
      });
      setColumns(newColumns);
      closeModal();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      const newCol = await addColumn(newColumnTitle);
      setColumns({
        ...columns,
        [newCol.id]: { name: newCol.name, items: [] },
      });
      setNewColumnTitle("");
      setIsAddingColumn(false);
    } catch (error) {
      console.error("Error adding column:", error);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this list? All tasks in it will be lost."
      )
    )
      return;
    try {
      await deleteColumn(columnId);
      const newColumns = { ...columns };
      delete newColumns[columnId];
      setColumns(newColumns);
    } catch (error) {
      console.error("Error deleting column:", error);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId, type } = result;

    if (!destination) return;

    if (type !== "COLUMN" && source.droppableId !== destination.droppableId) {
      updateTaskStatus(draggableId, destination.droppableId);
    }

    onDragEnd(result, columns, setColumns);
  };

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <span className="text-xl font-bold text-gray-500">
          Loading Board...
        </span>
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="all-columns"
          direction="horizontal"
          type="COLUMN"
        >
          {(provided: DroppableProvided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="w-full h-full flex items-start px-5 pb-8 gap-6 overflow-x-auto"
            >
              {Object.entries(columns).map(
                ([columnId, column]: [string, Column], index: number) => (
                  <Draggable
                    draggableId={columnId}
                    index={index}
                    key={columnId}
                  >
                    {(provided: DraggableProvided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="flex flex-col gap-0 min-w-[290px]"
                      >
                        <Droppable droppableId={columnId} key={columnId}>
                          {(droppableProvided: DroppableProvided) => (
                            <div
                              ref={droppableProvided.innerRef}
                              {...droppableProvided.droppableProps}
                              className="flex flex-col w-full gap-3 items-center py-5"
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="flex items-center justify-between py-[10px] w-full bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px] px-3"
                              >
                                <div className="flex items-center gap-2">
                                  {column.name}
                                  <span className="bg-gray-200 text-xs px-2 py-1 rounded-full text-gray-600">
                                    {column.items.length}
                                  </span>
                                </div>
                                <Trash2
                                  size={18}
                                  className="text-gray-400 hover:text-red-500 cursor-pointer"
                                  onClick={() => handleDeleteColumn(columnId)}
                                />
                              </div>

                              {column.items.map(
                                (task: TaskT, index: number) => (
                                  <Draggable
                                    key={task.id.toString()}
                                    draggableId={task.id.toString()}
                                    index={index}
                                  >
                                    {(provided: DraggableProvided) => (
                                      <Task
                                        provided={provided}
                                        task={task}
                                        onClick={openEditModal}
                                      />
                                    )}
                                  </Draggable>
                                )
                              )}
                              {droppableProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                        <div
                          onClick={() => openModal(columnId)}
                          className="flex cursor-pointer items-center justify-center gap-1 py-[10px] w-full opacity-90 bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px] hover:bg-gray-50 transition-colors"
                        >
                          <Plus color={"#555"} size={20} />
                          Add Task
                        </div>
                      </div>
                    )}
                  </Draggable>
                )
              )}
              {provided.placeholder}

              <div className="min-w-[290px] py-5">
                {!isAddingColumn ? (
                  <div
                    onClick={() => setIsAddingColumn(true)}
                    className="w-full bg-white/50 hover:bg-white/80 cursor-pointer rounded-lg p-3 flex items-center gap-2 text-gray-700 font-medium transition-all"
                  >
                    <Plus size={20} />
                    <span>Add another list</span>
                  </div>
                ) : (
                  <div className="w-full bg-white rounded-lg p-3 shadow-sm flex flex-col gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Enter list title..."
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:border-orange-400"
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddColumn()}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAddColumn}
                        className="px-3 py-1 bg-orange-400 text-white rounded text-sm hover:bg-orange-500"
                      >
                        Add list
                      </button>
                      <X
                        size={20}
                        className="cursor-pointer text-gray-500 hover:text-gray-700"
                        onClick={() => setIsAddingColumn(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <AddModal
        isOpen={modalOpen}
        onClose={closeModal}
        setOpen={setModalOpen}
        handleAddTask={handleSaveTask}
        selectedTask={selectedTask}
        handleDeleteTask={handleDeleteTask}
      />
    </>
  );
};

export default Home;
