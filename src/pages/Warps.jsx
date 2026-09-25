import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { isWarpBeamReplaced } from "./beamReplacementUtils";

function Warps() {
  const [warps, setWarps] = useState([]);
  const [looms, setLooms] = useState([]);
  const [shops, setShops] = useState([]);
  const [production, setProduction] = useState([]);

  // Form states
  const [warpId, setWarpId] = useState("");
  const [loomId, setLoomId] = useState("");
  const [shopId, setShopId] = useState("");
  const [udalColour, setUdalColour] = useState("");
  const [borderColour, setBorderColour] = useState("");
  const [designName, setDesignName] = useState("");
  const [expectedSarees, setExpectedSarees] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [designImage, setDesignImage] = useState(null);

  // Tab filter
  const [filterTab, setFilterTab] = useState("active"); // 'all' | 'active' | 'completed' | 'archived'

  // Image preview modal
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    await Promise.all([
      loadWarps(),
      loadLooms(),
      loadShops(),
      loadProduction(),
    ]);

    setLoading(false);
  }

  async function loadWarps() {
    const { data, error } = await supabase
      .from("warps")
      .select(`
        *,
        looms (
          id,
          loom_number
        ),
        shops (
          id,
          shop_name
        )
      `)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      alert("Failed to load warps: " + error.message);
      return;
    }

    setWarps(data || []);
  }

  async function loadLooms() {
    const { data, error } = await supabase
      .from("looms")
      .select(`
        *,
        shops (
          id,
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

  async function loadProduction() {
    const { data, error } = await supabase
      .from("production_entries")
      .select("warp_id, saree_quantity")
      .eq("archived", false);

    if (error) {
      console.error(error);
      return;
    }

    setProduction(data || []);
  }

  function handleLoomChange(value) {
    setLoomId(value);

    const selectedLoom = looms.find(
      (loom) => String(loom.id) === String(value)
    );

    if (selectedLoom?.shop_id) {
      setShopId(String(selectedLoom.shop_id));
    } else {
      setShopId("");
    }
  }

  function getActiveWarpForLoom(selectedLoomId) {
    return warps.find(
      (warp) =>
        String(warp.loom_id) === String(selectedLoomId) &&
        !warp.end_date &&
        !warp.archived
    );
  }

  function getWarpProductionTotal(warpIdParam) {
    return production
      .filter((p) => String(p.warp_id) === String(warpIdParam))
      .reduce((sum, p) => sum + Number(p.saree_quantity || 0), 0);
  }

  async function addWarp(e) {
    e.preventDefault();

    if (!warpId.trim()) {
      alert("Please enter Warp ID (e.g. W-1).");
      return;
    }

    if (!loomId) {
      alert("Please select a loom.");
      return;
    }

    if (!shopId) {
      alert("Please select a shop.");
      return;
    }

    if (!udalColour.trim()) {
      alert("Please enter Udal colour.");
      return;
    }

    if (!borderColour.trim()) {
      alert("Please enter Border colour.");
      return;
    }

    const expectedQty = Number(expectedSarees);
    if (!expectedQty || expectedQty <= 0) {
      alert("Please enter a valid expected saree quantity (> 0).");
      return;
    }

    if (!startDate) {
      alert("Please select the warp start date.");
      return;
    }

    // REQUIREMENT 6 & 9: ONE LOOM CAN HAVE ONLY ONE ACTIVE WARP AT A TIME
    const activeWarp = getActiveWarpForLoom(loomId);
    if (activeWarp) {
      alert(
        `Loom ${getLoomNumber(loomId)} already has active Warp ${activeWarp.warp_id}.\n\n` +
        `One loom can have ONLY ONE active warp at a time.\n` +
        `Complete or archive the current warp before adding a new one.`
      );
      return;
    }

    // Double check DB
    const { data: dbActiveWarp, error: activeError } = await supabase
      .from("warps")
      .select("id, warp_id")
      .eq("loom_id", loomId)
      .eq("archived", false)
      .is("end_date", null)
      .limit(1);

    if (activeError) {
      console.error(activeError);
      alert(`Could not verify active warp:\n${activeError.message}`);
      return;
    }

    if (dbActiveWarp && dbActiveWarp.length > 0) {
      alert(`This loom already has active Warp ${dbActiveWarp[0].warp_id}.`);
      return;
    }

    setSaving(true);

    try {
      let imageUrl = null;

      // REQUIREMENT 33: DESIGN IMAGE STORAGE IN SUPABASE STORAGE
      if (designImage) {
        const fileExtension = designImage.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
        const filePath = `warps/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("design-images")
          .upload(filePath, designImage, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          console.warn("Storage upload failed, trying without image:", uploadError);
        } else {
          const { data: publicUrlData } = supabase.storage
            .from("design-images")
            .getPublicUrl(filePath);

          imageUrl = publicUrlData?.publicUrl || null;
        }
      }

      // CREATE WARP
      const { error } = await supabase.from("warps").insert({
        warp_id: warpId.trim(),
        loom_id: Number(loomId),
        shop_id: Number(shopId),
        udal_colour: udalColour.trim(),
        border_colour: borderColour.trim(),
        design_name: designName.trim() || null,
        design_image_url: imageUrl,
        expected_sarees: expectedQty,
        start_date: startDate,
        end_date: null,
        archived: false,
      });

      if (error) {
        console.error(error);
        if (error.code === "23505") {
          alert("This Warp ID already exists. Please use a unique Warp ID.");
        } else {
          alert(`Failed to add warp:\n${error.message}`);
        }
        return;
      }

      alert("Warp registered successfully.");
      resetForm();
      await loadWarps();
    } catch (error) {
      console.error(error);
      alert(`Failed to add warp:\n${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setWarpId("");
    setLoomId("");
    setShopId("");
    setUdalColour("");
    setBorderColour("");
    setDesignName("");
    setExpectedSarees("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setDesignImage(null);

    const fileInput = document.getElementById("warp-design-image");
    if (fileInput) fileInput.value = "";
  }

  async function archiveWarp(warp) {
    if (warp.archived) return;

    const confirmed = window.confirm(
      `Archive Warp ${warp.warp_id}?\n\n` +
      `The warp and its production history will remain safely preserved in the database.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("warps")
      .update({ archived: true })
      .eq("id", warp.id);

    if (error) {
      console.error(error);
      alert(`Failed to archive warp:\n${error.message}`);
      return;
    }

    await loadWarps();
  }

  async function restoreWarp(warp) {
    if (!warp.archived) return;

    const activeWarp = getActiveWarpForLoom(warp.loom_id);
    if (activeWarp && !warp.end_date) {
      alert(
        `Loom ${getLoomNumber(warp.loom_id)} currently has active Warp ${activeWarp.warp_id}.\n\n` +
        `Only one active warp is permitted per loom.`
      );
      return;
    }

    const confirmed = window.confirm(`Restore Warp ${warp.warp_id}?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("warps")
      .update({ archived: false })
      .eq("id", warp.id);

    if (error) {
      console.error(error);
      alert(`Failed to restore warp:\n${error.message}`);
      return;
    }

    await loadWarps();
  }

  async function deleteWarpPermanently(warp) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete Warp "${warp.warp_id}" from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("warps")
        .delete()
        .eq("id", warp.id);

      if (error) {
        console.error(error);
        if (error.code === "23503" || error.message?.includes("foreign key")) {
          alert(
            `Cannot delete Warp "${warp.warp_id}" because it is linked to existing production or bobin records. Please delete or reassign those records first.`
          );
        } else {
          alert("Failed to delete warp: " + error.message);
        }
        return;
      }

      setWarps((prev) => prev.filter((w) => w.id !== warp.id));
      alert(`Warp "${warp.warp_id}" was deleted permanently from database.`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error: " + err.message);
    }
  }

  function getLoomNumber(id) {
    const loom = looms.find((item) => String(item.id) === String(id));
    return loom?.loom_number || id;
  }

  function getStatus(warp) {
    if (warp.archived) return "Archived";
    if (warp.end_date) return "Completed";
    return "Active";
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Loading warp information...</p>
        </div>
      </div>
    );
  }

  const activeWarps = warps.filter((w) => !w.archived && !w.end_date);
  const completedWarps = warps.filter((w) => !w.archived && w.end_date);
  const archivedWarps = warps.filter((w) => w.archived);

  let displayedWarps = warps;
  if (filterTab === "active") displayedWarps = activeWarps;
  else if (filterTab === "completed") displayedWarps = completedWarps;
  else if (filterTab === "archived") displayedWarps = archivedWarps;

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">OPERATIONS</span>
          <h2>Warps</h2>
        </div>

        <div className="page-heading-badge">
          <span>{activeWarps.length}</span>
          <small>Active Warps</small>
        </div>
      </div>

      {/* ADD WARP */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Add New Warp</h3>
          </div>
        </div>

        <form onSubmit={addWarp}>
          <div className="form-grid">
            {/* WARP ID */}
            <div className="form-field">
              <label>
                Warp ID <span className="required">*</span>
              </label>
              <input
                type="text"
                value={warpId}
                onChange={(e) => setWarpId(e.target.value)}
                placeholder="e.g. W-1"
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
                {looms.map((loom) => {
                  const currentActive = getActiveWarpForLoom(loom.id);
                  return (
                    <option key={loom.id} value={loom.id}>
                      Loom {loom.loom_number} {currentActive ? `(Has Active: ${currentActive.warp_id})` : "(Available)"}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* SHOP */}
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

            {/* UDAL COLOUR */}
            <div className="form-field">
              <label>
                Udal Colour <span className="required">*</span>
              </label>
              <input
                type="text"
                value={udalColour}
                onChange={(e) => setUdalColour(e.target.value)}
                placeholder="e.g. Silver, Gold, Cream"
                required
              />
            </div>

            {/* BORDER COLOUR */}
            <div className="form-field">
              <label>
                Border Colour <span className="required">*</span>
              </label>
              <input
                type="text"
                value={borderColour}
                onChange={(e) => setBorderColour(e.target.value)}
                placeholder="e.g. Blue, Maroon, Red"
                required
              />
            </div>

            {/* DESIGN NAME */}
            <div className="form-field">
              <label>Design Name</label>
              <input
                type="text"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder="e.g. Mayil Peacock, Temple Border"
              />
            </div>

            {/* EXPECTED SAREES */}
            <div className="form-field">
              <label>
                Expected Saree Quantity <span className="required">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={expectedSarees}
                onChange={(e) => setExpectedSarees(e.target.value)}
                placeholder="e.g. 80, 75, 100"
                required
              />
            </div>

            {/* START DATE */}
            <div className="form-field">
              <label>
                Start Date <span className="required">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            {/* DESIGN IMAGE */}
            <div className="form-field">
              <label>Design Photo / Pattern Image</label>
              <input
                id="warp-design-image"
                type="file"
                accept="image/*"
                onChange={(e) => setDesignImage(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? "Registering Warp..." : "Add Warp"}
            </button>
          </div>
        </form>
      </div>

      {/* WARP LIST & HISTORY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Warp Directory & History</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active ({activeWarps.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "completed" ? "active" : ""}`}
              onClick={() => setFilterTab("completed")}
            >
              Completed ({completedWarps.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "archived" ? "active" : ""}`}
              onClick={() => setFilterTab("archived")}
            >
              Archived ({archivedWarps.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All ({warps.length})
            </button>
          </div>
        </div>

        {displayedWarps.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">𝄜</div>
            <h4>No warps found in this view</h4>
            <p>Warps will appear here once registered.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>WARP ID</th>
                  <th>LOOM</th>
                  <th>SHOP</th>
                  <th>COLOURS</th>
                  <th>DESIGN</th>
                  <th>TARGET & PROGRESS</th>
                  <th>TIMELINE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {displayedWarps.map((warp) => {
                  const status = getStatus(warp);
                  const produced = getWarpProductionTotal(warp.id);
                  const expected = Number(warp.expected_sarees || 0);
                  const progress = expected > 0
                    ? Math.min(100, Math.round((produced / expected) * 100))
                    : 0;

                  return (
                    <tr key={warp.id}>
                      <td>
                        <span className="warp-badge">{warp.warp_id}</span>
                      </td>

                      <td>
                        <strong>Loom {warp.looms?.loom_number || warp.loom_id}</strong>
                      </td>

                      <td>
                        <span className="table-primary">{warp.shops?.shop_name || "-"}</span>
                      </td>

                      <td>
                        <div className="warp-colours">
                          <span><strong>Udal:</strong> {warp.udal_colour}</span>
                          <span><strong>Border:</strong> {warp.border_colour}</span>
                        </div>
                      </td>

                      <td>
                        <div className="design-cell">
                          {warp.design_image_url ? (
                            <img
                              src={warp.design_image_url}
                              alt="Design"
                              className="design-thumb-clickable"
                              onClick={() => setPreviewImageUrl(warp.design_image_url)}
                              title="Click to view full image"
                            />
                          ) : (
                            <span className="design-thumb-placeholder">No pic</span>
                          )}
                          <span>{warp.design_name || "Standard"}</span>
                        </div>
                      </td>

                      <td>
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
                                backgroundColor: status === "Completed" ? "#28734a" : progress >= 70 ? "#b58a45" : "#315ea8",
                              }}
                            />
                          </div>
                          <small>
                            {progress}% ({Math.max(expected - produced, 0)} left)
                            {isWarpBeamReplaced(warp.id) ? (
                              <span style={{ color: "#28734a", fontWeight: 600 }}> • Beam Replaced</span>
                            ) : progress >= 70 && status !== "Completed" ? (
                              <span style={{ color: "#b58a45", fontWeight: 600 }}> • 70% Reached</span>
                            ) : null}
                          </small>
                        </div>
                      </td>

                      <td>
                        <div className="date-timeline">
                          <div><small>Started:</small> {warp.start_date || "-"}</div>
                          <div><small>Ended:</small> {warp.end_date || <span className="muted-text">Ongoing</span>}</div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            status === "Completed"
                              ? "status-completed"
                              : status === "Archived"
                              ? "status-archived"
                              : "status-active"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          {!warp.archived ? (
                            <button
                              type="button"
                              className="danger-outline-button"
                              onClick={() => archiveWarp(warp)}
                            >
                              Archive
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => restoreWarp(warp)}
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                className="delete-row-btn"
                                title="Delete permanently from Supabase database"
                                onClick={() => deleteWarpPermanently(warp)}
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

      {/* IMAGE PREVIEW MODAL */}
      {previewImageUrl && (
        <div className="modal-overlay" onClick={() => setPreviewImageUrl(null)}>
          <div className="modal-image-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Design Image Preview</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPreviewImageUrl(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-image-body">
              <img src={previewImageUrl} alt="Full Design" className="full-design-image" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Warps;