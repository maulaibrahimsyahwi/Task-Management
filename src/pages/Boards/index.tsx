import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DroppableProvided,
  DraggableProvided,
} from "@hello-pangea/dnd";
import { useState } from "react";
import { Board } from "../../data/board";
import { Columns, Column, TaskT } from "../../types";
import { onDragEnd } from "../../helpers/onDragEnd";
import { Plus } from "lucide-react";
import AddModal from "../../components/Modals/AddModal";
import Task from "../../components/Task";

const Home = () => {
  const [columns, setColumns] = useState<Columns>(Board);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");

  const openModal = (columnId: string) => {
    setSelectedColumn(columnId);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleAddTask = (taskData: TaskT) => {
    const newBoard = { ...columns };
    newBoard[selectedColumn].items.push(taskData);
  };

  return (
    <>
      <DragDropContext
        onDragEnd={(result: DropResult) =>
          onDragEnd(result, columns, setColumns)
        }
      >
        <div className="w-full flex items-start justify-between px-5 pb-8 md:gap-0 gap-10">
          {Object.entries(columns).map(
            ([columnId, column]: [string, Column]) => (
              <div className="w-full flex flex-col gap-0" key={columnId}>
                <Droppable droppableId={columnId} key={columnId}>
                  {(provided: DroppableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex flex-col md:w-[290px] w-[250px] gap-3 items-center py-5"
                    >
                      <div className="flex items-center justify-center py-[10px] w-full bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px]">
                        {column.name}
                      </div>
                      {column.items.map((task: TaskT, index: number) => (
                        <Draggable
                          key={task.id.toString()}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided: DraggableProvided) => (
                            <>
                              <Task provided={provided} task={task} />
                            </>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                <div
                  onClick={() => openModal(columnId)}
                  className="flex cursor-pointer items-center justify-center gap-1 py-[10px] md:w-[90%] w-full opacity-90 bg-white rounded-lg shadow-sm text-[#555] font-medium text-[15px]"
                >
                  <Plus color={"#555"} size={20} />
                  Add Task
                </div>
              </div>
            )
          )}
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
