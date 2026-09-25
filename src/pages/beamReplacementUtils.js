// ============================================================================
// BEAM & BOBIN REPLACEMENT UTILITY
// Power Loom Management System
// When an empty beam or bobin is placed on a loom:
// - Takes simple input: Which Loom No & Date alone.
// - Cancels that beam or bobin notification/alert alone.
// - Keeps all old beam/warp/bobin history completely intact.
// ============================================================================

import { supabase } from "../lib/supabase";

const BEAM_REPLACEMENTS_KEY = "powerloom_beam_replacements";
const REPLACED_WARPS_KEY = "powerloom_replaced_warps";

const BOBIN_REPLACEMENTS_KEY = "powerloom_bobin_replacements";
const REPLACED_BOBINS_KEY = "powerloom_replaced_bobins";

// ----------------------------------------------------------------------------
// 1. BEAM PLACEMENT UTILITIES
// ----------------------------------------------------------------------------

export function getBeamReplacements() {
  try {
    const raw = localStorage.getItem(BEAM_REPLACEMENTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error("Error reading beam placements:", e);
    return [];
  }
}

export function isWarpBeamReplaced(warpId) {
  if (!warpId) return false;
  try {
    const raw = localStorage.getItem(REPLACED_WARPS_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw);
    return Boolean(map && map[String(warpId)]);
  } catch (e) {
    return false;
  }
}

export async function recordBeamReplacement({
  loomId,
  loomNumber,
  shopName = "",
  warpId = null,
  warpCode = "",
  replacementDate = new Date().toISOString().split("T")[0],
}) {
  const currentList = getBeamReplacements();

  const record = {
    id: `beam-rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    loom_id: loomId || null,
    loom_number: loomNumber || "-",
    shop_name: shopName || "Shop",
    warp_id: warpId || null,
    warp_code: warpCode || "Warp",
    replacement_date: replacementDate,
    status: "Empty Beam",
    created_at: new Date().toISOString(),
  };

  const updatedList = [record, ...currentList];
  localStorage.setItem(BEAM_REPLACEMENTS_KEY, JSON.stringify(updatedList));

  // Cancel that beam alert alone for this warp
  if (warpId) {
    try {
      const raw = localStorage.getItem(REPLACED_WARPS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[String(warpId)] = {
        replaced_at: record.created_at,
        replacement_date: record.replacement_date,
        record_id: record.id,
      };
      localStorage.setItem(REPLACED_WARPS_KEY, JSON.stringify(map));
    } catch (e) {
      console.error("Error marking beam alert cancelled:", e);
    }

    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("warp_id", warpId);
    } catch (err) {
      console.warn("Could not mark supabase notification read:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("powerloom_beam_replaced", {
        detail: record,
      })
    );
  }

  return record;
}

export function deleteBeamReplacement(recordId) {
  const currentList = getBeamReplacements();
  const target = currentList.find((r) => r.id === recordId);
  const updated = currentList.filter((r) => r.id !== recordId);
  localStorage.setItem(BEAM_REPLACEMENTS_KEY, JSON.stringify(updated));

  if (target?.warp_id) {
    const warpIdStr = String(target.warp_id);
    const stillHas = updated.some((r) => String(r.warp_id) === warpIdStr);
    if (!stillHas) {
      try {
        const raw = localStorage.getItem(REPLACED_WARPS_KEY);
        if (raw) {
          const map = JSON.parse(raw);
          delete map[warpIdStr];
          localStorage.setItem(REPLACED_WARPS_KEY, JSON.stringify(map));
        }
      } catch (e) {
        console.error("Error unmarking replaced warp:", e);
      }
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("powerloom_beam_replaced"));
  }
}

// ----------------------------------------------------------------------------
// 2. BOBIN PLACEMENT UTILITIES
// ----------------------------------------------------------------------------

export function getBobinReplacements() {
  try {
    const raw = localStorage.getItem(BOBIN_REPLACEMENTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.error("Error reading bobin replacements:", e);
    return [];
  }
}

export function isBobinReplaced(bobinId) {
  if (!bobinId) return false;
  try {
    const raw = localStorage.getItem(REPLACED_BOBINS_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw);
    return Boolean(map && map[String(bobinId)]);
  } catch (e) {
    return false;
  }
}

export async function recordBobinReplacement({
  loomId,
  loomNumber,
  shopName = "",
  bobinId = null,
  bobinCode = "",
  replacementDate = new Date().toISOString().split("T")[0],
}) {
  const currentList = getBobinReplacements();

  const record = {
    id: `bobin-rep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    loom_id: loomId || null,
    loom_number: loomNumber || "-",
    shop_name: shopName || "Shop",
    bobin_id: bobinId || null,
    bobin_code: bobinCode || "Bobin",
    replacement_date: replacementDate,
    status: "Empty Bobin",
    created_at: new Date().toISOString(),
  };

  const updatedList = [record, ...currentList];
  localStorage.setItem(BOBIN_REPLACEMENTS_KEY, JSON.stringify(updatedList));

  // Cancel that bobin alert alone
  if (bobinId) {
    try {
      const raw = localStorage.getItem(REPLACED_BOBINS_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[String(bobinId)] = {
        replaced_at: record.created_at,
        replacement_date: record.replacement_date,
        record_id: record.id,
      };
      localStorage.setItem(REPLACED_BOBINS_KEY, JSON.stringify(map));
    } catch (e) {
      console.error("Error marking bobin alert cancelled:", e);
    }

    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .ilike("title", `%Bobin ${bobinCode} reached 70%%`);
    } catch (err) {
      console.warn("Could not mark supabase bobin notification read:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("powerloom_bobin_replaced", {
        detail: record,
      })
    );
  }

  return record;
}

export function deleteBobinReplacement(recordId) {
  const currentList = getBobinReplacements();
  const target = currentList.find((r) => r.id === recordId);
  const updated = currentList.filter((r) => r.id !== recordId);
  localStorage.setItem(BOBIN_REPLACEMENTS_KEY, JSON.stringify(updated));

  if (target?.bobin_id) {
    const bobinIdStr = String(target.bobin_id);
    const stillHas = updated.some((r) => String(r.bobin_id) === bobinIdStr);
    if (!stillHas) {
      try {
        const raw = localStorage.getItem(REPLACED_BOBINS_KEY);
        if (raw) {
          const map = JSON.parse(raw);
          delete map[bobinIdStr];
          localStorage.setItem(REPLACED_BOBINS_KEY, JSON.stringify(map));
        }
      } catch (e) {
        console.error("Error unmarking replaced bobin:", e);
      }
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("powerloom_bobin_replaced"));
  }
}
