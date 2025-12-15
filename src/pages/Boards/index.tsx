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
import { Plus, X } from "lucide-react"; // Tambah icon X
import AddModal from "../../components/Modals/AddModal";
import Task from "../../components/Task";
import {
  getBoardData,
  addTask,
  updateTaskStatus,
  addColumn,
} from "../../services/taskService";

const Home = () => {
  const [columns, setColumns] = useState<Columns>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [loading, setLoading] = useState(true);

  // State untuk input kolom baru
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
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleAddTask = async (taskData: TaskT) => {
    try {
      const newTask = await addTask(taskData, selectedColumn);
      const newBoard = { ...columns };
      newBoard[selectedColumn].items.push(newTask as TaskT);
      setColumns(newBoard);
      closeModal();
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleAddColumn = async () => {
    if (!newColumnTitle.trim()) return;
    try {
      // Simpan ke Firebase
      const newCol = await addColumn(newColumnTitle);

      // Update UI lokal langsung
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

  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    if (source.droppableId !== destination.droppableId) {
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
        <div className="w-full h-full flex items-start px-5 pb-8 gap-6 overflow-x-auto">
          {/* Render Kolom yang Ada */}
          {Object.entries(columns).map(
            ([columnId, column]: [string, Column]) => (
              <div className="flex flex-col gap-0 min-w-[290px]" key={columnId}>
                <Droppable droppableId={columnId} key={columnId}>
                  {(provided: DroppableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex flex-col w-full gap-3 items-center py-5"
                    >
                      <div className="flex items-center justify-center py-[10px] w-full bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px]">
                        {column.name}
                        <span className="ml-2 bg-gray-200 text-xs px-2 py-1 rounded-full text-gray-600">
                          {column.items.length}
                        </span>
                      </div>
                      {column.items.map((task: TaskT, index: number) => (
                        <Draggable
                          key={task.id.toString()}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided: DraggableProvided) => (
                            <Task provided={provided} task={task} />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
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
            )
          )}

          {/* Tombol Add New Column */}
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
      </DragDropContext>

      <AddModal
        isOpen={modalOpen}
        onClose={closeModal}
        setOpen={setModalOpen}
        handleAddTask={handleAddTask}
      />
    </>
  );
};

export default Home;
