export default function Icon({ name, width, height, className, ...props}) {
  const spritePath = "/symbol-defs.svg";

  return (
    <svg className={className} width={width} height={height} {...props}>
      <use href={`${spritePath}#icon-${name}`}></use>
    </svg>
  );
}
