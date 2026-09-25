import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { checkProductionNotifications } from "./pages/NotificationService";

import Dashboard from "./pages/Dashboard";
import Looms from "./pages/Looms";
import Shops from "./pages/Shops";
import Workers from "./pages/Workers";
import Warps from "./pages/Warps";
import Bobins from "./pages/Bobins";
import Production from "./pages/Production";
import Delivery from "./pages/Delivery";
import WorkerPayments from "./pages/WorkerPayments";
import Reports from "./pages/Report";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";

import "./App.css";

/* =========================================================
   ICONS
   ========================================================= */

function Icon({ name }) {
  const icons = {
    dashboard: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),

    loom: (
      <svg viewBox="0 0 24 24">
        <path d="M4 5h16" />
        <path d="M6 5v14" />
        <path d="M18 5v14" />
        <path d="M4 19h16" />
        <path d="M8 8h8" />
        <path d="M8 12h8" />
        <path d="M8 16h8" />
      </svg>
    ),

    shop: (
      <svg viewBox="0 0 24 24">
        <path d="M4 10h16" />
        <path d="M5 10v10h14V10" />
        <path d="M3 10l2-6h14l2 6" />
        <path d="M8 20v-5h8v5" />
      </svg>
    ),

    worker: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c.8-4 3.4-6 8-6s7.2 2 8 6" />
      </svg>
    ),

    warp: (
      <svg viewBox="0 0 24 24">
        <path d="M7 3v18" />
        <path d="M12 3v18" />
        <path d="M17 3v18" />
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </svg>
    ),

    bobin: (
      <svg viewBox="0 0 24 24">
        <path d="M8 4h8" />
        <path d="M6 7h12" />
        <path d="M5 10h14" />
        <path d="M6 17h12" />
        <path d="M8 20h8" />
        <path d="M7 7v10" />
        <path d="M17 7v10" />
      </svg>
    ),

    production: (
      <svg viewBox="0 0 24 24">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 16v-4" />
        <path d="M11 16V8" />
        <path d="M15 16v-6" />
        <path d="M19 16V6" />
      </svg>
    ),

    delivery: (
      <svg viewBox="0 0 24 24">
        <path d="M3 6h11v11H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="19" r="2" />
        <circle cx="18" cy="19" r="2" />
      </svg>
    ),

    payments: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </svg>
    ),

    reports: (
      <svg viewBox="0 0 24 24">
        <path d="M5 20V10" />
        <path d="M12 20V4" />
        <path d="M19 20v-7" />
      </svg>
    ),

    history: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),

    notification: (
      <svg viewBox="0 0 24 24">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    ),

    settings: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V22h-2.6v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1A1.7 1.7 0 0 0 8 17a1.7 1.7 0 0 0-1.6-1H6v-2.6h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V7h2.6v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1V15h-.1a1.7 1.7 0 0 0-1.6 0z" />
      </svg>
    ),

    menu: (
      <svg viewBox="0 0 24 24">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </svg>
    ),

    logout: (
      <svg viewBox="0 0 24 24">
        <path d="M10 5H5v14h5" />
        <path d="M14 8l4 4-4 4" />
        <path d="M18 12H9" />
      </svg>
    ),

    bell: (
      <svg viewBox="0 0 24 24">
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    ),

    info: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v6" />
        <path d="M12 7h.01" />
      </svg>
    ),
  };

  return <span className="icon">{icons[name] || null}</span>;
}

/* =========================================================
   NAVIGATION
   ========================================================= */

const navigation = [
  {
    title: "Overview",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        icon: "dashboard",
      },
    ],
  },

  {
    title: "Management",
    items: [
      {
        key: "looms",
        label: "Looms",
        icon: "loom",
      },
      {
        key: "shops",
        label: "Shops",
        icon: "shop",
      },
      {
        key: "workers",
        label: "Workers",
        icon: "worker",
      },
    ],
  },

  {
    title: "Operations",
    items: [
      {
        key: "warps",
        label: "Warps",
        icon: "warp",
      },
      {
        key: "bobins",
        label: "Bobins",
        icon: "bobin",
      },
      {
        key: "production",
        label: "Daily Production History",
        icon: "production",
      },
      {
        key: "delivery",
        label: "Delivery",
        icon: "delivery",
      },
    ],
  },

  {
    title: "Finance & Reports",
    items: [
      {
        key: "worker-payments",
        label: "Worker Payments",
        icon: "payments",
      },
      {
        key: "reports",
        label: "Reports",
        icon: "reports",
      },
    ],
  },

  {
    title: "System",
    items: [
      {
        key: "notifications",
        label: "Notifications",
        icon: "notification",
      },
      {
        key: "settings",
        label: "Settings",
        icon: "settings",
      },
    ],
  },
];

/* =========================================================
   PAGE TITLES
   ========================================================= */

const pageTitles = {
  dashboard: "Dashboard",
  looms: "Looms",
  shops: "Shops",
  workers: "Workers",
  warps: "Warps",
  bobins: "Bobins",
  production: "Daily Production History",
  delivery: "Delivery",
  "worker-payments": "Worker Payments",
  reports: "Reports",
  notifications: "Notifications",
  settings: "Settings",
};

/* =========================================================
   PAGE RENDERER
   ========================================================= */

function renderPage(page) {
  switch (page) {
    case "dashboard":
      return <Dashboard />;

    case "looms":
      return <Looms />;

    case "shops":
      return <Shops />;

    case "workers":
      return <Workers />;

    case "warps":
      return <Warps />;

    case "bobins":
      return <Bobins />;

    case "production":
      return <Production />;

    case "delivery":
      return <Delivery />;

    case "worker-payments":
      return <WorkerPayments />;

    case "reports":
      return <Reports />;

    case "notifications":
      return <Notifications />;

    case "settings":
      return <Settings />;

    default:
      return <Dashboard />;
  }
}

/* =========================================================
   LOGIN SCREEN
   ========================================================= */

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    onLogin(data.session);

    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-decoration">
        <div className="login-pattern" />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark large">
            PL
          </div>

          <div>
            <strong>POWER LOOM</strong>
            <span>MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <div className="login-heading">
          <h1>Welcome back</h1>

          <p>
            Sign in to manage your power loom operations.
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <div className="form-group">
            <label htmlFor="login-email">
              Email
            </label>

            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">
              Password
            </label>

            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="settings-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          Power Loom Management System
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN APP
   ========================================================= */

function App() {
  const [session, setSession] = useState(null);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [currentPage, setCurrentPage] =
    useState("dashboard");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [unreadCount, setUnreadCount] =
    useState(0);

  /* -------------------------------------------------------
     AUTH
     ------------------------------------------------------- */

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(
          "Session error:",
          error
        );
      }

      if (mounted) {
        setSession(data?.session || null);
        setAuthLoading(false);
      }
    }

    loadSession();

    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
      }
    );

    return () => {
      mounted = false;

      listener?.subscription?.unsubscribe();
    };
  }, []);

  /* -------------------------------------------------------
     NOTIFICATION PERMISSION
     ------------------------------------------------------- */

  useEffect(() => {
    if (!session) return;

    async function requestPermission() {
      if (
        typeof window === "undefined" ||
        !("Notification" in window)
      ) {
        return;
      }

      if (
        Notification.permission ===
        "default"
      ) {
        try {
          await Notification.requestPermission();
        } catch (error) {
          console.error(
            "Notification permission error:",
            error
          );
        }
      }
    }

    requestPermission();
  }, [session]);

  /* -------------------------------------------------------
     AUTOMATIC PRODUCTION NOTIFICATIONS
     ------------------------------------------------------- */

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    async function runNotificationCheck() {
      if (cancelled) return;

      try {
        await checkProductionNotifications();
      } catch (error) {
        console.error(
          "Notification check error:",
          error
        );
      }
    }

    runNotificationCheck();

    const interval = setInterval(
      runNotificationCheck,
      60 * 1000
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session]);

  /* -------------------------------------------------------
     UNREAD NOTIFICATION COUNT
     ------------------------------------------------------- */

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    async function loadUnreadCount() {
      const {
        count,
        error,
      } = await supabase
        .from("notifications")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("is_read", false);

      if (error) {
        console.error(
          "Unread notification error:",
          error
        );
        return;
      }

      if (!cancelled) {
        setUnreadCount(count || 0);
      }
    }

    loadUnreadCount();

    const interval = setInterval(
      loadUnreadCount,
      30 * 1000
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session, currentPage]);

  /* -------------------------------------------------------
     LOGOUT
     ------------------------------------------------------- */

  async function handleLogout() {
    const confirmed = window.confirm(
      "Are you sure you want to sign out?"
    );

    if (!confirmed) return;

    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.error(
        "Logout error:",
        error
      );
      return;
    }

    setSession(null);
    setCurrentPage("dashboard");
    setSidebarOpen(false);
  }

  /* -------------------------------------------------------
     NAVIGATION
     ------------------------------------------------------- */

  function navigateTo(page) {
    setCurrentPage(page);
    setSidebarOpen(false);
  }

  /* -------------------------------------------------------
     LOADING
     ------------------------------------------------------- */

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-card">
          <div className="brand-mark">
            PL
          </div>

          <h2>
            Power Loom Management
          </h2>

          <p>
            Loading application...
          </p>
        </div>
      </div>
    );
  }

  /* -------------------------------------------------------
     LOGIN
     ------------------------------------------------------- */

  if (!session) {
    return (
      <LoginScreen
        onLogin={(newSession) =>
          setSession(newSession)
        }
      />
    );
  }

  const currentTitle =
    pageTitles[currentPage] ||
    "Dashboard";

  const userEmail =
    session.user?.email || "User";

  const userInitial =
    userEmail.charAt(0).toUpperCase();

  return (
    <div className="app-shell">

      {/* =================================================
          SIDEBAR
          ================================================= */}

      <aside
        className={`app-sidebar ${
          sidebarOpen
            ? "sidebar-open"
            : ""
        }`}
      >
        <div className="sidebar-brand">
          <div className="brand-mark">
            PL
          </div>

          <div className="brand-text">
            <strong>POWER LOOM</strong>
            <span>MANAGEMENT SYSTEM</span>
          </div>
        </div>

        <nav className="sidebar-navigation">
          {navigation.map((section) => (
            <div
              className="nav-section"
              key={section.title}
            >
              <div className="nav-section-title">
                {section.title}
              </div>

              {section.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`nav-item ${
                    currentPage === item.key
                      ? "active"
                      : ""
                  }`}
                  onClick={() =>
                    navigateTo(item.key)
                  }
                >
                  <Icon name={item.icon} />

                  <span>
                    {item.label}
                  </span>

                  {item.key ===
                    "notifications" &&
                    unreadCount > 0 && (
                      <span className="nav-badge">
                        {unreadCount > 99
                          ? "99+"
                          : unreadCount}
                      </span>
                    )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {userInitial}
            </div>

            <div className="sidebar-user-info">
              <strong>
                Administrator
              </strong>

              <span>
                {userEmail}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            <Icon name="logout" />

            <span>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* =================================================
          MOBILE OVERLAY
          ================================================= */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      {/* =================================================
          MAIN AREA
          ================================================= */}

      <main className="app-main">

        {/* =================================================
            HEADER
            ================================================= */}

        <header className="top-header">
          <div className="header-left">

            <button
              type="button"
              className="mobile-menu-button"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open menu"
            >
              <Icon name="menu" />
            </button>

            <div className="header-breadcrumbs-wrap">
              <div className="breadcrumb">
                <span className="breadcrumb-root">Power Loom ERP</span>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-current">{currentTitle}</span>
              </div>
            </div>
          </div>

          <div className="header-actions">

            <button
              type="button"
              className="header-icon-button"
              onClick={() =>
                navigateTo("notifications")
              }
              aria-label="Notifications"
            >
              <Icon name="bell" />

              {unreadCount > 0 && (
                <span className="header-notification-dot">
                  {unreadCount > 99
                    ? "99+"
                    : unreadCount}
                </span>
              )}
            </button>

            <div className="header-divider" />

            <div className="header-user">
              <div className="header-avatar">
                {userInitial}
              </div>

              <div className="header-user-info">
                <strong>
                  Administrator
                </strong>

                <span>
                  {userEmail}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* =================================================
            PAGE
            ================================================= */}

        {renderPage(currentPage)}

      </main>
    </div>
  );
}

export default App;