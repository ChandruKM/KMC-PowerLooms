import { supabase } from "../lib/supabase";
import { isWarpBeamReplaced, isBobinReplaced } from "./beamReplacementUtils";

export async function checkProductionNotifications() {
  try {
    // ============================================
    // 1. GET ACTIVE WARPS
    // ============================================
    const { data: warps, error: warpError } = await supabase
      .from("warps")
      .select(`
        id,
        warp_id,
        loom_id,
        expected_sarees,
        end_date,
        archived,
        looms (
          id,
          loom_number,
          shop_id,
          shops (
            id,
            shop_name
          )
        ),
        shops (
          id,
          shop_name
        )
      `)
      .eq("archived", false);

    if (warpError) {
      console.error("Warp notification query error:", warpError);
      return;
    }

    // ============================================
    // 2. CHECK WARP 70% CAPACITY ALERTS & COMPLETIONS
    // ============================================
    for (const warp of warps || []) {
      // If warp is completed with an end_date, skip alert checks
      if (warp.end_date) {
        continue;
      }

      const expected = Number(warp.expected_sarees || 0);
      if (expected <= 0) {
        continue;
      }

      // Get active production for this warp
      const { data: production, error: prodError } = await supabase
        .from("production_entries")
        .select("saree_quantity, production_date")
        .eq("warp_id", warp.id)
        .eq("archived", false)
        .order("production_date", { ascending: false });

      if (prodError) {
        console.error("Production query error for warp notifications:", prodError);
        continue;
      }

      const produced = (production || []).reduce(
        (sum, item) => sum + Number(item.saree_quantity || 0),
        0
      );

      const loomNumber = warp.looms?.loom_number || "-";
      const shopName = warp.shops?.shop_name || warp.looms?.shops?.shop_name || "the shop";
      const remaining = Math.max(expected - produced, 0);

      // ==========================================
      // 70% WARP/BEAM CAPACITY ALERT
      // Dynamic: 70% of warp's expected capacity
      // e.g. 80 -> 56, 100 -> 70, 120 -> 84
      // Suppressed if beam was already marked replaced
      // ==========================================
      const warp70Threshold = Math.ceil(expected * 0.70);
      const isBeamReplaced = isWarpBeamReplaced(warp.id);

      if (produced >= warp70Threshold && produced < expected && !isBeamReplaced) {
        // Check if 70% notification already exists for this warp
        const { data: existingAlert } = await supabase
          .from("notifications")
          .select("id, title")
          .eq("warp_id", warp.id)
          .ilike("title", "%reached 70%%")
          .limit(1);

        if (!existingAlert || existingAlert.length === 0) {
          const title = `Loom ${loomNumber} – ${shopName}: Warp ${warp.warp_id} reached 70%`;
          const message = `Loom ${loomNumber} – ${shopName}: Warp ${warp.warp_id} reached 70% (${produced}/${expected} sarees, ${remaining} remaining). Prepare an empty beam.`;

          await createNotification({
            notification_type: "info",
            loom_id: warp.loom_id,
            warp_id: warp.id,
            title,
            message,
            is_read: false,
          });

          showBrowserNotification(title, message);
        }
      }

      // ==========================================
      // WARP COMPLETION ALERT
      // When production >= expected_sarees:
      // - Set end date based on actual production completion date
      // - Mark warp completed
      // - Preserve history
      // ==========================================
      if (produced >= expected) {
        const latestProdDate = production?.[0]?.production_date || new Date().toISOString().split("T")[0];

        // Set warp end_date in database
        const { error: updateError } = await supabase
          .from("warps")
          .update({
            end_date: latestProdDate,
          })
          .eq("id", warp.id)
          .is("end_date", null);

        if (updateError) {
          console.error("Warp completion update error:", updateError);
          continue;
        }

        // Check if completion notification already exists
        const { data: existingCompleted } = await supabase
          .from("notifications")
          .select("id")
          .eq("notification_type", "warp_completed")
          .eq("warp_id", warp.id)
          .limit(1);

        if (!existingCompleted || existingCompleted.length === 0) {
          const title = `Warp ${warp.warp_id} completed`;
          const message = `Warp ${warp.warp_id} on Loom ${loomNumber} reached its expected production of ${expected} sarees.`;

          await createNotification({
            notification_type: "warp_completed",
            loom_id: warp.loom_id,
            warp_id: warp.id,
            title,
            message,
            is_read: false,
          });

          showBrowserNotification(title, message);
        }
      }
    }

    // ============================================
    // 3. CHECK BOBIN 70% CAPACITY ALERTS
    // Each Bobin has its own capacity (expected_sarees)
    // When production >= 70%, trigger alert
    // ============================================
    const { data: bobins, error: bobinError } = await supabase
      .from("bobins")
      .select(`
        id,
        bobin_id,
        loom_id,
        warp_id,
        bobin_colour,
        expected_sarees,
        archived,
        looms (
          id,
          loom_number,
          shop_id,
          shops (
            id,
            shop_name
          )
        ),
        warps (
          id,
          warp_id,
          shops (
            id,
            shop_name
          )
        )
      `)
      .eq("archived", false);

    if (!bobinError && bobins && bobins.length > 0) {
      for (const bobin of bobins) {
        const bobinExpected = Number(bobin.expected_sarees || 0);
        if (bobinExpected <= 0) continue;

        const { data: bProd } = await supabase
          .from("production_entries")
          .select("saree_quantity")
          .eq("bobin_id", bobin.id)
          .eq("archived", false);

        const bobinProduced = (bProd || []).reduce(
          (sum, item) => sum + Number(item.saree_quantity || 0),
          0
        );

        const bobin70Threshold = Math.ceil(bobinExpected * 0.70);
        const isPlaced = isBobinReplaced(bobin.id);

        if (bobinProduced >= bobin70Threshold && bobinProduced < bobinExpected && !isPlaced) {
          const loomNumber = bobin.looms?.loom_number || "-";
          const shopName = bobin.warps?.shops?.shop_name || bobin.looms?.shops?.shop_name || "the shop";
          const remaining = Math.max(bobinExpected - bobinProduced, 0);

          const { data: existingBobinAlert } = await supabase
            .from("notifications")
            .select("id")
            .ilike("title", `%Bobin ${bobin.bobin_id} reached 70%%`)
            .limit(1);

          if (!existingBobinAlert || existingBobinAlert.length === 0) {
            const title = `Loom ${loomNumber} – ${shopName}: Bobin ${bobin.bobin_id} reached 70%`;
            const message = `Loom ${loomNumber} – ${shopName}: Bobin ${bobin.bobin_id} reached 70% (${bobinProduced}/${bobinExpected} sarees, ${remaining} remaining). Prepare bobin roll.`;

            await createNotification({
              notification_type: "info",
              loom_id: bobin.loom_id,
              warp_id: bobin.warp_id,
              title,
              message,
              is_read: false,
            });

            showBrowserNotification(title, message);
          }
        }
      }
    }
  } catch (error) {
    console.error("Notification service error:", error);
  }
}

async function createNotification(notification) {
  try {
    const { error } = await supabase.from("notifications").insert(notification);
    if (error) {
      console.warn("Notification insert primary attempt failed:", error.message);
      // Fallback: try inserting with notification_type: 'info' if custom type rejected
      if (notification.notification_type !== "info") {
        await supabase.from("notifications").insert({
          ...notification,
          notification_type: "info",
        });
      }
    }
  } catch (err) {
    console.error("createNotification error:", err);
  }
}

export function showBrowserNotification(title, message) {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: message,
        icon: "/favicon.svg",
      });
    } catch (e) {
      console.error("Browser notification error:", e);
    }
  }
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.error(error);
    }
  }
}