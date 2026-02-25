import css from "./header.module.css";
import Icon from "../Icon";
import logo from "../../assets/battleship.svg";

export default function Header({ wins, loses }) {
  return (
    <header className={css.header}>
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
        </div>
      </div>
    </header>
  );
}
