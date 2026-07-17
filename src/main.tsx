import React from "react";
import ReactDOM from "react-dom/client";
import "@douyinfe/semi-ui/react19-adapter";
import "@douyinfe/semi-ui/lib/es/_base/base.css";
import "./components/ui/KocotreeUi.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
