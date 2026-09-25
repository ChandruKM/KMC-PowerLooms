import { supabase } from "../lib/supabase";

/**
 * Calculates available saree stock for a given loom, warp, and optional bobin.
 * Formula (Requirement 16):
 * Available = Produced - Delivered - Pending + Returned
 *
 * Additionally reserves sarees that are currently committed to an active pre_delivery.
 */
export async function getAvailableStock(
  loomId,
  warpId,
  bobinId = null
) {
  if (!loomId || !warpId) {
    return 0;
  }

  try {
    // --------------------------------------------
    // 1. GET PRODUCTION
    // --------------------------------------------
    let productionQuery = supabase
      .from("production_entries")
      .select("saree_quantity")
      .eq("loom_id", loomId)
      .eq("warp_id", warpId)
      .eq("archived", false);

    if (bobinId) {
      productionQuery = productionQuery.eq("bobin_id", bobinId);
    }

    const { data: production, error: productionError } = await productionQuery;

    if (productionError) {
      console.error("Production stock error:", productionError);
      return 0;
    }

    const produced = (production || []).reduce(
      (sum, item) => sum + Number(item.saree_quantity || 0),
      0
    );

    // --------------------------------------------
    // 2. GET DELIVERIES (COMPLETED & PRE-DELIVERY)
    // --------------------------------------------
    const { data: deliveryItems, error: deliveryError } = await supabase
      .from("delivery_items")
      .select(`
        id,
        loom_id,
        warp_id,
        deliveries (
          status
        )
      `)
      .eq("loom_id", loomId)
      .eq("warp_id", warpId);

    if (deliveryError) {
      console.error("Delivery stock error:", deliveryError);
      return produced;
    }

    let takenOutOfHouse = 0;

    for (const item of deliveryItems || []) {
      const deliveryStatus = item.deliveries?.status;

      if (!deliveryStatus || deliveryStatus === "cancelled") {
        continue;
      }

      const { data: bobinItems, error: bobinError } = await supabase
        .from("delivery_bobin_items")
        .select(`
          bobin_id,
          saree_quantity,
          delivered_quantity,
          pending_quantity,
          returned_quantity
        `)
        .eq("delivery_item_id", item.id);

      if (bobinError) {
        console.error("Bobin delivery stock error:", bobinError);
        continue;
      }

      for (const bobin of bobinItems || []) {
        if (bobinId && String(bobin.bobin_id) !== String(bobinId)) {
          continue;
        }

        if (deliveryStatus === "completed") {
          // Delivered and Pending are kept by the shop.
          // Returned sarees come back into available stock.
          const delivered = Number(bobin.delivered_quantity || 0);
          const pending = Number(bobin.pending_quantity || 0);
          const returned = Number(bobin.returned_quantity || 0);
          takenOutOfHouse += delivered + pending - returned;
        } else if (deliveryStatus === "pre_delivery") {
          // In pre-delivery, sarees are physically packed and out for delivery
          takenOutOfHouse += Number(bobin.saree_quantity || 0);
        }
      }
    }

    const available = produced - takenOutOfHouse;
    return Math.max(available, 0);
  } catch (error) {
    console.error("getAvailableStock unexpected error:", error);
    return 0;
  }
}

/**
 * Batch calculation of available stock for all active bobins.
 * Returns an object/map of { [bobinId]: availableStock }
 */
export async function getBulkAvailableStock() {
  try {
    const [productionRes, deliveryItemsRes, bobinItemsRes] = await Promise.all([
      supabase
        .from("production_entries")
        .select("bobin_id, saree_quantity")
        .eq("archived", false),
      supabase
        .from("delivery_items")
        .select(`
          id,
          deliveries (
            status
          )
        `),
      supabase
        .from("delivery_bobin_items")
        .select(`
          delivery_item_id,
          bobin_id,
          saree_quantity,
          delivered_quantity,
          pending_quantity,
          returned_quantity
        `),
    ]);

    if (productionRes.error || deliveryItemsRes.error || bobinItemsRes.error) {
      console.error("Bulk stock fetch error");
      return {};
    }

    const stockMap = {};

    // 1. Add produced
    for (const prod of productionRes.data || []) {
      const bId = String(prod.bobin_id);
      stockMap[bId] = (stockMap[bId] || 0) + Number(prod.saree_quantity || 0);
    }

    // 2. Map delivery status by delivery_item_id
    const itemStatusMap = {};
    for (const item of deliveryItemsRes.data || []) {
      itemStatusMap[item.id] = item.deliveries?.status;
    }

    // 3. Deduct delivered/pending or pre_delivery taken
    for (const bobin of bobinItemsRes.data || []) {
      const status = itemStatusMap[bobin.delivery_item_id];
      if (!status || status === "cancelled") continue;

      const bId = String(bobin.bobin_id);
      if (status === "completed") {
        const delivered = Number(bobin.delivered_quantity || 0);
        const pending = Number(bobin.pending_quantity || 0);
        const returned = Number(bobin.returned_quantity || 0);
        const netDeduction = delivered + pending - returned;
        stockMap[bId] = (stockMap[bId] || 0) - netDeduction;
      } else if (status === "pre_delivery") {
        stockMap[bId] = (stockMap[bId] || 0) - Number(bobin.saree_quantity || 0);
      }
    }

    // Ensure non-negative
    for (const key of Object.keys(stockMap)) {
      stockMap[key] = Math.max(stockMap[key], 0);
    }

    return stockMap;
  } catch (err) {
    console.error("Bulk stock calculation error:", err);
    return {};
  }
}