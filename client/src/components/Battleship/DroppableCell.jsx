import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import css from "./battleships.module.css";

const DroppableCell = memo(({ id, children, previewCells }) => {
  const { setNodeRef } = useDroppable({
    id: id,
  });

  const isPreview = previewCells.includes(id);

  return (
    <div
      ref={setNodeRef}
      className={`${css.cell} ${isPreview ? css.cellPreview : ""}`}
    >
      {children}
    </div>
  );
});

export default DroppableCell;
