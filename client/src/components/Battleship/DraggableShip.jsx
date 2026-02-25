import { useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Icon from "../Icon";
import css from "./battleships.module.css";

export default function DraggableShip({ ship }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: ship.name,
      data: { size: ship.size, orientation: ship.orientation },
    });

  const segments = useMemo(() => {
    return Array.from({ length: ship.size }, (_, i) => {
      if (i === 0) return "boatBack";
      if (i === ship.size - 1) return "boatFront";
      return "boatMiddle";
    });
  }, [ship.size]);

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  const isVertical = ship.orientation === "vertical";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
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
