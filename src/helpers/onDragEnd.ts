import { DropResult } from "@hello-pangea/dnd";
import { Columns } from "../types";

export const onDragEnd = (
  result: DropResult,
  columns: Columns
): Columns => {
  if (!result.destination) return columns;

  const { source, destination, type } = result;

  if (type === "COLUMN") {
    if (source.index === destination.index) return columns;

    const entries = Object.entries(columns);
    const [removed] = entries.splice(source.index, 1);
    entries.splice(destination.index, 0, removed);

    const newColumns: Columns = {};
    entries.forEach(([key, value]) => {
      newColumns[key] = value;
    });

    return newColumns;
  }

  if (source.droppableId !== destination.droppableId) {
    const sourceColumn = columns[source.droppableId];
    const destColumn = columns[destination.droppableId];
    const sourceItems = [...sourceColumn.items];
    const destItems = [...destColumn.items];
    const [removed] = sourceItems.splice(source.index, 1);
    destItems.splice(destination.index, 0, removed);
    return {
      ...columns,
      [source.droppableId]: {
        ...sourceColumn,
        items: sourceItems,
      },
      [destination.droppableId]: {
        ...destColumn,
        items: destItems,
      },
    };
  } else {
    const column = columns[source.droppableId];
    const copiedItems = [...column.items];
    const [removed] = copiedItems.splice(source.index, 1);
    copiedItems.splice(destination.index, 0, removed);
    return {
      ...columns,
      [source.droppableId]: {
        ...column,
        items: copiedItems,
      },
    };
  }
};
