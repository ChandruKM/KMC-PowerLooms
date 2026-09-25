import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getBulkAvailableStock } from "./stockUtils";

export default function Delivery() {
  const [shops, setShops] = useState([]);
  const [looms, setLooms] = useState([]);
  const [warps, setWarps] = useState([]);
  const [bobins, setBobins] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [stockMap, setStockMap] = useState({});

  // Stage 1 form states
  const [shopId, setShopId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [items, setItems] = useState([]);

  // Filter tabs
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'pre_delivery' | 'completed'

  // Stage 2 Result Modal state
  const [resultModalDelivery, setResultModalDelivery] = useState(null);
  const [resultInputs, setResultInputs] = useState({}); // { [bobinItemId]: { delivered, pending, returned } }

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setPageLoading(true);

    await Promise.all([
      loadShops(),
      loadLooms(),
      loadWarps(),
      loadBobins(),
      loadDeliveries(),
      loadStock(),
    ]);

    setPageLoading(false);
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
        *,
        warps (
          id,
          warp_id
        ),
        looms (
          id,
          loom_number
        )
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

  async function loadDeliveries() {
    const { data, error } = await supabase
      .from("deliveries")
      .select(`
        *,
        shops (
          id,
          shop_name
        ),
        delivery_items (
          id,
          loom_id,
          warp_id,
          total_taken,
          delivered_quantity,
          pending_quantity,
          returned_quantity,
          looms (
            id,
            loom_number,
            shop_wage_per_saree,
            worker_wage_per_saree,
            workers (
              worker_name
            )
          ),
          warps (
            id,
            warp_id,
            udal_colour,
            border_colour
          ),
          delivery_bobin_items (
            id,
            bobin_id,
            saree_quantity,
            delivered_quantity,
            pending_quantity,
            returned_quantity,
            bobins (
              id,
              bobin_id,
              bobin_colour
            )
          )
        )
      `)
      .order("delivery_date", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setDeliveries(data || []);
  }

  async function loadStock() {
    const map = await getBulkAvailableStock();
    setStockMap(map || {});
  }

  function getShopLooms() {
    if (!shopId) return [];
    return looms.filter((loom) => String(loom.shop_id) === String(shopId));
  }

  function getActiveWarpsForLoom(selectedLoomId) {
    return warps.filter(
      (warp) =>
        String(warp.loom_id) === String(selectedLoomId) &&
        !warp.archived &&
        !warp.end_date
    );
  }

  function getBobinsForWarp(selectedLoomId, selectedWarpId) {
    return bobins.filter(
      (bobin) =>
        String(bobin.loom_id) === String(selectedLoomId) &&
        String(bobin.warp_id) === String(selectedWarpId) &&
        !bobin.archived
    );
  }

  function addLoomItem() {
    const availableLooms = getShopLooms();
    if (availableLooms.length === 0) {
      alert("This shop has no active looms assigned.");
      return;
    }

    setItems([
      ...items,
      {
        localId: Date.now(),
        loomId: "",
        warpId: "",
        bobins: [],
      },
    ]);
  }

  function removeLoomItem(localId) {
    setItems(items.filter((item) => item.localId !== localId));
  }

  function changeLoom(localId, newLoomId) {
    const activeWarps = getActiveWarpsForLoom(newLoomId);
    const autoWarpId = activeWarps.length > 0 ? String(activeWarps[0].id) : "";

    setItems(
      items.map((item) =>
        item.localId === localId
          ? {
              ...item,
              loomId: newLoomId,
              warpId: autoWarpId,
              bobins: [],
            }
          : item
      )
    );
  }

  function changeWarp(localId, newWarpId) {
    setItems(
      items.map((item) =>
        item.localId === localId
          ? {
              ...item,
              warpId: newWarpId,
              bobins: [],
            }
          : item
      )
    );
  }

  function addBobinRow(loomLocalId) {
    setItems(
      items.map((item) => {
        if (item.localId !== loomLocalId) return item;

        const availableBobins = getBobinsForWarp(item.loomId, item.warpId);
        if (availableBobins.length === 0) {
          alert("No bobins available for this warp.");
          return item;
        }

        return {
          ...item,
          bobins: [
            ...item.bobins,
            {
              localId: Date.now() + Math.random(),
              bobinId: "",
              quantity: "",
            },
          ],
        };
      })
    );
  }

  function removeBobinRow(loomLocalId, bobinLocalId) {
    setItems(
      items.map((item) =>
        item.localId === loomLocalId
          ? {
              ...item,
              bobins: item.bobins.filter((b) => b.localId !== bobinLocalId),
            }
          : item
      )
    );
  }

  function changeBobinId(loomLocalId, bobinLocalId, newBobinId) {
    setItems(
      items.map((item) =>
        item.localId === loomLocalId
          ? {
              ...item,
              bobins: item.bobins.map((b) =>
                b.localId === bobinLocalId ? { ...b, bobinId: newBobinId } : b
              ),
            }
          : item
      )
    );
  }

  function changeBobinQty(loomLocalId, bobinLocalId, newQty) {
    setItems(
      items.map((item) =>
        item.localId === loomLocalId
          ? {
              ...item,
              bobins: item.bobins.map((b) =>
                b.localId === bobinLocalId ? { ...b, quantity: newQty } : b
              ),
            }
          : item
      )
    );
  }

  function getLoomTakenTotal(item) {
    return item.bobins.reduce(
      (sum, b) => sum + Number(b.quantity || 0),
      0
    );
  }

  // =========================================================
  // STAGE 1: SAVE PRE-DELIVERY
  // =========================================================
  async function savePreDelivery(e) {
    e.preventDefault();

    if (!shopId) {
      alert("Please select a wholesale shop.");
      return;
    }

    if (!deliveryDate) {
      alert("Please select the delivery date.");
      return;
    }

    if (items.length === 0) {
      alert("Please add at least one loom to this delivery.");
      return;
    }

    // Comprehensive validation across all looms and bobins
    for (const item of items) {
      if (!item.loomId) {
        alert("Please select a loom for every item.");
        return;
      }

      if (!item.warpId) {
        alert("Please select an active warp for every loom.");
        return;
      }

      if (item.bobins.length === 0) {
        alert("Every loom must have at least one bobin specified.");
        return;
      }

      const bobinIds = item.bobins.map((b) => b.bobinId);
      if (new Set(bobinIds).size !== bobinIds.length) {
        alert("Duplicate bobins detected under the same loom. Each bobin row must be unique.");
        return;
      }

      for (const bobin of item.bobins) {
        if (!bobin.bobinId) {
          alert("Please select a bobin.");
          return;
        }

        const qty = Number(bobin.quantity);
        if (!qty || qty <= 0) {
          alert("Every bobin must have a valid taken saree quantity (> 0).");
          return;
        }

        // REQUIREMENT 38: STOCK VALIDATION BEFORE DELIVERY
        const available = stockMap[String(bobin.bobinId)] ?? 0;
        if (qty > available) {
          const bobinObj = bobins.find((b) => String(b.id) === String(bobin.bobinId));
          alert(
            `Insufficient Stock for Bobin ${bobinObj?.bobin_id || ""}:\n\n` +
            `Available at house: ${available} sarees\n` +
            `Quantity to take: ${qty} sarees\n\n` +
            `You cannot take more sarees than available.`
          );
          return;
        }
      }
    }

    setLoading(true);

    try {
      // 1. Create Delivery in PRE_DELIVERY status
      const { data: delivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          shop_id: Number(shopId),
          delivery_date: deliveryDate,
          status: "pre_delivery",
        })
        .select()
        .single();

      if (deliveryError) {
        throw deliveryError;
      }

      // 2. Insert Delivery Items
      for (const item of items) {
        const totalTaken = getLoomTakenTotal(item);

        const { data: deliveryItem, error: itemError } = await supabase
          .from("delivery_items")
          .insert({
            delivery_id: delivery.id,
            loom_id: Number(item.loomId),
            warp_id: Number(item.warpId),
            total_taken: totalTaken,
            delivered_quantity: 0,
            pending_quantity: 0,
            returned_quantity: 0,
          })
          .select()
          .single();

        if (itemError) {
          throw itemError;
        }

        // 3. Insert Bobin Breakdown
        for (const bobin of item.bobins) {
          const { error: bobinError } = await supabase
            .from("delivery_bobin_items")
            .insert({
              delivery_item_id: deliveryItem.id,
              bobin_id: Number(bobin.bobinId),
              saree_quantity: Number(bobin.quantity),
              delivered_quantity: 0,
              pending_quantity: 0,
              returned_quantity: 0,
            });

          if (bobinError) {
            throw bobinError;
          }
        }
      }

      alert("Stage 1 Pre-Delivery record created successfully! Take the sarees to the shop.");
      setShopId("");
      setDeliveryDate(new Date().toISOString().split("T")[0]);
      setItems([]);

      await loadDeliveries();
      await loadStock();
    } catch (err) {
      console.error(err);
      alert(`Failed to save pre-delivery:\n${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // =========================================================
  // STAGE 2: OPEN RESULT MODAL
  // =========================================================
  function openResultModal(delivery) {
    if (delivery.status === "completed") {
      alert("This delivery has already been completed.");
      return;
    }

    setResultModalDelivery(delivery);

    // Initialize resultInputs from delivery_bobin_items
    const initialInputs = {};
    for (const item of delivery.delivery_items || []) {
      for (const bItem of item.delivery_bobin_items || []) {
        initialInputs[bItem.id] = {
          delivered: bItem.delivered_quantity > 0 ? String(bItem.delivered_quantity) : String(bItem.saree_quantity), // default prefill
          pending: String(bItem.pending_quantity || 0),
          returned: String(bItem.returned_quantity || 0),
        };
      }
    }

    setResultInputs(initialInputs);
  }

  function handleResultInputChange(bobinItemId, field, value) {
    setResultInputs((prev) => ({
      ...prev,
      [bobinItemId]: {
        ...prev[bobinItemId],
        [field]: value,
      },
    }));
  }

  // =========================================================
  // STAGE 2: SUBMIT DELIVERY RESULT (COMPLETE)
  // =========================================================
  async function submitDeliveryResult() {
    if (!resultModalDelivery) return;

    // Validate every bobin: delivered + pending + returned === saree_quantity (taken)
    let allValid = true;
    const updates = [];

    for (const item of resultModalDelivery.delivery_items || []) {
      let itemDelivered = 0;
      let itemPending = 0;
      let itemReturned = 0;

      for (const bItem of item.delivery_bobin_items || []) {
        const inp = resultInputs[bItem.id] || { delivered: 0, pending: 0, returned: 0 };
        const del = Number(inp.delivered || 0);
        const pen = Number(inp.pending || 0);
        const ret = Number(inp.returned || 0);

        if (del < 0 || pen < 0 || ret < 0) {
          alert(`Bobin ${bItem.bobins?.bobin_id}: Quantities cannot be negative.`);
          return;
        }

        const sum = del + pen + ret;
        if (sum !== Number(bItem.saree_quantity)) {
          alert(
            `Bobin ${bItem.bobins?.bobin_id} Validation Error:\n\n` +
            `Taken = ${bItem.saree_quantity}\n` +
            `Delivered (${del}) + Pending (${pen}) + Returned (${ret}) = ${sum}\n\n` +
            `Total must exactly equal ${bItem.saree_quantity}.`
          );
          return;
        }

        itemDelivered += del;
        itemPending += pen;
        itemReturned += ret;

        updates.push({
          type: "bobin",
          id: bItem.id,
          delivered: del,
          pending: pen,
          returned: ret,
        });
      }

      updates.push({
        type: "item",
        id: item.id,
        delivered: itemDelivered,
        pending: itemPending,
        returned: itemReturned,
      });
    }

    setLoading(true);

    try {
      // 1. Update each bobin item
      for (const u of updates.filter((u) => u.type === "bobin")) {
        const { error } = await supabase
          .from("delivery_bobin_items")
          .update({
            delivered_quantity: u.delivered,
            pending_quantity: u.pending,
            returned_quantity: u.returned,
            updated_at: new Date().toISOString(),
          })
          .eq("id", u.id);

        if (error) throw error;
      }

      // 2. Update each loom delivery item
      for (const u of updates.filter((u) => u.type === "item")) {
        const { error } = await supabase
          .from("delivery_items")
          .update({
            delivered_quantity: u.delivered,
            pending_quantity: u.pending,
            returned_quantity: u.returned,
          })
          .eq("id", u.id);

        if (error) throw error;
      }

      // 3. Mark delivery completed
      const { error: completeErr } = await supabase
        .from("deliveries")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", resultModalDelivery.id);

      if (completeErr) throw completeErr;

      alert(
        "Stage 2 Delivery Results saved successfully!\n\n" +
        "Wages calculated on Delivered sarees. Returned sarees have returned to available stock."
      );

      setResultModalDelivery(null);
      await loadDeliveries();
      await loadStock();
    } catch (err) {
      console.error(err);
      alert(`Failed to complete delivery result:\n${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteDeliveryPermanently(delivery) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete Delivery #${delivery.id} (${delivery.shops?.shop_name || "Shop"}, ${delivery.delivery_date}) from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const itemIds = (delivery.delivery_items || []).map((i) => i.id);
      if (itemIds.length > 0) {
        await supabase
          .from("delivery_bobin_items")
          .delete()
          .in("delivery_item_id", itemIds);

        await supabase
          .from("delivery_items")
          .delete()
          .eq("delivery_id", delivery.id);
      }

      const { error } = await supabase
        .from("deliveries")
        .delete()
        .eq("id", delivery.id);

      if (error) {
        console.error(error);
        alert("Failed to delete delivery: " + error.message);
        return;
      }

      setDeliveries((prev) => prev.filter((d) => d.id !== delivery.id));
      alert("Delivery record permanently deleted.");
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
          <p>Loading delivery dispatch system...</p>
        </div>
      </div>
    );
  }

  const preDeliveries = deliveries.filter((d) => d.status === "pre_delivery");
  const completedDeliveries = deliveries.filter((d) => d.status === "completed");

  let displayedDeliveries = deliveries;
  if (filterTab === "pre_delivery") displayedDeliveries = preDeliveries;
  else if (filterTab === "completed") displayedDeliveries = completedDeliveries;

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">OPERATIONS</span>
          <h2>Shop Deliveries</h2>
        </div>

        <div className="page-heading-badge">
          <span>{preDeliveries.length}</span>
          <small>Pre-Deliveries Active</small>
        </div>
      </div>

      {/* STAGE 1: CREATE PRE-DELIVERY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Stage 1: Create Pre-Delivery Record</h3>
          </div>
        </div>

        <form onSubmit={savePreDelivery}>
          <div className="form-grid">
            {/* SHOP */}
            <div className="form-field">
              <label>
                Destination Wholesale Shop <span className="required">*</span>
              </label>
              <select
                value={shopId}
                onChange={(e) => {
                  setShopId(e.target.value);
                  setItems([]);
                }}
                required
              >
                <option value="">Select Wholesale Shop</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.shop_name}
                  </option>
                ))}
              </select>
            </div>

            {/* DATE */}
            <div className="form-field">
              <label>
                Delivery Date <span className="required">*</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* LOOM ITEMS SECTION */}
          {shopId && (
            <div className="delivery-looms-builder">
              <div className="builder-header">
                <h4>Looms Included in Delivery</h4>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={addLoomItem}
                >
                  + Add Loom to Delivery
                </button>
              </div>

              {items.length === 0 ? (
                <div className="builder-empty">
                  Click "+ Add Loom to Delivery" to select looms and allocate bobin rolls.
                </div>
              ) : (
                items.map((item, idx) => {
                  const loomWarps = getActiveWarpsForLoom(item.loomId);
                  const warpBobins = getBobinsForWarp(item.loomId, item.warpId);
                  const loomTaken = getLoomTakenTotal(item);

                  return (
                    <div key={item.localId} className="builder-item-card">
                      <div className="builder-item-header">
                        <div className="builder-item-title">
                          <span className="badge badge-primary">Loom #{idx + 1}</span>
                          <strong>Total Taken on Loom: {loomTaken} sarees</strong>
                        </div>
                        <button
                          type="button"
                          className="danger-text-button"
                          onClick={() => removeLoomItem(item.localId)}
                        >
                          Remove Loom
                        </button>
                      </div>

                      <div className="form-grid">
                        {/* LOOM SELECT */}
                        <div className="form-field">
                          <label>Loom <span className="required">*</span></label>
                          <select
                            value={item.loomId}
                            onChange={(e) => changeLoom(item.localId, e.target.value)}
                            required
                          >
                            <option value="">Select Loom</option>
                            {getShopLooms().map((l) => (
                              <option key={l.id} value={l.id}>
                                Loom {l.loom_number} ({l.workers?.worker_name || "No worker"})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* WARP SELECT */}
                        <div className="form-field">
                          <label>Active Warp <span className="required">*</span></label>
                          <select
                            value={item.warpId}
                            onChange={(e) => changeWarp(item.localId, e.target.value)}
                            disabled={!item.loomId}
                            required
                          >
                            <option value="">Select Warp</option>
                            {loomWarps.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.warp_id} (Udal: {w.udal_colour}, Border: {w.border_colour})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* BOBIN BREAKDOWN (REQUIREMENT 14) */}
                      {item.warpId && (
                        <div className="builder-bobin-section">
                          <div className="builder-bobin-header">
                            <h5>Bobin Breakdown (Sarees taken from each roll)</h5>
                            <button
                              type="button"
                              className="small-button"
                              onClick={() => addBobinRow(item.localId)}
                            >
                              + Add Bobin Roll
                            </button>
                          </div>

                          {item.bobins.length === 0 ? (
                            <p className="muted-text-small">
                              Click "+ Add Bobin Roll" to assign sarees taken from specific bobins.
                            </p>
                          ) : (
                            <div className="bobin-rows-container">
                              {item.bobins.map((b) => {
                                const avail = stockMap[String(b.bobinId)] ?? 0;
                                return (
                                  <div key={b.localId} className="bobin-input-row">
                                    <div className="bobin-select-col">
                                      <select
                                        value={b.bobinId}
                                        onChange={(e) =>
                                          changeBobinId(
                                            item.localId,
                                            b.localId,
                                            e.target.value
                                          )
                                        }
                                        required
                                      >
                                        <option value="">Select Bobin</option>
                                        {warpBobins.map((wb) => (
                                          <option key={wb.id} value={wb.id}>
                                            {wb.bobin_id} ({wb.bobin_colour}) — In Stock: {stockMap[String(wb.id)] ?? 0}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="bobin-qty-col">
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={b.quantity}
                                        onChange={(e) =>
                                          changeBobinQty(
                                            item.localId,
                                            b.localId,
                                            e.target.value
                                          )
                                        }
                                        placeholder="Taken Qty"
                                        required
                                      />
                                    </div>

                                    {b.bobinId && (
                                      <span className={`stock-check-tag ${Number(b.quantity || 0) > avail ? "error" : "ok"}`}>
                                        Available: {avail}
                                      </span>
                                    )}

                                    <button
                                      type="button"
                                      className="row-delete-btn"
                                      onClick={() => removeBobinRow(item.localId, b.localId)}
                                      title="Remove bobin"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={loading || items.length === 0}
            >
              {loading ? "Recording Pre-Delivery..." : "Save Pre-Delivery Record (Stage 1)"}
            </button>
          </div>
        </form>
      </div>

      {/* STAGE 2 RESULT MODAL (REPLACING WINDOW.PROMPT) */}
      {resultModalDelivery && (
        <div className="modal-overlay">
          <div className="modal-container modal-large">
            <div className="modal-header">
              <div>
                <h3>Stage 2: Update Delivery Results</h3>
                <p>
                  Shop: <strong>{resultModalDelivery.shops?.shop_name}</strong> | Delivery Date: <strong>{resultModalDelivery.delivery_date}</strong>
                </p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setResultModalDelivery(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="delivery-instruction-banner">
                <strong>Inspection Rule:</strong> Enter the sarees accepted as <em>Delivered</em>, kept by shop as <em>Pending / Mistake</em>, or sent back as <em>Returned</em>.
                For every bobin, <strong>Delivered + Pending + Returned must equal Taken</strong>.
              </div>

              {(resultModalDelivery.delivery_items || []).map((item) => (
                <div key={item.id} className="modal-loom-item">
                  <div className="modal-loom-header">
                    <div>
                      <strong>Loom {item.looms?.loom_number}</strong>
                      <span className="muted-text-small">
                        {" "}(Warp: {item.warps?.warp_id} | Shop Wage: ₹{item.looms?.shop_wage_per_saree}/saree | Worker Wage: ₹{item.looms?.worker_wage_per_saree}/saree)
                      </span>
                    </div>
                    <span className="badge badge-neutral">Taken: {item.total_taken} sarees</span>
                  </div>

                  <table className="modal-result-table">
                    <thead>
                      <tr>
                        <th>Bobin</th>
                        <th>Taken</th>
                        <th>Delivered</th>
                        <th>Pending (Mistake)</th>
                        <th>Returned</th>
                        <th>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.delivery_bobin_items || []).map((bItem) => {
                        const inp = resultInputs[bItem.id] || { delivered: 0, pending: 0, returned: 0 };
                        const del = Number(inp.delivered || 0);
                        const pen = Number(inp.pending || 0);
                        const ret = Number(inp.returned || 0);
                        const total = del + pen + ret;
                        const taken = Number(bItem.saree_quantity);
                        const isBalanced = total === taken;

                        return (
                          <tr key={bItem.id}>
                            <td>
                              <strong>{bItem.bobins?.bobin_id}</strong>
                              <small className="muted-text-small"> ({bItem.bobins?.bobin_colour})</small>
                            </td>
                            <td>
                              <span className="quantity-badge">{taken}</span>
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={taken}
                                step="1"
                                className="table-input"
                                value={inp.delivered}
                                onChange={(e) =>
                                  handleResultInputChange(bItem.id, "delivered", e.target.value)
                                }
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={taken}
                                step="1"
                                className="table-input"
                                value={inp.pending}
                                onChange={(e) =>
                                  handleResultInputChange(bItem.id, "pending", e.target.value)
                                }
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={taken}
                                step="1"
                                className="table-input"
                                value={inp.returned}
                                onChange={(e) =>
                                  handleResultInputChange(bItem.id, "returned", e.target.value)
                                }
                                required
                              />
                            </td>
                            <td>
                              <span className={`status-pill ${isBalanced ? "pill-success" : "pill-error"}`}>
                                {isBalanced ? `✓ Balanced (${total}/${taken})` : `Diff: ${taken - total}`}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setResultModalDelivery(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={submitDeliveryResult}
                disabled={loading}
              >
                {loading ? "Completing Delivery..." : "Confirm & Complete Delivery (Stage 2)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERIES LIST & HISTORY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Delivery History & Results</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All Deliveries ({deliveries.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "pre_delivery" ? "active" : ""}`}
              onClick={() => setFilterTab("pre_delivery")}
            >
              Pending Results ({preDeliveries.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "completed" ? "active" : ""}`}
              onClick={() => setFilterTab("completed")}
            >
              Completed ({completedDeliveries.length})
            </button>
          </div>
        </div>

        {displayedDeliveries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🚚</div>
            <h4>No {filterTab.replace("_", " ")} deliveries found</h4>
            <p>Create a pre-delivery record when preparing sarees for shop visit.</p>
          </div>
        ) : (
          <div className="delivery-card-list">
            {displayedDeliveries.map((delivery) => {
              const totalTaken = (delivery.delivery_items || []).reduce(
                (sum, i) => sum + Number(i.total_taken || 0),
                0
              );
              const totalDelivered = (delivery.delivery_items || []).reduce(
                (sum, i) => sum + Number(i.delivered_quantity || 0),
                0
              );
              const totalPending = (delivery.delivery_items || []).reduce(
                (sum, i) => sum + Number(i.pending_quantity || 0),
                0
              );
              const totalReturned = (delivery.delivery_items || []).reduce(
                (sum, i) => sum + Number(i.returned_quantity || 0),
                0
              );

              // Calculate wages loom-wise
              let shopWageTotal = 0;
              let workerWageTotal = 0;

              for (const item of delivery.delivery_items || []) {
                const sRate = Number(item.looms?.shop_wage_per_saree || 0);
                const wRate = Number(item.looms?.worker_wage_per_saree || 0);
                const dQty = Number(item.delivered_quantity || 0);
                shopWageTotal += dQty * sRate;
                workerWageTotal += dQty * wRate;
              }

              return (
                <div key={delivery.id} className="delivery-summary-card">
                  <div className="delivery-card-top">
                    <div>
                      <div className="delivery-shop-name">
                        {delivery.shops?.shop_name || "Unknown Shop"}
                      </div>
                      <div className="delivery-meta-row">
                        <span>Date: <strong>{delivery.delivery_date}</strong></span>
                        <span>•</span>
                        <span>Delivery #{delivery.id}</span>
                      </div>
                    </div>

                    <div className="delivery-card-status">
                      <span className={`status-badge ${delivery.status === "completed" ? "status-completed" : "status-pending"}`}>
                        {delivery.status === "completed" ? "COMPLETED" : "PRE-DELIVERY (OUT)"}
                      </span>
                    </div>
                  </div>

                  {/* LOOM & BOBIN BREAKDOWN DISPLAY */}
                  <div className="delivery-items-table-wrap">
                    <table className="mini-breakdown-table">
                      <thead>
                        <tr>
                          <th>LOOM & WARP</th>
                          <th>BOBINS (BREAKDOWN)</th>
                          <th>TAKEN</th>
                          <th>DELIVERED</th>
                          <th>PENDING</th>
                          <th>RETURNED</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(delivery.delivery_items || []).map((item) => (
                          <tr key={item.id}>
                            <td>
                              <strong>Loom {item.looms?.loom_number || item.loom_id}</strong>
                              <div className="muted-text-small">Warp: {item.warps?.warp_id}</div>
                            </td>
                            <td>
                              <div className="bobin-breakdown-cell">
                                {(item.delivery_bobin_items || []).map((b) => (
                                  <span key={b.id} className="bobin-mini-pill">
                                    {b.bobins?.bobin_id}: {b.saree_quantity} taken
                                    {delivery.status === "completed" && (
                                      <small> (Del:{b.delivered_quantity}, Pen:{b.pending_quantity}, Ret:{b.returned_quantity})</small>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td><strong>{item.total_taken}</strong></td>
                            <td>
                              <span className="quantity-positive">{item.delivered_quantity}</span>
                            </td>
                            <td>
                              <span className="quantity-pending">{item.pending_quantity}</span>
                            </td>
                            <td>
                              <span className="quantity-returned">{item.returned_quantity}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* FOOTER TOTALS & ACTIONS */}
                  <div className="delivery-card-footer">
                    <div className="delivery-totals-row">
                      <span>Total Taken: <strong>{totalTaken}</strong></span>
                      <span>Delivered: <strong className="color-green">{totalDelivered}</strong></span>
                      <span>Pending: <strong className="color-orange">{totalPending}</strong></span>
                      <span>Returned: <strong className="color-red">{totalReturned}</strong></span>
                      {delivery.status === "completed" && (
                        <>
                          <span>•</span>
                          <span>Shop Wage: <strong className="color-blue">₹{shopWageTotal.toFixed(2)}</strong></span>
                          <span>Worker Wage: <strong className="color-blue">₹{workerWageTotal.toFixed(2)}</strong></span>
                        </>
                      )}
                    </div>

                    <div className="delivery-card-action" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {delivery.status === "pre_delivery" ? (
                        <button
                          type="button"
                          className="primary-button small"
                          onClick={() => openResultModal(delivery)}
                        >
                          Update Delivery Result (Stage 2)
                        </button>
                      ) : (
                        <span className="completed-stamp">Finalized</span>
                      )}
                      <button
                        type="button"
                        className="delete-row-btn"
                        title="Delete this delivery permanently from Supabase database"
                        onClick={() => deleteDeliveryPermanently(delivery)}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}