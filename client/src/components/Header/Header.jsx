import css from "./header.module.css";
import Icon from "../Icon";
import logo from "../../assets/battleship.svg";

export default function Header({ wins, loses, onlinePlayers }) {
  return (
    <header className={css.header}>
      <h1
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        Battleship - Multiplayer Online Game
      </h1>
      <div className={css.headerContainer}>
        <div className={css.headerLogos}>
          <a
            href="https://www.figma.com/community/file/954838223155879312"
            target="_blank"
            rel="noreferrer"
            className={css.headerLink}
          >
            <Icon name="figma" className={css.headerLogoFigma} />
          </a>
          <span className={css.headerLine}></span>
          <img src={logo} alt="Battleship Logo" className={css.headerLogo} />
        </div>

        <div className={css.headerCount}>
          <span className={css.headerCountValue}>Wins: {wins}</span>
          <span className={css.headerCountValue}>Loses: {loses}</span>
          <span className={css.headerCountValue}>Online: {onlinePlayers} </span>
        </div>
      </div>
    </header>
  );
}
