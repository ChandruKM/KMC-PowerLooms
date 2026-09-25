import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Looms() {
  const [looms, setLooms] = useState([]);
  const [shops, setShops] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [warps, setWarps] = useState([]);
  const [bobins, setBobins] = useState([]);
  const [production, setProduction] = useState([]);

  // Form states for adding new loom
  const [loomNumber, setLoomNumber] = useState("");
  const [shopId, setShopId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [shopWage, setShopWage] = useState("");
  const [workerWage, setWorkerWage] = useState("");

  // Edit Loom state
  const [editingLoom, setEditingLoom] = useState(null);
  const [editShopId, setEditShopId] = useState("");
  const [editWorkerId, setEditWorkerId] = useState("");
  const [editShopWage, setEditShopWage] = useState("");
  const [editWorkerWage, setEditWorkerWage] = useState("");

  // Filter tab
  const [filterTab, setFilterTab] = useState("active"); // 'active' | 'archived'

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    await Promise.all([
      loadLooms(),
      loadShops(),
      loadWorkers(),
      loadWarps(),
      loadBobins(),
      loadProduction(),
    ]);

    setLoading(false);
  }

  async function loadLooms() {
    const { data, error } = await supabase
      .from("looms")
      .select(`
        *,
        shops (
          id,
          shop_name
        ),
        workers (
          id,
          worker_name
        )
      `)
      .order("loom_number");

    if (error) {
      console.error(error);
      alert("Failed to load looms: " + error.message);
      return;
    }

    setLooms(data || []);
  }

  async function loadShops() {
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("archived", false)
      .order("shop_name");

    if (error) {
      console.error(error);
      return;
    }

    setShops(data || []);
  }

  async function loadWorkers() {
    const { data, error } = await supabase
      .from("workers")
      .select("*")
      .eq("active", true)
      .eq("archived", false)
      .order("worker_name");

    if (error) {
      console.error(error);
      return;
    }

    setWorkers(data || []);
  }

  async function loadWarps() {
    const { data, error } = await supabase
      .from("warps")
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setWarps(data || []);
  }

  async function loadBobins() {
    const { data, error } = await supabase
      .from("bobins")
      .select("*")
      .eq("archived", false);

    if (error) {
      console.error(error);
      return;
    }

    setBobins(data || []);
  }

  async function loadProduction() {
    const { data, error } = await supabase
      .from("production_entries")
      .select(`
        loom_id,
        warp_id,
        saree_quantity
      `)
      .eq("archived", false);

    if (error) {
      console.error(error);
      return;
    }

    setProduction(data || []);
  }

  async function addLoom(e) {
    e.preventDefault();

    if (!loomNumber.trim()) {
      alert("Please enter loom number.");
      return;
    }

    if (!shopId) {
      alert("Please select a shop.");
      return;
    }

    if (!workerId) {
      alert("Please select a worker.");
      return;
    }

    const shopWageAmount = Number(shopWage || 0);
    const workerWageAmount = Number(workerWage || 0);

    if (shopWageAmount < 0 || workerWageAmount < 0) {
      alert("Wage rates cannot be negative.");
      return;
    }

    if (shopWageAmount <= workerWageAmount) {
      alert("Shop wage must be greater than worker wage (e.g., Shop: ₹25, Worker: ₹18).");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("looms")
      .insert({
        loom_number: loomNumber.trim(),
        shop_id: Number(shopId),
        current_worker_id: Number(workerId),
        shop_wage_per_saree: shopWageAmount,
        worker_wage_per_saree: workerWageAmount,
        archived: false,
      });

    if (error) {
      console.error(error);

      if (error.code === "23505") {
        alert("This loom number already exists. Please choose a unique loom number.");
      } else {
        alert(`Failed to add loom:\n${error.message}`);
      }

      setSaving(false);
      return;
    }

    alert("Loom added successfully.");

    setLoomNumber("");
    setShopId("");
    setWorkerId("");
    setShopWage("");
    setWorkerWage("");

    await loadLooms();
    setSaving(false);
  }

  function startEditLoom(loom) {
    setEditingLoom(loom);
    setEditShopId(String(loom.shop_id || ""));
    setEditWorkerId(String(loom.current_worker_id || ""));
    setEditShopWage(String(loom.shop_wage_per_saree || ""));
    setEditWorkerWage(String(loom.worker_wage_per_saree || ""));
  }

  function cancelEditLoom() {
    setEditingLoom(null);
  }

  async function saveEditLoom(e) {
    e.preventDefault();
    if (!editingLoom) return;

    if (!editShopId) {
      alert("Please select a shop.");
      return;
    }

    if (!editWorkerId) {
      alert("Please select a worker.");
      return;
    }

    const shopWageAmount = Number(editShopWage || 0);
    const workerWageAmount = Number(editWorkerWage || 0);

    if (shopWageAmount < 0 || workerWageAmount < 0) {
      alert("Wage rates cannot be negative.");
      return;
    }

    if (shopWageAmount <= workerWageAmount) {
      alert("Shop wage must be greater than worker wage.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("looms")
      .update({
        shop_id: Number(editShopId),
        current_worker_id: Number(editWorkerId),
        shop_wage_per_saree: shopWageAmount,
        worker_wage_per_saree: workerWageAmount,
      })
      .eq("id", editingLoom.id);

    if (error) {
      console.error(error);
      alert("Failed to update loom: " + error.message);
      setSaving(false);
      return;
    }

    alert(`Loom ${editingLoom.loom_number} updated successfully.`);
    setEditingLoom(null);
    await loadLooms();
    setSaving(false);
  }

  async function archiveLoom(id) {
    const confirmed = window.confirm(
      "Are you sure you want to archive this loom?\n\nHistorical records will remain preserved."
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("looms")
      .update({
        archived: true,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(`Failed to archive loom:\n${error.message}`);
      return;
    }

    await loadLooms();
  }

  async function restoreLoom(id) {
    const confirmed = window.confirm("Restore this loom to active operations?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("looms")
      .update({ archived: false })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(`Failed to restore loom:\n${error.message}`);
      return;
    }

    await loadLooms();
  }

  async function deleteLoomPermanently(loom) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete Loom ${loom.loom_number} from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("looms")
        .delete()
        .eq("id", loom.id);

      if (error) {
        console.error(error);
        if (error.code === "23503" || error.message?.includes("foreign key")) {
          alert(
            `Cannot delete Loom ${loom.loom_number} because it has associated production entries, warps, or delivery records. Please delete or reassign those records first.`
          );
        } else {
          alert("Failed to delete loom: " + error.message);
        }
        return;
      }

      setLooms((prev) => prev.filter((l) => l.id !== loom.id));
      alert(`Loom ${loom.loom_number} was permanently deleted from database.`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error: " + err.message);
    }
  }

  function getActiveWarp(loomId) {
    return warps.find(
      (warp) =>
        String(warp.loom_id) === String(loomId) &&
        !warp.end_date &&
        !warp.archived
    );
  }

  function getActiveBobins(loomId, warpId) {
    if (!loomId || !warpId) return [];
    return bobins.filter(
      (b) =>
        String(b.loom_id) === String(loomId) &&
        String(b.warp_id) === String(warpId) &&
        !b.archived
    );
  }

  function getWarpProduction(warpId, loomId) {
    return production
      .filter(
        (entry) =>
          String(entry.warp_id) === String(warpId) &&
          String(entry.loom_id) === String(loomId)
      )
      .reduce(
        (total, entry) =>
          total + Number(entry.saree_quantity || 0),
        0
      );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Loading loom information...</p>
        </div>
      </div>
    );
  }

  const activeLooms = looms.filter((l) => !l.archived);
  const archivedLooms = looms.filter((l) => l.archived);
  const displayedLooms = filterTab === "active" ? activeLooms : archivedLooms;

  return (
    <div className="page-container">

      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">MANAGEMENT</span>
          <h2>Looms</h2>
        </div>

        <div className="page-heading-badge">
          <span>{activeLooms.length}</span>
          <small>Active Looms</small>
        </div>
      </div>

      {/* ADD LOOM */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Add New Loom</h3>
          </div>
        </div>

        <form onSubmit={addLoom}>
          <div className="form-grid">

            {/* Loom Number */}
            <div className="form-field">
              <label>
                Loom Number <span className="required">*</span>
              </label>
              <input
                type="text"
                value={loomNumber}
                onChange={(e) => setLoomNumber(e.target.value)}
                placeholder="Example: 1"
                required
              />
            </div>

            {/* Shop */}
            <div className="form-field">
              <label>
                Shop <span className="required">*</span>
              </label>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                required
              >
                <option value="">Select Shop</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.shop_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Worker */}
            <div className="form-field">
              <label>
                Worker <span className="required">*</span>
              </label>
              <select
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                required
              >
                <option value="">Select Worker</option>
                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.worker_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Shop Wage */}
            <div className="form-field">
              <label>
                Shop Wage / Saree <span className="required">*</span>
              </label>
              <div className="currency-input">
                <span>₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shopWage}
                  onChange={(e) => setShopWage(e.target.value)}
                  placeholder="25.00"
                  required
                />
              </div>
            </div>

            {/* Worker Wage */}
            <div className="form-field">
              <label>
                Worker Wage / Saree <span className="required">*</span>
              </label>
              <div className="currency-input">
                <span>₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={workerWage}
                  onChange={(e) => setWorkerWage(e.target.value)}
                  placeholder="18.00"
                  required
                />
              </div>
            </div>

          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? "Saving Loom..." : "Add Loom"}
            </button>
          </div>
        </form>
      </div>

      {/* EDIT MODAL / FORM */}
      {editingLoom && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Edit Loom {editingLoom.loom_number}</h3>
                <p>Update assigned shop, worker, or loom wage structure.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={cancelEditLoom}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEditLoom}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Shop <span className="required">*</span></label>
                    <select
                      value={editShopId}
                      onChange={(e) => setEditShopId(e.target.value)}
                      required
                    >
                      <option value="">Select Shop</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shop_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Worker <span className="required">*</span></label>
                    <select
                      value={editWorkerId}
                      onChange={(e) => setEditWorkerId(e.target.value)}
                      required
                    >
                      <option value="">Select Worker</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.worker_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Shop Wage / Saree <span className="required">*</span></label>
                    <div className="currency-input">
                      <span>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editShopWage}
                        onChange={(e) => setEditShopWage(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Worker Wage / Saree <span className="required">*</span></label>
                    <div className="currency-input">
                      <span>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editWorkerWage}
                        onChange={(e) => setEditWorkerWage(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditLoom}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LOOM LIST */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Loom Inventory & Production State</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active Looms ({activeLooms.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "archived" ? "active" : ""}`}
              onClick={() => setFilterTab("archived")}
            >
              Archived ({archivedLooms.length})
            </button>
          </div>
        </div>

        {displayedLooms.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">▦</div>
            <h4>No {filterTab} looms found</h4>
            <p>
              {filterTab === "active"
                ? "Add your first loom using the form above."
                : "No looms have been archived."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>LOOM</th>
                  <th>SHOP</th>
                  <th>WORKER</th>
                  <th>SHOP WAGE</th>
                  <th>WORKER WAGE</th>
                  <th>ACTIVE WARP</th>
                  <th>DESIGN</th>
                  <th>BOBINS</th>
                  <th>PROGRESS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {displayedLooms.map((loom) => {
                  const activeWarp = getActiveWarp(loom.id);
                  const activeBobins = activeWarp
                    ? getActiveBobins(loom.id, activeWarp.id)
                    : [];

                  const produced = activeWarp
                    ? getWarpProduction(activeWarp.id, loom.id)
                    : 0;

                  const expected = Number(activeWarp?.expected_sarees || 0);

                  const progress = expected > 0
                    ? Math.min(100, Math.round((produced / expected) * 100))
                    : 0;

                  return (
                    <tr key={loom.id}>
                      <td>
                        <div className="loom-name">
                          <span className="loom-number">{loom.loom_number}</span>
                          <span>Loom</span>
                        </div>
                      </td>

                      <td>
                        <span className="table-primary">
                          {loom.shops?.shop_name || "-"}
                        </span>
                      </td>

                      <td>
                        <strong>{loom.workers?.worker_name || "-"}</strong>
                      </td>

                      <td>
                        <span className="money-value">
                          ₹{Number(loom.shop_wage_per_saree || 0).toFixed(2)}
                        </span>
                      </td>

                      <td>
                        <span className="money-value secondary">
                          ₹{Number(loom.worker_wage_per_saree || 0).toFixed(2)}
                        </span>
                      </td>

                      <td>
                        {activeWarp ? (
                          <div className="warp-info-cell">
                            <span className="warp-badge">{activeWarp.warp_id}</span>
                            <div className="warp-colours">
                              <span>Udal: {activeWarp.udal_colour}</span>
                              <span>Border: {activeWarp.border_colour}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="muted-text">No Active Warp</span>
                        )}
                      </td>

                      <td>
                        {activeWarp?.design_name ? (
                          <div className="design-cell">
                            {activeWarp.design_image_url && (
                              <img
                                src={activeWarp.design_image_url}
                                alt="Design"
                                className="design-thumb-small"
                              />
                            )}
                            <span>{activeWarp.design_name}</span>
                          </div>
                        ) : (
                          <span className="muted-text">-</span>
                        )}
                      </td>

                      <td>
                        {activeBobins.length > 0 ? (
                          <div className="bobin-badge-list">
                            {activeBobins.map((b) => (
                              <span key={b.id} className="bobin-badge">
                                {b.bobin_id} ({b.bobin_colour})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted-text">-</span>
                        )}
                      </td>

                      <td>
                        {activeWarp ? (
                          <div className="production-cell">
                            <div className="production-number">
                              <strong>{produced}</strong>
                              <span>/ {expected}</span>
                            </div>

                            <div className="progress-bar">
                              <div
                                className="progress-bar-fill"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor: progress >= 100 ? "#28734a" : progress >= 70 ? "#b58a45" : "#315ea8",
                                }}
                              />
                            </div>

                            <small>{progress}% ({Math.max(expected - produced, 0)} left){progress >= 70 && progress < 100 ? " • 70% Reached" : ""}</small>
                          </div>
                        ) : (
                          <span className="muted-text">-</span>
                        )}
                      </td>

                      <td>
                        <div className="table-actions">
                          {!loom.archived ? (
                            <>
                              <button
                                type="button"
                                className="edit-button-small"
                                onClick={() => startEditLoom(loom)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger-outline-button"
                                onClick={() => archiveLoom(loom.id)}
                              >
                                Archive
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => restoreLoom(loom.id)}
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                className="delete-row-btn"
                                title="Delete permanently from Supabase database"
                                onClick={() => deleteLoomPermanently(loom)}
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

      {/* WAGE INFORMATION */}
      <div className="info-card">
        <div className="info-card-icon">₹</div>
        <div>
          <h3>Loom Wage Policy</h3>
          <p>
            <strong>Shop Wage</strong> is the amount received from the shop per delivered saree.
            <br />
            <strong>Worker Wage</strong> is the amount disbursed to the weaver per delivered saree.
          </p>
          <p className="info-note">
            Wages are maintained loom-wise. Shop wage must always exceed worker wage.
          </p>
        </div>
      </div>

    </div>
  );
}

export default Looms;