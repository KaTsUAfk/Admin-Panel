import React from "react";
import "./Layout.css";
import ThemeToggle from "./ThemeToggle";

const Layout = ({ children }) => {
  return (
    <div className="layout">
      <header
        className="main-header"
        style={{
          background: "linear-gradient(135deg, #DAB76F 0%, #B89A5A 100%)",
          color: "#000",
        }}
      >
        <div className="header-content">
          <h1
            style={{
              color: "#000",
            }}
          >
            Админ-панель
          </h1>
          <ThemeToggle />
        </div>
      </header>
      <main className="main-content">{children}</main>
      <footer
        className="main-footer"
        style={{
          background: "linear-gradient(135deg, #111 0%, #0a0a0a 100%)",
          color: "#b0b0b0",
        }}
      >
        <div className="footer-content" style={{ color: "#DAB76F" }}>
          <p>&copy; 2025 SicretHOME</p>
          <div className="social-links">
            <a
              href="https://t.me/sicret_up"
              target="_blank"
              rel="noopener noreferrer"
              className="telegram-link"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ verticalAlign: "middle", marginRight: "4px" }}
              >
                <path d="M12 1v7l8 5.5-8 5.5V23l-4-3 2-8-2-8z" />
              </svg>
              Telegram
            </a>
            <a
              href="https://sicret.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="website-link"
            >
              Сайт разработчика
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
