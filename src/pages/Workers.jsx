import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Workers() {
  const [workers, setWorkers] = useState([]);
  const [looms, setLooms] = useState([]);

  // Form state
  const [workerName, setWorkerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Edit state
  const [editingWorker, setEditingWorker] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Filter tab
  const [filterTab, setFilterTab] = useState("active"); // 'active' | 'archived'

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadWorkers(), loadLooms()]);
    setLoading(false);
  }

  async function loadWorkers() {
    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .order("worker_name");

    if (error) {
      console.error("Error loading workers:", error);
      alert("Error loading workers: " + error.message);
    } else {
      setWorkers(data || []);
    }
  }

  async function loadLooms() {
    const { data, error } = await supabase
      .from("looms")
      .select("id, loom_number, current_worker_id, archived")
      .eq("archived", false);

    if (error) {
      console.error(error);
      return;
    }

    setLooms(data || []);
  }

  async function handleAddWorker(e) {
    e.preventDefault();

    if (!workerName.trim()) {
      alert("Please enter worker name.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("workers").insert([
      {
        worker_name: workerName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        active: true,
        archived: false,
      },
    ]);

    if (error) {
      console.error(error);
      alert("Error adding worker: " + error.message);
    } else {
      alert("Worker added successfully.");
      setWorkerName("");
      setPhone("");
      setAddress("");
      await loadWorkers();
    }

    setSaving(false);
  }

  function startEditWorker(worker) {
    setEditingWorker(worker);
    setEditName(worker.worker_name || "");
    setEditPhone(worker.phone || "");
    setEditAddress(worker.address || "");
  }

  function cancelEditWorker() {
    setEditingWorker(null);
  }

  async function saveEditWorker(e) {
    e.preventDefault();
    if (!editingWorker) return;

    if (!editName.trim()) {
      alert("Worker name cannot be empty.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("workers")
      .update({
        worker_name: editName.trim(),
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
      })
      .eq("id", editingWorker.id);

    if (error) {
      console.error(error);
      alert("Failed to update worker: " + error.message);
      setSaving(false);
      return;
    }

    alert("Worker updated successfully.");
    setEditingWorker(null);
    await loadWorkers();
    setSaving(false);
  }

  async function archiveWorker(id) {
    const confirmed = window.confirm(
      "Are you sure you want to archive this worker?\n\nHistorical records will remain preserved."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("workers")
      .update({ archived: true, active: false })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Error archiving worker: " + error.message);
      return;
    }

    await loadWorkers();
  }

  async function restoreWorker(id) {
    const confirmed = window.confirm("Restore this worker to active status?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("workers")
      .update({ archived: false, active: true })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Error restoring worker: " + error.message);
      return;
    }

    await loadWorkers();
  }

  async function deleteWorkerPermanently(worker) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete Worker "${worker.worker_name}" from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("workers")
        .delete()
        .eq("id", worker.id);

      if (error) {
        console.error(error);
        if (error.code === "23503" || error.message?.includes("foreign key")) {
          alert(
            `Cannot delete Worker "${worker.worker_name}" because they are referenced in production, payment, or loom assignments. Please delete or reassign those records first.`
          );
        } else {
          alert("Failed to delete worker: " + error.message);
        }
        return;
      }

      setWorkers((prev) => prev.filter((w) => w.id !== worker.id));
      alert(`Worker "${worker.worker_name}" was deleted permanently from database.`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error: " + err.message);
    }
  }

  function getOperatingLooms(workerId) {
    return looms.filter(
      (l) => String(l.current_worker_id) === String(workerId)
    );
  }

  if (loading && workers.length === 0) {
    return (
      <div className="page-container">
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Loading worker information...</p>
        </div>
      </div>
    );
  }

  const activeWorkers = workers.filter((w) => !w.archived);
  const archivedWorkers = workers.filter((w) => w.archived);
  const displayedWorkers = filterTab === "active" ? activeWorkers : archivedWorkers;

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">MANAGEMENT</span>
          <h2>Workers</h2>
        </div>

        <div className="page-heading-badge">
          <span>{activeWorkers.length}</span>
          <small>Active Workers</small>
        </div>
      </div>

      {/* ADD WORKER */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Add New Worker</h3>
          </div>
        </div>

        <form onSubmit={handleAddWorker}>
          <div className="form-grid">
            <div className="form-field">
              <label>
                Worker Name <span className="required">*</span>
              </label>
              <input
                type="text"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="e.g. Kumar S."
                required
              />
            </div>

            <div className="form-field">
              <label>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9842100000"
              />
            </div>

            <div className="form-field">
              <label>Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Weaver Colony, Loom Quarter"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving..." : "Add Worker"}
            </button>
          </div>
        </form>
      </div>

      {/* EDIT MODAL */}
      {editingWorker && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Edit Worker: {editingWorker.worker_name}</h3>
                <p>Update weaver contact information.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={cancelEditWorker}
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEditWorker}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Worker Name <span className="required">*</span></label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Address</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditWorker}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WORKER LIST */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Worker Directory</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active Workers ({activeWorkers.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "archived" ? "active" : ""}`}
              onClick={() => setFilterTab("archived")}
            >
              Archived ({archivedWorkers.length})
            </button>
          </div>
        </div>

        {displayedWorkers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">♟</div>
            <h4>No {filterTab} workers found</h4>
            <p>
              {filterTab === "active"
                ? "Add your first worker using the form above."
                : "No workers are archived."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>WORKER NAME</th>
                  <th>PHONE</th>
                  <th>ADDRESS</th>
                  <th>OPERATING LOOMS</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {displayedWorkers.map((worker) => {
                  const operatingLooms = getOperatingLooms(worker.id);
                  return (
                    <tr key={worker.id}>
                      <td>
                        <div className="loom-name">
                          <span className="loom-number">
                            {worker.worker_name?.charAt(0)?.toUpperCase() || "W"}
                          </span>
                          <span className="table-primary">{worker.worker_name}</span>
                        </div>
                      </td>
                      <td>{worker.phone || <span className="muted-text">Not provided</span>}</td>
                      <td>{worker.address || <span className="muted-text">Not provided</span>}</td>
                      <td>
                        {operatingLooms.length > 0 ? (
                          <div className="loom-tag-group">
                            {operatingLooms.map((l) => (
                              <span key={l.id} className="loom-tag">
                                Loom {l.loom_number}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted-text">No active loom</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            !worker.archived && worker.active
                              ? "status-active"
                              : "status-archived"
                          }`}
                        >
                          {!worker.archived && worker.active ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {!worker.archived ? (
                            <>
                              <button
                                type="button"
                                className="edit-button-small"
                                onClick={() => startEditWorker(worker)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger-outline-button"
                                onClick={() => archiveWorker(worker.id)}
                              >
                                Archive
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => restoreWorker(worker.id)}
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                className="delete-row-btn"
                                title="Delete permanently from Supabase database"
                                onClick={() => deleteWorkerPermanently(worker)}
                              >
                                🗑 Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Workers;