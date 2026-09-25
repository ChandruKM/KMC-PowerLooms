import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getBulkAvailableStock } from "./stockUtils";

function Bobins() {
  const [bobins, setBobins] = useState([]);
  const [looms, setLooms] = useState([]);
  const [warps, setWarps] = useState([]);
  const [production, setProduction] = useState([]);
  const [stockMap, setStockMap] = useState({});

  // Form states
  const [bobinId, setBobinId] = useState("");
  const [loomId, setLoomId] = useState("");
  const [warpId, setWarpId] = useState("");
  const [bobinColour, setBobinColour] = useState("");
  const [expectedSarees, setExpectedSarees] = useState("");

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
      loadBobins(),
      loadLooms(),
      loadWarps(),
      loadProduction(),
      loadStock(),
    ]);

    setLoading(false);
  }

  async function loadBobins() {
    const { data, error } = await supabase
      .from("bobins")
      .select(`
        *,
        looms (
          id,
          loom_number,
          shops (
            shop_name
          )
        ),
        warps (
          id,
          warp_id,
          udal_colour,
          border_colour,
          end_date,
          archived
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      alert("Failed to load bobins: " + error.message);
      return;
    }

    setBobins(data || []);
  }

  async function loadLooms() {
    const { data, error } = await supabase
      .from("looms")
      .select(`
        id,
        loom_number,
        shop_id,
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

  async function loadWarps() {
    const { data, error } = await supabase
      .from("warps")
      .select("*")
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

  async function loadProduction() {
    const { data, error } = await supabase
      .from("production_entries")
      .select("bobin_id, saree_quantity")
      .eq("archived", false);

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

  function getActiveWarpsForLoom(selectedLoomId) {
    return warps.filter(
      (warp) =>
        String(warp.loom_id) === String(selectedLoomId) &&
        !warp.archived &&
        !warp.end_date
    );
  }

  function handleLoomChange(value) {
    setLoomId(value);
    setWarpId("");
  }

  function getBobinProduced(bobinIdParam) {
    return production
      .filter((p) => String(p.bobin_id) === String(bobinIdParam))
      .reduce((sum, p) => sum + Number(p.saree_quantity || 0), 0);
  }

  async function addBobin(e) {
    e.preventDefault();

    if (!bobinId.trim()) {
      alert("Please enter Bobin ID (e.g. B-1).");
      return;
    }

    if (!loomId) {
      alert("Please select a loom.");
      return;
    }

    if (!warpId) {
      alert("Please select a warp.");
      return;
    }

    if (!bobinColour.trim()) {
      alert("Please enter bobin yarn colour.");
      return;
    }

    const expectedQty = Number(expectedSarees);
    if (!expectedQty || expectedQty <= 0) {
      alert("Please enter a valid expected saree quantity (> 0).");
      return;
    }

    const selectedWarp = warps.find((w) => String(w.id) === String(warpId));
    if (!selectedWarp) {
      alert("Selected warp not found.");
      return;
    }

    if (selectedWarp.archived || selectedWarp.end_date) {
      alert("You cannot add a bobin to an archived or completed warp.");
      return;
    }

    // Check Bobin ID uniqueness
    const { data: existingBobin, error: existingError } = await supabase
      .from("bobins")
      .select("id")
      .eq("bobin_id", bobinId.trim())
      .limit(1);

    if (existingError) {
      console.error(existingError);
      alert(`Could not verify Bobin ID:\n${existingError.message}`);
      return;
    }

    if (existingBobin && existingBobin.length > 0) {
      alert(`Bobin ID "${bobinId.trim()}" already exists. Each bobin must have a unique ID.`);
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("bobins").insert({
      bobin_id: bobinId.trim(),
      warp_id: Number(warpId),
      loom_id: Number(loomId),
      bobin_colour: bobinColour.trim(),
      expected_sarees: expectedQty,
      archived: false,
    });

    if (error) {
      console.error(error);
      alert(`Failed to add bobin:\n${error.message}`);
      setSaving(false);
      return;
    }

    alert("Bobin added successfully.");
    resetForm();
    await loadBobins();
    await loadStock();
    setSaving(false);
  }

  function resetForm() {
    setBobinId("");
    setLoomId("");
    setWarpId("");
    setBobinColour("");
    setExpectedSarees("");
  }

  async function archiveBobin(bobin) {
    const confirmed = window.confirm(
      `Archive Bobin ${bobin.bobin_id}?\n\nThe bobin will remain in historical delivery records.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("bobins")
      .update({ archived: true })
      .eq("id", bobin.id);

    if (error) {
      console.error(error);
      alert(`Failed to archive bobin:\n${error.message}`);
      return;
    }

    await loadBobins();
  }

  async function restoreBobin(bobin) {
    const confirmed = window.confirm(`Restore Bobin ${bobin.bobin_id} to active status?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("bobins")
      .update({ archived: false })
      .eq("id", bobin.id);

    if (error) {
      console.error(error);
      alert(`Failed to restore bobin:\n${error.message}`);
      return;
    }

    await loadBobins();
  }

  async function deleteBobinPermanently(bobin) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete Bobin "${bobin.bobin_id}" from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("bobins")
        .delete()
        .eq("id", bobin.id);

      if (error) {
        console.error(error);
        if (error.code === "23503" || error.message?.includes("foreign key")) {
          alert(
            `Cannot delete Bobin "${bobin.bobin_id}" because it is linked to production or delivery records. Please delete or reassign those records first.`
          );
        } else {
          alert("Failed to delete bobin: " + error.message);
        }
        return;
      }

      setBobins((prev) => prev.filter((b) => b.id !== bobin.id));
      alert(`Bobin "${bobin.bobin_id}" was deleted permanently from database.`);
      await loadStock();
    } catch (err) {
      console.error(err);
      alert("Unexpected error: " + err.message);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Loading bobin information...</p>
        </div>
      </div>
    );
  }

  const activeBobins = bobins.filter((b) => !b.archived);
  const archivedBobins = bobins.filter((b) => b.archived);
  const displayedBobins = filterTab === "active" ? activeBobins : archivedBobins;
  const loomWarps = getActiveWarpsForLoom(loomId);

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">OPERATIONS</span>
          <h2>Bobins</h2>
        </div>

        <div className="page-heading-badge">
          <span>{activeBobins.length}</span>
          <small>Active Bobins</small>
        </div>
      </div>

      {/* ADD BOBIN */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Add New Bobin</h3>
          </div>
        </div>

        <form onSubmit={addBobin}>
          <div className="form-grid">
            {/* BOBIN ID */}
            <div className="form-field">
              <label>
                Bobin ID <span className="required">*</span>
              </label>
              <input
                type="text"
                value={bobinId}
                onChange={(e) => setBobinId(e.target.value)}
                placeholder="e.g. B-1, B-2"
                required
              />
            </div>

            {/* LOOM */}
            <div className="form-field">
              <label>
                Loom <span className="required">*</span>
              </label>
              <select
                value={loomId}
                onChange={(e) => handleLoomChange(e.target.value)}
                required
              >
                <option value="">Select Loom</option>
                {looms.map((loom) => (
                  <option key={loom.id} value={loom.id}>
                    Loom {loom.loom_number} ({loom.shops?.shop_name || "No shop"})
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
                value={warpId}
                onChange={(e) => setWarpId(e.target.value)}
                disabled={!loomId}
                required
              >
                <option value="">
                  {loomId
                    ? loomWarps.length > 0
                      ? "Select Active Warp"
                      : "No active warp on this loom"
                    : "Select loom first"}
                </option>
                {loomWarps.map((warp) => (
                  <option key={warp.id} value={warp.id}>
                    {warp.warp_id} (Udal: {warp.udal_colour}, Border: {warp.border_colour})
                  </option>
                ))}
              </select>
            </div>

            {/* BOBIN COLOUR */}
            <div className="form-field">
              <label>
                Bobin Yarn Colour <span className="required">*</span>
              </label>
              <input
                type="text"
                value={bobinColour}
                onChange={(e) => setBobinColour(e.target.value)}
                placeholder="e.g. Gold, Maroon, Zari Silver"
                required
              />
            </div>

            {/* EXPECTED SAREES */}
            <div className="form-field">
              <label>
                Expected Saree Capacity <span className="required">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={expectedSarees}
                onChange={(e) => setExpectedSarees(e.target.value)}
                placeholder="e.g. 40, 80, 100"
                required
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Registering Bobin..." : "Add Bobin"}
            </button>
          </div>
        </form>
      </div>

      {/* BOBIN LIST */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Bobin Directory</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active ({activeBobins.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "archived" ? "active" : ""}`}
              onClick={() => setFilterTab("archived")}
            >
              Archived ({archivedBobins.length})
            </button>
          </div>
        </div>

        {displayedBobins.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◎</div>
            <h4>No {filterTab} bobins found</h4>
            <p>
              {filterTab === "active"
                ? "Register your first bobin using the form above."
                : "No bobins have been archived."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>BOBIN ID</th>
                  <th>LOOM</th>
                  <th>WARP</th>
                  <th>COLOUR</th>
                  <th>EXPECTED</th>
                  <th>PRODUCED</th>
                  <th>AVAILABLE STOCK</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {displayedBobins.map((bobin) => {
                  const produced = getBobinProduced(bobin.id);
                  const available = stockMap[String(bobin.id)] ?? "-";
                  const expected = Number(bobin.expected_sarees || 0);

                  return (
                    <tr key={bobin.id}>
                      <td>
                        <span className="bobin-badge large">{bobin.bobin_id}</span>
                      </td>

                      <td>
                        <strong>Loom {bobin.looms?.loom_number || bobin.loom_id}</strong>
                        <div className="muted-text-small">
                          {bobin.looms?.shops?.shop_name || "-"}
                        </div>
                      </td>

                      <td>
                        <span className="warp-badge">{bobin.warps?.warp_id || bobin.warp_id}</span>
                      </td>

                      <td>
                        <span className="color-indicator-text">{bobin.bobin_colour}</span>
                      </td>

                      <td>
                        <strong>{expected}</strong> sarees
                      </td>

                      <td>
                        <span className="quantity-positive">{produced}</span> / {expected}
                      </td>

                      <td>
                        <span className="stock-pill">
                          <strong>{available}</strong> at house
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          {!bobin.archived ? (
                            <button
                              type="button"
                              className="danger-outline-button"
                              onClick={() => archiveBobin(bobin)}
                            >
                              Archive
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => restoreBobin(bobin)}
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                className="delete-row-btn"
                                title="Delete permanently from Supabase database"
                                onClick={() => deleteBobinPermanently(bobin)}
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

export default Bobins;