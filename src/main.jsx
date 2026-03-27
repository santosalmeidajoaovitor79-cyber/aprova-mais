import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

function formatUnknownError(error) {
  if (!error) return "Erro desconhecido no bootstrap do React.";
  if (typeof error === "string") return error;
  if (typeof error.message === "string" && error.message.trim()) return error.message.trim();
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function reportBootstrapIssue(kind, payload) {
  const detail = {
    kind,
    at: new Date().toISOString(),
    payload,
  };
  window.__APROVA_BOOT_ERROR__ = detail;
  console.error(`[Aprova bootstrap] ${kind}`, payload);
}

class BootstrapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    reportBootstrapIssue("render_crash", {
      message: formatUnknownError(error),
      stack: typeof error?.stack === "string" ? error.stack : "",
      componentStack: typeof info?.componentStack === "string" ? info.componentStack : "",
    });
    this.setState({ info });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const message = formatUnknownError(this.state.error);
    const componentStack =
      typeof this.state.info?.componentStack === "string" ? this.state.info.componentStack.trim() : "";

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#09090b",
          color: "#f4f4f5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: "min(760px, 100%)",
            borderRadius: 24,
            border: "1px solid rgba(251,113,133,0.22)",
            background: "rgba(24,24,27,0.96)",
            boxShadow: "0 28px 80px rgba(0,0,0,0.45)",
            padding: 24,
          }}
        >
          <p
            style={{
              margin: "0 0 8px 0",
              color: "#fda4af",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Aprova+ bootstrap
          </p>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2 }}>
            O app encontrou um erro no render inicial.
          </h1>
          <p style={{ margin: "12px 0 0 0", color: "#d4d4d8", lineHeight: 1.6 }}>
            Abra o console e procure por <code>[Aprova bootstrap]</code> para ver o erro completo.
          </p>
          <pre
            style={{
              margin: "18px 0 0 0",
              padding: 16,
              borderRadius: 16,
              background: "rgba(0,0,0,0.35)",
              color: "#f5f5f5",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowX: "auto",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {message}
            {componentStack ? `\n\n${componentStack}` : ""}
          </pre>
        </div>
      </div>
    );
  }
}

window.addEventListener("error", (event) => {
  reportBootstrapIssue("window_error", {
    message: event.message || "Erro global sem mensagem.",
    filename: event.filename || "",
    lineno: event.lineno || 0,
    colno: event.colno || 0,
    stack: typeof event.error?.stack === "string" ? event.error.stack : "",
  });
});

window.addEventListener("unhandledrejection", (event) => {
  reportBootstrapIssue("unhandled_rejection", {
    reason: formatUnknownError(event.reason),
    stack: typeof event.reason?.stack === "string" ? event.reason.stack : "",
  });
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Elemento "#root" nao encontrado para montar o Aprova+.');
}

ReactDOM.createRoot(rootElement, {
  onRecoverableError(error, info) {
    reportBootstrapIssue("recoverable_error", {
      message: formatUnknownError(error),
      stack: typeof error?.stack === "string" ? error.stack : "",
      componentStack: typeof info?.componentStack === "string" ? info.componentStack : "",
    });
  },
}).render(
  <React.StrictMode>
    <BootstrapErrorBoundary>
      <App />
    </BootstrapErrorBoundary>
  </React.StrictMode>
);