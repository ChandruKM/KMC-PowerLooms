import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Settings() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Database Management states
  const [purgeModal, setPurgeModal] = useState(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [dbSuccess, setDbSuccess] = useState("");
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const localSession = localStorage.getItem("powerloom_admin_session");
    if (localSession) {
      try {
        const parsed = JSON.parse(localSession);
        if (parsed?.user?.user_metadata?.username || parsed?.user?.email) {
          setEmail(parsed.user.user_metadata?.username || parsed.user.email || "chandru");
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      setEmail(user.email || "");
    } else {
      setEmail("chandru");
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage("");
    setError("");

    const newPassword = e.target.newPassword.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (newPassword.length < 6) {
      setError("Password must contain at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);

    // Save to local admin password
    localStorage.setItem("powerloom_admin_password", newPassword);

    try {
      await supabase.auth.updateUser({
        password: newPassword,
      });
    } catch (err) {
      // Ignore if purely local admin session
    }

    setMessage("Password updated successfully. Your new password is now active.");
    e.target.reset();
    setLoading(false);
  }

  async function downloadFullBackup() {
    setBackupLoading(true);
    setDbError("");
    setDbSuccess("");

    try {
      const [
        shops,
        workers,
        looms,
        warps,
        bobins,
        production,
        deliveries,
        deliveryItems,
        deliveryBobins,
        payments,
        notifications,
      ] = await Promise.all([
        supabase.from("shops").select("*"),
        supabase.from("workers").select("*"),
        supabase.from("looms").select("*"),
        supabase.from("warps").select("*"),
        supabase.from("bobins").select("*"),
        supabase.from("production_entries").select("*"),
        supabase.from("deliveries").select("*"),
        supabase.from("delivery_items").select("*"),
        supabase.from("delivery_bobin_items").select("*"),
        supabase.from("worker_payments").select("*"),
        supabase.from("notifications").select("*"),
      ]);

      const backupObj = {
        exportedAt: new Date().toISOString(),
        system: "Power Loom ERP Management System",
        database: "Supabase PostgreSQL Cloud",
        tables: {
          shops: shops.data || [],
          workers: workers.data || [],
          looms: looms.data || [],
          warps: warps.data || [],
          bobins: bobins.data || [],
          production_entries: production.data || [],
          deliveries: deliveries.data || [],
          delivery_items: deliveryItems.data || [],
          delivery_bobin_items: deliveryBobins.data || [],
          worker_payments: payments.data || [],
          notifications: notifications.data || [],
        },
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], {
        type: "application/json;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `power_loom_full_supabase_backup_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDbSuccess("Full Supabase database backup successfully downloaded.");
    } catch (err) {
      console.error(err);
      setDbError("Failed to export backup: " + (err.message || String(err)));
    } finally {
      setBackupLoading(false);
    }
  }

  async function executePurge() {
    if (!purgeModal) return;
    if (confirmInput.trim().toUpperCase() !== purgeModal.requiredText) {
      alert(`Please type "${purgeModal.requiredText}" to confirm.`);
      return;
    }

    setPurgeLoading(true);
    setDbError("");
    setDbSuccess("");

    try {
      if (purgeModal.type === "production") {
        const { error } = await supabase
          .from("production_entries")
          .delete()
          .neq("id", 0);
        if (error) throw error;
        setDbSuccess(
          "All Production entries were permanently deleted from Supabase database."
        );
      } else if (purgeModal.type === "deliveries") {
        const { error } = await supabase
          .from("deliveries")
          .delete()
          .neq("id", 0);
        if (error) throw error;
        setDbSuccess(
          "All Delivery records and item breakdowns were permanently deleted from Supabase database."
        );
      } else if (purgeModal.type === "payments") {
        const { error } = await supabase
          .from("worker_payments")
          .delete()
          .neq("id", 0);
        if (error) throw error;
        setDbSuccess(
          "All Worker payment and advance records were permanently deleted from Supabase database."
        );
      } else if (purgeModal.type === "all") {
        await supabase.from("worker_payments").delete().neq("id", 0);
        await supabase.from("delivery_bobin_items").delete().neq("id", 0);
        await supabase.from("delivery_items").delete().neq("id", 0);
        await supabase.from("deliveries").delete().neq("id", 0);
        await supabase.from("production_entries").delete().neq("id", 0);
        await supabase.from("notifications").delete().neq("id", 0);
        await supabase.from("bobins").delete().neq("id", 0);
        await supabase.from("warps").delete().neq("id", 0);
        setDbSuccess(
          "All operational data (warps, bobins, production, deliveries, payments) was permanently deleted from Supabase database."
        );
      }

      setPurgeModal(null);
      setConfirmInput("");
    } catch (err) {
      console.error(err);
      setDbError("Database purge failed: " + (err.message || String(err)));
    } finally {
      setPurgeLoading(false);
    }
  }

  async function handleSignOut() {
    const confirmLogout = window.confirm("Are you sure you want to sign out of the system?");
    if (!confirmLogout) return;

    localStorage.removeItem("powerloom_admin_session");
    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.error(signOutError);
    }
    window.location.reload();
  }

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">SYSTEM CONFIGURATION</span>
          <h2>Settings</h2>
        </div>
      </div>

      {/* ACCOUNT DETAILS */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Account Profile</h3>
          </div>
        </div>

        <div className="settings-info-panel">
          <div className="settings-info-icon">👤</div>
          <div>
            <span className="settings-label">USER NAME / ACCOUNT</span>
            <strong>{email || "chandru"}</strong>
            <p className="muted-text-small">
              Role: System Administrator • Direct PostgreSQL access via Supabase Client
            </p>
          </div>
        </div>
      </div>

      {/* CHANGE PASSWORD */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Change Account Password</h3>
          </div>
        </div>

        <form onSubmit={handleChangePassword}>
          <div className="form-grid">
            <div className="form-field">
              <label>
                New Password <span className="required">*</span>
              </label>
              <input
                type="password"
                name="newPassword"
                placeholder="Enter at least 6 characters"
                required
                minLength={6}
              />
            </div>

            <div className="form-field">
              <label>
                Confirm New Password <span className="required">*</span>
              </label>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Re-enter new password"
                required
                minLength={6}
              />
            </div>
          </div>

          {error && <div className="settings-error">{error}</div>}
          {message && <div className="settings-success">{message}</div>}

          <div className="form-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              {loading ? "Updating Password..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* REQUIREMENT 35: APPLICATION ARCHITECTURE & VERSION */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Application Architecture &amp; System Info</h3>
          </div>
        </div>

        <div className="settings-info-grid">
          <div className="settings-info-box">
            <div className="settings-info-icon">⚙</div>
            <div>
              <span className="settings-label">APPLICATION NAME</span>
              <strong>Power Loom Management System</strong>
              <p>Specialized ERP for saree weaving, warp tracking, bobin allocation, and wage accounting.</p>
            </div>
          </div>

          <div className="settings-info-box">
            <div className="settings-info-icon">v</div>
            <div>
              <span className="settings-label">RELEASE VERSION</span>
              <strong>v1.0.0 (Production ERP)</strong>
              <p>Ready for web deployment and cross-platform mobile adaptation (Android / iOS).</p>
            </div>
          </div>

          <div className="settings-info-box">
            <div className="settings-info-icon">⚡</div>
            <div>
              <span className="settings-label">FRONTEND STACK</span>
              <strong>React 19 + Vite + Vanilla CSS</strong>
              <p>Direct Supabase client communication (no intermediate Node/Express server).</p>
            </div>
          </div>

          <div className="settings-info-box">
            <div className="settings-info-icon">🗄</div>
            <div>
              <span className="settings-label">DATABASE &amp; STORAGE</span>
              <strong>Supabase PostgreSQL + Storage</strong>
              <p>Row Level Security, automated warp notifications, and design-images storage.</p>
            </div>
          </div>
        </div>
      </div>

      {/* SUPABASE DATABASE MANAGEMENT & DATA PURGE */}
      <div className="content-card settings-danger-card">
        <div className="content-card-header">
          <div>
            <h3 style={{ color: "#991b1b" }}>Supabase Database Operations &amp; Data Purge</h3>
            <p style={{ color: "#334155" }}>
              Download cloud database backups, or permanently delete operational data directly on Supabase PostgreSQL.
            </p>
          </div>
        </div>

        {dbSuccess && (
          <div className="settings-success" style={{ marginBottom: 16 }}>
            ✓ {dbSuccess}
          </div>
        )}

        {dbError && (
          <div className="settings-error" style={{ marginBottom: 16 }}>
            {dbError}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 20 }}>
          {/* BACKUP */}
          <div style={{ background: "#ffffff", padding: 16, borderRadius: 8, border: "1.5px solid #cbd5e1" }}>
            <h4 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Download Full Cloud Backup</h4>
            <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#475569" }}>
              Save all records (warps, bobins, production, deliveries, payments, shops) to an offline JSON backup.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={downloadFullBackup}
              disabled={backupLoading}
              style={{ width: "100%" }}
            >
              {backupLoading ? "Generating Backup..." : "↓ Download Supabase JSON Backup"}
            </button>
          </div>

          {/* PURGE PRODUCTION */}
          <div style={{ background: "#ffffff", padding: 16, borderRadius: 8, border: "1.5px solid #fecaca" }}>
            <h4 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: "#991b1b" }}>Delete All Production Data</h4>
            <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#475569" }}>
              Permanently delete all saree production entries from table <code>production_entries</code> in Supabase.
            </p>
            <button
              type="button"
              className="delete-row-btn"
              onClick={() => {
                setConfirmInput("");
                setPurgeModal({
                  type: "production",
                  title: "Purge All Production Entries",
                  desc: "This will permanently delete all recorded production entries from Supabase PostgreSQL database.",
                  requiredText: "DELETE",
                });
              }}
              style={{ width: "100%", justifyContent: "center", height: 38 }}
            >
              🗑 Delete All Production
            </button>
          </div>

          {/* PURGE DELIVERIES */}
          <div style={{ background: "#ffffff", padding: 16, borderRadius: 8, border: "1.5px solid #fecaca" }}>
            <h4 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: "#991b1b" }}>Delete All Delivery History</h4>
            <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#475569" }}>
              Permanently delete all shop deliveries and items from table <code>deliveries</code> in Supabase.
            </p>
            <button
              type="button"
              className="delete-row-btn"
              onClick={() => {
                setConfirmInput("");
                setPurgeModal({
                  type: "deliveries",
                  title: "Purge All Delivery Records",
                  desc: "This will permanently delete all deliveries, delivery items, and delivery bobin roll records from Supabase database.",
                  requiredText: "DELETE",
                });
              }}
              style={{ width: "100%", justifyContent: "center", height: 38 }}
            >
              🗑 Delete All Deliveries
            </button>
          </div>

          {/* PURGE PAYMENTS */}
          <div style={{ background: "#ffffff", padding: 16, borderRadius: 8, border: "1.5px solid #fecaca" }}>
            <h4 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 700, color: "#991b1b" }}>Delete All Worker Payments</h4>
            <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#475569" }}>
              Permanently delete all advances and week-end disbursements from table <code>worker_payments</code>.
            </p>
            <button
              type="button"
              className="delete-row-btn"
              onClick={() => {
                setConfirmInput("");
                setPurgeModal({
                  type: "payments",
                  title: "Purge All Worker Payments",
                  desc: "This will permanently delete all worker payment and advance disbursement records from Supabase database.",
                  requiredText: "DELETE",
                });
              }}
              style={{ width: "100%", justifyContent: "center", height: 38 }}
            >
              🗑 Delete All Payments
            </button>
          </div>
        </div>

        {/* FACTORY RESET */}
        <div style={{ background: "#fef2f2", padding: 16, borderRadius: 8, border: "1.5px solid #f87171" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <strong style={{ color: "#991b1b", fontSize: 14 }}>Full Operational Reset (Wipe All Business Activity)</strong>
              <p style={{ margin: "2px 0 0 0", fontSize: 13, color: "#b91c1c" }}>
                Clears all warps, bobins, production entries, deliveries, and payment records from Supabase while preserving shops, workers, and loom master setups.
              </p>
            </div>
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                setConfirmInput("");
                setPurgeModal({
                  type: "all",
                  title: "Full Operational Data Reset",
                  desc: "CRITICAL: This will permanently delete ALL warps, bobins, production entries, deliveries, and payment records from Supabase PostgreSQL database.",
                  requiredText: "RESET",
                });
              }}
            >
              ⚠️ Purge All History &amp; Movements
            </button>
          </div>
        </div>
      </div>

      {/* LOGOUT */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Sign Out</h3>
            <p>Terminate current session and return to the secure sign-in screen.</p>
          </div>
        </div>

        <button
          type="button"
          className="danger-outline-button settings-logout-button"
          onClick={handleSignOut}
        >
          Sign Out of System
        </button>
      </div>

      {/* PURGE CONFIRMATION MODAL */}
      {purgeModal && (
        <div
          className="modal-overlay"
          onClick={() => !purgeLoading && setPurgeModal(null)}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 540 }}
          >
            <div
              className="modal-header"
              style={{
                borderBottom: "1.5px solid #fee2e2",
                background: "#fef2f2",
              }}
            >
              <div>
                <h3 style={{ color: "#991b1b" }}>{purgeModal.title}</h3>
                <p style={{ color: "#b91c1c" }}>Confirm deletion on Supabase Cloud Database</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !purgeLoading && setPurgeModal(null)}
                disabled={purgeLoading}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: 14, color: "#0f172a", marginBottom: 14 }}>
                {purgeModal.desc}
              </p>

              <div
                style={{
                  background: "#f8fafc",
                  padding: "14px 16px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  marginBottom: 16,
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: 6,
                  }}
                >
                  Type <code>{purgeModal.requiredText}</code> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={`Type ${purgeModal.requiredText}`}
                  autoFocus
                  style={{ width: "100%" }}
                />
              </div>

              <p style={{ color: "#dc2626", fontSize: 13, fontWeight: 600, margin: 0 }}>
                ⚠️ This operation executes directly against your Supabase PostgreSQL tables and cannot be undone.
              </p>
            </div>

            <div className="modal-footer" style={{ gap: 12 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setPurgeModal(null)}
                disabled={purgeLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={executePurge}
                disabled={
                  purgeLoading ||
                  confirmInput.trim().toUpperCase() !== purgeModal.requiredText
                }
              >
                {purgeLoading ? "Purging on Supabase..." : "Permanently Delete on Supabase"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;