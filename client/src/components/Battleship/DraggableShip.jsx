import { useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Icon from "../Icon";
import css from "./battleships.module.css";

export default function DraggableShip({
  ship,
  isOverlay = false,
  onRotate,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: ship.name,
      data: { size: ship.size, orientation: ship.orientation },
    });

  const displayOrientation =
    !ship.placed && !isOverlay ? "horizontal" : ship.orientation;
  const shipOpacity = isDragging && !isOverlay ? 0.5 : 1;
  const appliedTransform = isOverlay ? transform : null;

  const segments = useMemo(() => {
    return Array.from({ length: ship.size }, (_, i) => {
      if (i === 0) return "boatBack";
      if (i === ship.size - 1) return "boatFront";
      return "boatMiddle";
    });
  }, [ship.size]);

  const style = {
    transform: CSS.Translate.toString(appliedTransform),
    opacity: shipOpacity,

    cursor: isOverlay ? "grabbing" : "grab",
  };

  const isVertical = displayOrientation === "vertical";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onRotate}
      className={`${css.ship} ${isDragging ? css.isDragging : ""} ${isVertical ? css.shipVertical : ""}`}
    >
      {segments.map((iconName, index) => (
        <div className={css.shipCell} key={index}>
          <Icon
            name={iconName}
            width="32px"
            height="32px"
            className={css.shipIcon}
          />
        </div>
      ))}
    </div>
  );
}
