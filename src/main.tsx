/**
 * Main entry point for the ROI Mailchimp Reporter application
 * Sets up React with StrictMode for development quality checks
 * Renders the main App component to the DOM
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Mount the React application to the DOM
// StrictMode helps identify potential problems in development
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
