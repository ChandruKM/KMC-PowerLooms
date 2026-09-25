import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  getBeamReplacements,
  isWarpBeamReplaced,
  recordBeamReplacement,
  deleteBeamReplacement,
  getBobinReplacements,
  isBobinReplaced,
  recordBobinReplacement,
  deleteBobinReplacement,
} from "./beamReplacementUtils";

export default function Dashboard() {
  const [totalLooms, setTotalLooms] = useState(0);
  const [groupedLoomAlerts, setGroupedLoomAlerts] = useState([]);
  const [lastDeliveryDate, setLastDeliveryDate] = useState(null);
  const [latestShop, setLatestShop] = useState(null);
  const [beamReplacements, setBeamReplacements] = useState([]);
  const [bobinReplacements, setBobinReplacements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Raw looms, warps & bobins for modals
  const [allLooms, setAllLooms] = useState([]);
  const [activeWarps, setActiveWarps] = useState([]);
  const [allBobins, setAllBobins] = useState([]);

  // Simple Empty Beam Modal State (Which Loom No & Date alone!)
  const [showBeamModal, setShowBeamModal] = useState(false);
  const [modalLoomId, setModalLoomId] = useState("");
  const [modalDate, setModalDate] = useState(new Date().toISOString().split("T")[0]);
  const [beamSaving, setBeamSaving] = useState(false);

  // Simple Empty Bobin Modal State (Which Loom No & Date alone!)
  const [showBobinModal, setShowBobinModal] = useState(false);
  const [modalBobinLoomId, setModalBobinLoomId] = useState("");
  const [modalBobinId, setModalBobinId] = useState("");
  const [modalBobinDate, setModalBobinDate] = useState(new Date().toISOString().split("T")[0]);
  const [bobinSaving, setBobinSaving] = useState(false);

  useEffect(() => {
    loadDashboard();

    function handlePlacementChange() {
      loadGroupedLoomAlerts();
      setBeamReplacements(getBeamReplacements());
      setBobinReplacements(getBobinReplacements());
    }

    window.addEventListener("powerloom_beam_replaced", handlePlacementChange);
    window.addEventListener("powerloom_bobin_replaced", handlePlacementChange);

    const interval = setInterval(() => {
      loadDashboard();
    }, 60000);

    return () => {
      window.removeEventListener("powerloom_beam_replaced", handlePlacementChange);
      window.removeEventListener("powerloom_bobin_replaced", handlePlacementChange);
      clearInterval(interval);
    };
  }, []);

  async function loadDashboard() {
    setLoading(true);

    await Promise.all([
      loadTotalLooms(),
      loadGroupedLoomAlerts(),
      loadLatestDelivery(),
    ]);

    setBeamReplacements(getBeamReplacements());
    setBobinReplacements(getBobinReplacements());
    setLoading(false);
  }

  // ============================================
  // 1. TOTAL LOOMS (Active only)
  // ============================================
  async function loadTotalLooms() {
    const { count, error } = await supabase
      .from("looms")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("archived", false);

    if (error) {
      console.error("Total looms error:", error);
      return;
    }

    setTotalLooms(count || 0);
  }

  // ============================================
  // 2. GROUPED 70% CAPACITY ALERTS BY LOOM
  // - Warp 70% threshold (cancelled alone if empty beam placed)
  // - Bobin 70% threshold (cancelled alone if empty bobin placed)
  // - Grouped strictly by Loom
  // ============================================
  async function loadGroupedLoomAlerts() {
    try {
      const { data: looms, error: loomsError } = await supabase
        .from("looms")
        .select(`
          id,
          loom_number,
          shop_id,
          shops (
            id,
            shop_name
          )
        `)
        .eq("archived", false)
        .order("loom_number");

      if (loomsError) {
        console.error("Dashboard looms loading error:", loomsError);
        return;
      }

      setAllLooms(looms || []);

      const { data: warps, error: warpsError } = await supabase
        .from("warps")
        .select(`
          id,
          warp_id,
          loom_id,
          shop_id,
          expected_sarees,
          udal_colour,
          border_colour,
          design_name,
          end_date,
          archived,
          looms (
            id,
            loom_number
          ),
          shops (
            id,
            shop_name
          )
        `)
        .eq("archived", false)
        .is("end_date", null);

      if (warpsError) {
        console.error("Dashboard warps loading error:", warpsError);
        return;
      }

      setActiveWarps(warps || []);

      const { data: bobins, error: bobinsError } = await supabase
        .from("bobins")
        .select(`
          id,
          bobin_id,
          loom_id,
          warp_id,
          bobin_colour,
          expected_sarees,
          archived
        `)
        .eq("archived", false);

      if (bobinsError) {
        console.error("Dashboard bobins loading error:", bobinsError);
        return;
      }

      setAllBobins(bobins || []);

      const { data: production, error: prodError } = await supabase
        .from("production_entries")
        .select("warp_id, bobin_id, saree_quantity")
        .eq("archived", false);

      if (prodError) {
        console.error("Dashboard production loading error:", prodError);
        return;
      }

      const warpProdMap = {};
      const bobinProdMap = {};

      for (const entry of production || []) {
        const qty = Number(entry.saree_quantity || 0);
        if (entry.warp_id) {
          warpProdMap[entry.warp_id] = (warpProdMap[entry.warp_id] || 0) + qty;
        }
        if (entry.bobin_id) {
          bobinProdMap[entry.bobin_id] = (bobinProdMap[entry.bobin_id] || 0) + qty;
        }
      }

      const groupedAlerts = [];

      for (const loom of looms || []) {
        const loomId = loom.id;
        const loomNumber = loom.loom_number;
        const shopName = loom.shops?.shop_name || "Unassigned Shop";

        const activeWarp = (warps || []).find((w) => String(w.loom_id) === String(loomId));

        let warpAlert = null;

        if (activeWarp) {
          const warpProduced = warpProdMap[activeWarp.id] || 0;
          const warpCapacity = Number(activeWarp.expected_sarees || 0);
          const warp70Threshold = Math.ceil(warpCapacity * 0.70);
          const isBeamPlaced = isWarpBeamReplaced(activeWarp.id);

          // 70% reached, not finished, and beam NOT already placed
          if (
            warpCapacity > 0 &&
            warpProduced >= warp70Threshold &&
            warpProduced < warpCapacity &&
            !isBeamPlaced
          ) {
            warpAlert = {
              id: activeWarp.id,
              warp_id: activeWarp.warp_id,
              produced: warpProduced,
              capacity: warpCapacity,
              threshold: warp70Threshold,
              remaining: Math.max(warpCapacity - warpProduced, 0),
              percentage: Math.min(Math.round((warpProduced / warpCapacity) * 100), 100),
              udal_colour: activeWarp.udal_colour,
              border_colour: activeWarp.border_colour,
              design_name: activeWarp.design_name,
              shop_name: activeWarp.shops?.shop_name || shopName,
            };
          }
        }

        // Active bobins on this loom
        const loomBobins = (bobins || []).filter(
          (b) => String(b.loom_id) === String(loomId)
        );

        const bobinAlerts = [];

        for (const bobin of loomBobins) {
          const bobinProduced = bobinProdMap[bobin.id] || 0;
          const bobinCapacity = Number(bobin.expected_sarees || 0);
          const bobin70Threshold = Math.ceil(bobinCapacity * 0.70);
          const isBobPlaced = isBobinReplaced(bobin.id);

          // 70% reached, not finished, and empty bobin NOT already placed
          if (
            bobinCapacity > 0 &&
            bobinProduced >= bobin70Threshold &&
            bobinProduced < bobinCapacity &&
            !isBobPlaced
          ) {
            bobinAlerts.push({
              id: bobin.id,
              bobin_id: bobin.bobin_id,
              colour: bobin.bobin_colour,
              produced: bobinProduced,
              capacity: bobinCapacity,
              threshold: bobin70Threshold,
              remaining: Math.max(bobinCapacity - bobinProduced, 0),
              percentage: Math.min(Math.round((bobinProduced / bobinCapacity) * 100), 100),
            });
          }
        }

        // If either Warp or Bobin reached 70%, add to Loom Grouped Alerts
        if (warpAlert || bobinAlerts.length > 0) {
          let actionText = "";
          if (warpAlert && bobinAlerts.length > 0) {
            actionText = "Prepare empty beam and empty bobin.";
          } else if (warpAlert) {
            actionText = "Prepare empty beam.";
          } else {
            actionText = "Prepare empty bobin.";
          }

          groupedAlerts.push({
            loomId,
            loomNumber,
            shopName: warpAlert?.shop_name || shopName,
            warpAlert,
            bobinAlerts,
            actionText,
          });
        }
      }

      setGroupedLoomAlerts(groupedAlerts);
    } catch (err) {
      console.error("Error loading grouped loom alerts:", err);
    }
  }

  // ============================================
  // 3. LAST COMPLETED DELIVERY
  // ============================================
  async function loadLatestDelivery() {
    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        id,
        delivery_date,
        status,
        shops (
          shop_name
        ),
        delivery_items (
          delivered_quantity
        )
      `)
      .eq("status", "completed")
      .order("delivery_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Latest delivery error:", error);
      return;
    }

    if (!data || data.length === 0) {
      setLastDeliveryDate(null);
      setLatestShop(null);
      return;
    }

    const latest = data[0];
    setLastDeliveryDate(latest.delivery_date);
    setLatestShop(latest.shops?.shop_name || null);
  }

  function formatDate(date) {
    if (!date) return "No completed delivery";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Open simple Beam modal: Which Loom No & Date alone!
  function openEmptyBeamModal(targetLoomId = null) {
    if (targetLoomId) {
      setModalLoomId(String(targetLoomId));
    } else {
      setModalLoomId(allLooms[0]?.id ? String(allLooms[0].id) : "");
    }
    setModalDate(new Date().toISOString().split("T")[0]);
    setShowBeamModal(true);
  }

  // Open simple Empty Bobin modal: Which Loom No & Date alone!
  function openBobinModal(targetLoomId = null, targetBobinId = null) {
    const loomIdVal = targetLoomId ? String(targetLoomId) : allLooms[0]?.id ? String(allLooms[0].id) : "";
    setModalBobinLoomId(loomIdVal);

    if (targetBobinId) {
      setModalBobinId(String(targetBobinId));
    } else {
      const loomBobins = allBobins.filter((b) => String(b.loom_id) === loomIdVal);
      setModalBobinId(loomBobins[0]?.id ? String(loomBobins[0].id) : "");
    }

    setModalBobinDate(new Date().toISOString().split("T")[0]);
    setShowBobinModal(true);
  }

  function handleBobinModalLoomChange(loomId) {
    setModalBobinLoomId(loomId);
    const loomBobins = allBobins.filter((b) => String(b.loom_id) === String(loomId));
    setModalBobinId(loomBobins[0]?.id ? String(loomBobins[0].id) : "");
  }

  // When empty beam is placed: cancels that beam notification/alert alone!
  async function handleRecordBeamSubmit(e) {
    e.preventDefault();
    if (!modalLoomId) {
      alert("Please select Loom No.");
      return;
    }

    setBeamSaving(true);
    try {
      const selectedLoom = allLooms.find((l) => String(l.id) === String(modalLoomId));
      const activeWarp = activeWarps.find((w) => String(w.loom_id) === String(modalLoomId));

      await recordBeamReplacement({
        loomId: modalLoomId,
        loomNumber: selectedLoom?.loom_number || "-",
        shopName: activeWarp?.shops?.shop_name || selectedLoom?.shops?.shop_name || "Shop",
        warpId: activeWarp?.id || null,
        warpCode: activeWarp?.warp_id || "Warp",
        replacementDate: modalDate,
      });

      await loadGroupedLoomAlerts();
      setBeamReplacements(getBeamReplacements());
      setShowBeamModal(false);
    } catch (err) {
      console.error("Error recording empty beam:", err);
      alert("Failed to record: " + err.message);
    } finally {
      setBeamSaving(false);
    }
  }

  // When empty bobin is placed: cancels that bobin notification/alert alone!
  async function handleRecordBobinSubmit(e) {
    e.preventDefault();
    if (!modalBobinLoomId) {
      alert("Please select Loom No.");
      return;
    }

    setBobinSaving(true);
    try {
      const selectedLoom = allLooms.find((l) => String(l.id) === String(modalBobinLoomId));
      const loomBobins = allBobins.filter((b) => String(b.loom_id) === String(modalBobinLoomId));
      const selectedBobin = modalBobinId
        ? loomBobins.find((b) => String(b.id) === String(modalBobinId))
        : loomBobins[0];

      await recordBobinReplacement({
        loomId: modalBobinLoomId,
        loomNumber: selectedLoom?.loom_number || "-",
        shopName: selectedLoom?.shops?.shop_name || "Shop",
        bobinId: selectedBobin?.id || null,
        bobinCode: selectedBobin?.bobin_id || "Bobin",
        replacementDate: modalBobinDate,
      });

      await loadGroupedLoomAlerts();
      setBobinReplacements(getBobinReplacements());
      setShowBobinModal(false);
    } catch (err) {
      console.error("Error recording empty bobin:", err);
      alert("Failed to record: " + err.message);
    } finally {
      setBobinSaving(false);
    }
  }

  function handleDeleteBeamReplacement(recordId) {
    if (window.confirm("Undo empty beam for this loom?")) {
      deleteBeamReplacement(recordId);
      loadGroupedLoomAlerts();
      setBeamReplacements(getBeamReplacements());
    }
  }

  function handleDeleteBobinReplacement(recordId) {
    if (window.confirm("Undo empty bobin for this loom?")) {
      deleteBobinReplacement(recordId);
      loadGroupedLoomAlerts();
      setBobinReplacements(getBobinReplacements());
    }
  }

  const totalWarpAlerts = groupedLoomAlerts.filter((a) => a.warpAlert).length;
  const totalBobinAlerts = groupedLoomAlerts.reduce((sum, a) => sum + a.bobinAlerts.length, 0);

  return (
    <div className="page-container dashboard-page">
      {/* =================================================
          DASHBOARD HERO
          Both buttons in ONE place at the top alone with identical colors!
          ================================================= */}
      <div className="dashboard-hero">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-eyebrow">
            TEXTILE MANUFACTURING OPERATIONS
          </div>
          <h1>Power Loom ERP Dashboard</h1>
        </div>

        {/* TOP PLACE ALONE FOR EMPTY BEAM & EMPTY BOBIN (SAME COLOR) */}
        <div className="dashboard-hero-actions">
          <button
            type="button"
            className="hero-action-button"
            onClick={() => openEmptyBeamModal()}
          >
            <span>+</span> Empty Beam
          </button>
          <button
            type="button"
            className="hero-action-button"
            onClick={() => openBobinModal()}
          >
            <span>+</span> Empty Bobin
          </button>
          <div className="dashboard-system-status">
            <span className="dashboard-system-dot"></span>
            <span>Live Telemetry • 70% Alert Engine</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="dashboard-loading">
          Syncing latest production &amp; delivery telemetry...
        </div>
      )}

      {/* =================================================
          3 MAIN STATISTIC CARDS
          ================================================= */}
      <div className="dashboard-stat-grid">
        <div className="dashboard-main-stat dashboard-stat-looms">
          <div className="dashboard-stat-top">
            <div>
              <div className="dashboard-stat-label">TOTAL LOOMS</div>
              <div className="dashboard-stat-mini">Operational capacity</div>
            </div>
            <div className="dashboard-stat-icon">
              <span>L</span>
            </div>
          </div>
          <div className="dashboard-stat-value">{totalLooms}</div>
          <div className="dashboard-stat-footer">Active looms configured</div>
        </div>

        <div className="dashboard-main-stat dashboard-stat-warps">
          <div className="dashboard-stat-top">
            <div>
              <div className="dashboard-stat-label">LOOMS NEEDING ATTENTION</div>
              <div className="dashboard-stat-mini">70% Capacity Triggered</div>
            </div>
            <div className="dashboard-stat-icon">
              <span>70%</span>
            </div>
          </div>
          <div className="dashboard-stat-value">{groupedLoomAlerts.length}</div>
          <div className="dashboard-stat-footer">
            {groupedLoomAlerts.length > 0
              ? `${totalWarpAlerts} Warp Alert${totalWarpAlerts === 1 ? "" : "s"} • ${totalBobinAlerts} Bobin Alert${totalBobinAlerts === 1 ? "" : "s"}`
              : "All looms running smoothly below 70%"}
          </div>
        </div>

        <div className="dashboard-main-stat dashboard-stat-delivery">
          <div className="dashboard-stat-top">
            <div>
              <div className="dashboard-stat-label">LAST DELIVERY DATE</div>
              <div className="dashboard-stat-mini">Completed dispatch</div>
            </div>
            <div className="dashboard-stat-icon">
              <span>D</span>
            </div>
          </div>
          <div className="dashboard-date-value">{formatDate(lastDeliveryDate)}</div>
          <div className="dashboard-stat-footer">
            {latestShop ? `Delivered to: ${latestShop}` : "No completed delivery yet"}
          </div>
        </div>
      </div>

      {/* =================================================
          DASHBOARD ALERTS GROUPED BY LOOM
          With Put Empty Beam & Put Empty Bobin buttons with SAME color
          ================================================= */}
      <section className="dashboard-control-card">
        <div className="dashboard-control-header">
          <div>
            <div className="dashboard-control-eyebrow">PRODUCTION ATTENTION MONITOR</div>
            <h2>Loom Alerts (70% Capacity Reached)</h2>
            <p className="dashboard-control-subtitle">
              Calculates 70% expected capacity for every Warp/Beam and Bobin. Grouped strictly by Loom.
            </p>
          </div>

          <div className="dashboard-alert-counter">
            <strong>{groupedLoomAlerts.length}</strong>
            <span>{groupedLoomAlerts.length === 1 ? "Loom Alert" : "Loom Alerts"}</span>
          </div>
        </div>

        {groupedLoomAlerts.length === 0 ? (
          <div className="dashboard-control-empty">
            <div className="empty-check-icon">✓</div>
            <h4>All active looms operating below 70% capacity</h4>
            <p>
              When an active Warp/Beam or Bobin reaches 70% of its expected capacity, it will automatically alert here under its assigned Loom.
            </p>
          </div>
        ) : (
          <div className="grouped-loom-grid">
            {groupedLoomAlerts.map((loomAlert) => (
              <div key={loomAlert.loomId} className="grouped-loom-card">
                {/* LOOM HEADER */}
                <div className="grouped-loom-header">
                  <div className="grouped-loom-title-box">
                    <span className="grouped-loom-pill">LOOM {loomAlert.loomNumber}</span>
                    <span className="grouped-loom-shop">Shop: <strong>{loomAlert.shopName}</strong></span>
                  </div>
                </div>

                {/* ALERTS BODY */}
                <div className="grouped-loom-body">
                  {/* 1. WARP ALERT (IF REACHED 70%) */}
                  {loomAlert.warpAlert && (
                    <div className="alert-item-box warp-alert-box">
                      <div className="alert-item-header">
                        <div className="alert-item-label">
                          <span className="badge badge-warning">WARP / BEAM</span>
                          <strong className="alert-item-id">Warp {loomAlert.warpAlert.warp_id}</strong>
                          <span className="alert-item-meta">
                            (Udal: {loomAlert.warpAlert.udal_colour || "-"}, Border: {loomAlert.warpAlert.border_colour || "-"})
                          </span>
                        </div>

                        <div className="alert-item-stat">
                          <strong>{loomAlert.warpAlert.produced} / {loomAlert.warpAlert.capacity}</strong>
                          <span className="alert-item-pct">→ {loomAlert.warpAlert.percentage}% reached</span>
                        </div>
                      </div>

                      <div className="progress-bar large">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${loomAlert.warpAlert.percentage}%`,
                            backgroundColor: "#b58a45",
                          }}
                        />
                      </div>

                      <div className="alert-item-details-row">
                        <span className="alert-item-msg">
                          Loom {loomAlert.loomNumber} – {loomAlert.shopName}: Warp {loomAlert.warpAlert.warp_id} reached 70%. Prepare an empty beam.
                        </span>
                        <span className="alert-item-rem">
                          <strong>{loomAlert.warpAlert.remaining}</strong> sarees remaining
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 2. BOBIN ALERT(S) (IF REACHED 70%) */}
                  {loomAlert.bobinAlerts.map((bobin) => (
                    <div key={bobin.id} className="alert-item-box bobin-alert-box">
                      <div className="alert-item-header">
                        <div className="alert-item-label">
                          <span className="badge badge-info">BOBIN</span>
                          <strong className="alert-item-id">Bobin {bobin.bobin_id}</strong>
                          <span className="alert-item-meta">
                            (Yarn: {bobin.colour || "Standard"})
                          </span>
                        </div>

                        <div className="alert-item-stat">
                          <strong>{bobin.produced} / {bobin.capacity}</strong>
                          <span className="alert-item-pct">→ {bobin.percentage}% reached</span>
                        </div>
                      </div>

                      <div className="progress-bar large">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${bobin.percentage}%`,
                            backgroundColor: "#2563eb",
                          }}
                        />
                      </div>

                      <div className="alert-item-details-row">
                        <span className="alert-item-msg">
                          Loom {loomAlert.loomNumber} – {loomAlert.shopName}: Bobin {bobin.bobin_id} reached 70%. Prepare empty bobin.
                        </span>
                        <span className="alert-item-rem">
                          <strong>{bobin.remaining}</strong> sarees remaining
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ACTION BANNER */}
                <div className="grouped-loom-action-banner">
                  <span className="action-tag">ACTION REQUIRED:</span>
                  <strong className="action-text">{loomAlert.actionText}</strong>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* =================================================
          EMPTY BEAM SECTION & EMPTY BOBIN SECTION
          Buttons below the dashboard removed - in one place at the top alone!
          ================================================= */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: 24, marginTop: 24 }}>
        {/* 1. EMPTY BEAM SECTION (No button below, in top place alone) */}
        <section className="dashboard-control-card">
          <div className="dashboard-control-header">
            <div>
              <div className="dashboard-control-eyebrow">EQUIPMENT OPERATIONS</div>
              <h2>Empty Beam Section</h2>
              <p className="dashboard-control-subtitle">
                Log of empty beams put on looms. Putting an empty beam cancels that beam alert alone.
              </p>
            </div>
          </div>

          {beamReplacements.length === 0 ? (
            <div className="dashboard-control-empty" style={{ padding: "32px 20px" }}>
              <h4>No empty beams recorded yet</h4>
              <p>
                When an empty beam is put on a loom, use <strong>"+ Empty Beam"</strong> at the top to record Loom No &amp; Date and cancel that beam alert alone.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Loom No</th>
                    <th>Shop</th>
                    <th>Warp / Beam</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {beamReplacements.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong>{rec.replacement_date}</strong></td>
                      <td><span className="badge badge-loom">Loom {rec.loom_number}</span></td>
                      <td>{rec.shop_name}</td>
                      <td><strong>Warp {rec.warp_code}</strong></td>
                      <td><span className="badge badge-success">Empty Beam</span></td>
                      <td>
                        <button
                          type="button"
                          className="danger-outline-button small"
                          onClick={() => handleDeleteBeamReplacement(rec.id)}
                          title="Undo empty beam"
                        >
                          Undo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 2. EMPTY BOBIN SECTION (No button below, in top place alone) */}
        <section className="dashboard-control-card">
          <div className="dashboard-control-header">
            <div>
              <div className="dashboard-control-eyebrow">EQUIPMENT OPERATIONS</div>
              <h2>Empty Bobin Section</h2>
              <p className="dashboard-control-subtitle">
                Log of empty bobins put on looms. Putting an empty bobin cancels that bobin alert alone.
              </p>
            </div>
          </div>

          {bobinReplacements.length === 0 ? (
            <div className="dashboard-control-empty" style={{ padding: "32px 20px" }}>
              <h4>No empty bobins recorded yet</h4>
              <p>
                When an empty bobin is put on a loom, use <strong>"+ Empty Bobin"</strong> at the top to record Loom No &amp; Date and cancel that bobin alert alone.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Loom No</th>
                    <th>Shop</th>
                    <th>Bobin ID</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bobinReplacements.map((rec) => (
                    <tr key={rec.id}>
                      <td><strong>{rec.replacement_date}</strong></td>
                      <td><span className="badge badge-loom">Loom {rec.loom_number}</span></td>
                      <td>{rec.shop_name}</td>
                      <td><strong>Bobin {rec.bobin_code}</strong></td>
                      <td><span className="badge badge-success">Empty Bobin</span></td>
                      <td>
                        <button
                          type="button"
                          className="danger-outline-button small"
                          onClick={() => handleDeleteBobinReplacement(rec.id)}
                          title="Undo empty bobin"
                        >
                          Undo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* =================================================
          SIMPLE MODAL 1: EMPTY BEAM PLACED (Which Loom No & Date alone!)
          ================================================= */}
      {showBeamModal && (
        <div className="modal-overlay" onClick={() => setShowBeamModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div>
                <span className="page-eyebrow">EMPTY BEAM</span>
                <h3>Empty Beam</h3>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowBeamModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordBeamSubmit} className="modal-form">
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Which Loom No? *</label>
                  <select
                    className="form-input"
                    value={modalLoomId}
                    onChange={(e) => setModalLoomId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Loom No --</option>
                    {allLooms.map((l) => (
                      <option key={l.id} value={l.id}>
                        Loom {l.loom_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowBeamModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={beamSaving || !modalLoomId}
                >
                  {beamSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================
          SIMPLE MODAL 2: EMPTY BOBIN PLACED (Which Loom No & Date alone!)
          ================================================= */}
      {showBobinModal && (
        <div className="modal-overlay" onClick={() => setShowBobinModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div>
                <span className="page-eyebrow">EMPTY BOBIN</span>
                <h3>Empty Bobin</h3>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowBobinModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordBobinSubmit} className="modal-form">
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Which Loom No? *</label>
                  <select
                    className="form-input"
                    value={modalBobinLoomId}
                    onChange={(e) => handleBobinModalLoomChange(e.target.value)}
                    required
                  >
                    <option value="">-- Select Loom No --</option>
                    {allLooms.map((l) => (
                      <option key={l.id} value={l.id}>
                        Loom {l.loom_number}
                      </option>
                    ))}
                  </select>
                </div>

                {allBobins.filter((b) => String(b.loom_id) === String(modalBobinLoomId)).length > 1 && (
                  <div className="form-group">
                    <label className="form-label">Which Bobin?</label>
                    <select
                      className="form-input"
                      value={modalBobinId}
                      onChange={(e) => setModalBobinId(e.target.value)}
                    >
                      {allBobins
                        .filter((b) => String(b.loom_id) === String(modalBobinLoomId))
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            Bobin {b.bobin_id} ({b.bobin_colour})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={modalBobinDate}
                    onChange={(e) => setModalBobinDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowBobinModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={bobinSaving || !modalBobinLoomId}
                >
                  {bobinSaving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}