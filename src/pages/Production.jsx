import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { checkProductionNotifications } from "./NotificationService";
import { getBulkAvailableStock } from "./stockUtils";

export default function Production() {
  const [production, setProduction] = useState([]);
  const [looms, setLooms] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [warps, setWarps] = useState([]);
  const [bobins, setBobins] = useState([]);
  const [stockMap, setStockMap] = useState({});

  const [form, setForm] = useState({
    loomId: "",
    workerId: "",
    warpId: "",
    bobinId: "",
    productionDate: new Date().toISOString().split("T")[0],
    sareeQuantity: "",
  });

  // Filter tab
  const [filterTab, setFilterTab] = useState("active"); // 'active' | 'archived'

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setPageLoading(true);

    await Promise.all([
      loadProduction(),
      loadLooms(),
      loadWorkers(),
      loadWarps(),
      loadBobins(),
      loadStock(),
    ]);

    setPageLoading(false);
  }

  async function loadLooms() {
    const { data, error } = await supabase
      .from("looms")
      .select(`
        id,
        loom_number,
        current_worker_id,
        archived,
        shops (
          shop_name
        )
      `)
      .eq("archived", false)
      .order("loom_number");

    if (error) {
      console.error(error);
      return;
    }

    setLooms(data || []);
  }

  async function loadWorkers() {
    const { data, error } = await supabase
      .from("workers")
      .select(`
        id,
        worker_name,
        archived,
        active
      `)
      .eq("archived", false)
      .eq("active", true)
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
      .select(`
        id,
        warp_id,
        loom_id,
        udal_colour,
        border_colour,
        design_name,
        expected_sarees,
        start_date,
        end_date,
        archived
      `)
      .eq("archived", false)
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
      .select(`
        id,
        bobin_id,
        warp_id,
        loom_id,
        bobin_colour,
        expected_sarees,
        archived
      `)
      .eq("archived", false)
      .order("created_at", {
        ascending: false,
      });

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
        *,
        looms (
          id,
          loom_number
        ),
        workers (
          id,
          worker_name
        ),
        warps (
          id,
          warp_id,
          udal_colour,
          border_colour
        ),
        bobins (
          id,
          bobin_id,
          bobin_colour
        )
      `)
      .order("production_date", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setProduction(data || []);
  }

  async function loadStock() {
    const map = await getBulkAvailableStock();
    setStockMap(map || {});
  }

  function handleLoomChange(loomId) {
    const selectedLoom = looms.find(
      (loom) => String(loom.id) === String(loomId)
    );

    // Auto-select active warp for this loom if available
    const activeWarp = warps.find(
      (w) => String(w.loom_id) === String(loomId) && !w.archived && !w.end_date
    );

    setForm((previous) => ({
      ...previous,
      loomId,
      workerId: selectedLoom?.current_worker_id
        ? String(selectedLoom.current_worker_id)
        : "",
      warpId: activeWarp ? String(activeWarp.id) : "",
      bobinId: "",
    }));
  }

  function handleWarpChange(warpId) {
    setForm((previous) => ({
      ...previous,
      warpId,
      bobinId: "",
    }));
  }

  function getWarpsForLoom() {
    if (!form.loomId) return [];
    return warps.filter(
      (warp) =>
        String(warp.loom_id) === String(form.loomId) &&
        !warp.archived &&
        !warp.end_date
    );
  }

  function getBobinsForWarp() {
    if (!form.warpId || !form.loomId) return [];
    return bobins.filter(
      (bobin) =>
        String(bobin.warp_id) === String(form.warpId) &&
        String(bobin.loom_id) === String(form.loomId) &&
        !bobin.archived
    );
  }

  function getWarpProduced(warpId) {
    return production
      .filter((entry) => String(entry.warp_id) === String(warpId) && !entry.archived)
      .reduce((sum, entry) => sum + Number(entry.saree_quantity || 0), 0);
  }

  function getBobinProduced(bobinId) {
    return production
      .filter((entry) => String(entry.bobin_id) === String(bobinId) && !entry.archived)
      .reduce((sum, entry) => sum + Number(entry.saree_quantity || 0), 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.loomId) {
      alert("Please select a loom.");
      return;
    }

    if (!form.workerId) {
      alert("Please select a worker.");
      return;
    }

    if (!form.warpId) {
      alert("Please select an active warp.");
      return;
    }

    if (!form.bobinId) {
      alert("Please select a bobin.");
      return;
    }

    const quantity = Number(form.sareeQuantity);
    if (!quantity || quantity <= 0) {
      alert("Please enter a valid saree quantity (> 0).");
      return;
    }

    const selectedWarp = warps.find((w) => String(w.id) === String(form.warpId));
    if (!selectedWarp || selectedWarp.archived || selectedWarp.end_date) {
      alert("The selected warp is not active.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("production_entries").insert({
      loom_id: Number(form.loomId),
      worker_id: Number(form.workerId),
      warp_id: Number(form.warpId),
      bobin_id: Number(form.bobinId),
      production_date: form.productionDate,
      saree_quantity: quantity,
      archived: false,
    });

    if (error) {
      console.error(error);
      alert(`Failed to save production entry:\n${error.message}`);
      setLoading(false);
      return;
    }

    // REQUIREMENT 11 & 12: IMMEDIATELY CHECK NOTIFICATIONS & COMPLETIONS IN REAL-TIME
    try {
      await checkProductionNotifications();
    } catch (notifErr) {
      console.warn("Real-time notification check error:", notifErr);
    }

    alert("Production entry recorded successfully. Sarees added to house inventory.");

    setForm({
      loomId: "",
      workerId: "",
      warpId: "",
      bobinId: "",
      productionDate: new Date().toISOString().split("T")[0],
      sareeQuantity: "",
    });

    await loadProduction();
    await loadWarps();
    await loadStock();
    setLoading(false);
  }

  async function archiveProduction(entry) {
    const confirmed = window.confirm(
      `Archive this production entry of ${entry.saree_quantity} sarees on ${entry.production_date}?\n\n` +
      `Historical records will be preserved.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("production_entries")
      .update({ archived: true })
      .eq("id", entry.id);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await loadProduction();
    await loadStock();
  }

  async function restoreProduction(entry) {
    const confirmed = window.confirm("Restore this production entry to active inventory?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("production_entries")
      .update({ archived: false })
      .eq("id", entry.id);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    await loadProduction();
    await loadStock();
  }

  async function deleteProductionPermanently(entry) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete this archived production record (${entry.saree_quantity} sarees on ${entry.production_date}) from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("production_entries")
        .delete()
        .eq("id", entry.id);

      if (error) {
        console.error(error);
        alert("Failed to delete production entry: " + error.message);
        return;
      }

      setProduction((prev) => prev.filter((p) => p.id !== entry.id));
      alert("Production entry permanently deleted from database.");
      await loadStock();
    } catch (err) {
      console.error(err);
      alert("Unexpected error: " + err.message);
    }
  }

  if (pageLoading) {
    return (
      <div className="page-container">
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Loading production entries...</p>
        </div>
      </div>
    );
  }

  const activeEntries = production.filter((p) => !p.archived);
  const archivedEntries = production.filter((p) => p.archived);
  const displayedEntries = filterTab === "active" ? activeEntries : archivedEntries;

  const currentWarp = warps.find((w) => String(w.id) === String(form.warpId));
  const warpProduced = form.warpId ? getWarpProduced(form.warpId) : 0;
  const warpExpected = Number(currentWarp?.expected_sarees || 0);

  const currentBobin = bobins.find((b) => String(b.id) === String(form.bobinId));
  const bobinProduced = form.bobinId ? getBobinProduced(form.bobinId) : 0;
  const bobinExpected = Number(currentBobin?.expected_sarees || 0);

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">OPERATIONS</span>
          <h2>Daily Production History</h2>
        </div>

        <div className="page-heading-badge">
          <span>{activeEntries.reduce((s, e) => s + Number(e.saree_quantity || 0), 0)}</span>
          <small>Total Sarees Weaved</small>
        </div>
      </div>

      {/* RECORD ENTRY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Record Daily Production</h3>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* LOOM */}
            <div className="form-field">
              <label>
                Loom <span className="required">*</span>
              </label>
              <select
                value={form.loomId}
                onChange={(e) => handleLoomChange(e.target.value)}
                required
              >
                <option value="">Select Loom</option>
                {looms.map((loom) => (
                  <option key={loom.id} value={loom.id}>
                    Loom {loom.loom_number} ({loom.shops?.shop_name || "No Shop"})
                  </option>
                ))}
              </select>
            </div>

            {/* WORKER */}
            <div className="form-field">
              <label>
                Worker / Weaver <span className="required">*</span>
              </label>
              <select
                value={form.workerId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, workerId: e.target.value }))
                }
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

            {/* WARP */}
            <div className="form-field">
              <label>
                Active Warp <span className="required">*</span>
              </label>
              <select
                value={form.warpId}
                onChange={(e) => handleWarpChange(e.target.value)}
                disabled={!form.loomId}
                required
              >
                <option value="">
                  {form.loomId
                    ? getWarpsForLoom().length > 0
                      ? "Select Active Warp"
                      : "No active warp on this loom"
                    : "Select loom first"}
                </option>
                {getWarpsForLoom().map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.warp_id} (Udal: {w.udal_colour}, Border: {w.border_colour})
                  </option>
                ))}
              </select>
            </div>

            {/* BOBIN */}
            <div className="form-field">
              <label>
                Bobin <span className="required">*</span>
              </label>
              <select
                value={form.bobinId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, bobinId: e.target.value }))
                }
                disabled={!form.warpId}
                required
              >
                <option value="">
                  {form.warpId
                    ? getBobinsForWarp().length > 0
                      ? "Select Bobin"
                      : "No bobins for this warp"
                    : "Select warp first"}
                </option>
                {getBobinsForWarp().map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bobin_id} ({b.bobin_colour} - Capacity: {b.expected_sarees})
                  </option>
                ))}
              </select>
            </div>

            {/* DATE */}
            <div className="form-field">
              <label>
                Production Date <span className="required">*</span>
              </label>
              <input
                type="date"
                value={form.productionDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    productionDate: e.target.value,
                  }))
                }
                required
              />
            </div>

            {/* QUANTITY */}
            <div className="form-field">
              <label>
                Sarees Weaved <span className="required">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.sareeQuantity}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    sareeQuantity: e.target.value,
                  }))
                }
                placeholder="e.g. 5, 10, 15"
                required
              />
            </div>
          </div>

          {/* STATUS CONTEXT PANEL */}
          {form.warpId && (
            <div className="production-preview-banner">
              <div>
                <strong>Warp Status ({currentWarp?.warp_id}):</strong> Produced {warpProduced} of {warpExpected} sarees
                {warpExpected > 0 && warpProduced >= Math.ceil(warpExpected * 0.70) && warpProduced < warpExpected && (
                  <span className="pill-badge pill-alert">70% Capacity Alert (Prepare Empty Beam)</span>
                )}
                {warpProduced >= warpExpected && (
                  <span className="pill-badge pill-success">Target Completed</span>
                )}
              </div>
              {form.bobinId && (
                <div>
                  <strong>Bobin ({currentBobin?.bobin_id}):</strong> Produced {bobinProduced} of {bobinExpected} sarees
                  {bobinExpected > 0 && bobinProduced >= Math.ceil(bobinExpected * 0.70) && bobinProduced < bobinExpected && (
                    <span className="pill-badge pill-alert" style={{ marginLeft: 8 }}>70% Bobin Alert (Prepare Bobin)</span>
                  )}
                  {" "}| Available Stock: {stockMap[String(form.bobinId)] ?? 0} at house
                </div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Recording..." : "Save Production Entry"}
            </button>
          </div>
        </form>
      </div>

      {/* PRODUCTION LOG */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Daily Production Log</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active Log ({activeEntries.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "archived" ? "active" : ""}`}
              onClick={() => setFilterTab("archived")}
            >
              Archived ({archivedEntries.length})
            </button>
          </div>
        </div>

        {displayedEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">▤</div>
            <h4>No {filterTab} production entries</h4>
            <p>Entries will appear here as weavers log daily saree production.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>LOOM</th>
                  <th>WORKER</th>
                  <th>WARP</th>
                  <th>BOBIN</th>
                  <th>QUANTITY</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {displayedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.production_date}</strong>
                    </td>

                    <td>
                      Loom {entry.looms?.loom_number || entry.loom_id}
                    </td>

                    <td>
                      <span className="table-primary">
                        {entry.workers?.worker_name || "-"}
                      </span>
                    </td>

                    <td>
                      <span className="warp-badge">
                        {entry.warps?.warp_id || entry.warp_id}
                      </span>
                    </td>

                    <td>
                      <span className="bobin-badge">
                        {entry.bobins?.bobin_id || entry.bobin_id} ({entry.bobins?.bobin_colour || "-"})
                      </span>
                    </td>

                    <td>
                      <span className="quantity-badge-large">
                        +{entry.saree_quantity} sarees
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        {!entry.archived ? (
                          <button
                            type="button"
                            className="danger-outline-button"
                            onClick={() => archiveProduction(entry)}
                          >
                            Archive
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => restoreProduction(entry)}
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              className="delete-row-btn"
                              title="Delete permanently from Supabase database"
                              onClick={() => deleteProductionPermanently(entry)}
                            >
                              🗑 Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}