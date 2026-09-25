import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function Reports() {
  const [deliveries, setDeliveries] = useState([]);
  const [looms, setLooms] = useState([]);
  const [warps, setWarps] = useState([]);
  const [shops, setShops] = useState([]);
  const [payments, setPayments] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date range filter
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedShopFilter, setSelectedShopFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    await Promise.all([
      loadDeliveries(),
      loadLooms(),
      loadWarps(),
      loadShops(),
      loadPayments(),
      loadWorkers(),
    ]);

    setLoading(false);
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
              id,
              worker_name
            )
          ),
          warps (
            id,
            warp_id,
            udal_colour,
            border_colour,
            design_name
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
      });

    if (error) {
      console.error(error);
      alert(`Failed to load delivery reports:\n${error.message}`);
      return;
    }

    setDeliveries(data || []);
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
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setWarps(data || []);
  }

  async function loadShops() {
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .order("shop_name");

    if (error) {
      console.error(error);
      return;
    }

    setShops(data || []);
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from("worker_payments")
      .select(`
        *,
        looms (
          id,
          loom_number,
          shop_id
        ),
        workers (
          id,
          worker_name
        )
      `)
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error("Worker payments error:", error);
      return;
    }

    setPayments(data || []);
  }

  async function loadWorkers() {
    const { data, error } = await supabase
      .from("workers")
      .select("id, worker_name, archived")
      .order("worker_name");

    if (error) {
      console.error("Workers error:", error);
      return;
    }

    setWorkers(data || []);
  }

  // Filter deliveries based on date and shop
  const filteredDeliveries = deliveries.filter((d) => {
    if (selectedShopFilter !== "all" && String(d.shop_id) !== String(selectedShopFilter)) {
      return false;
    }
    if (startDate && d.delivery_date < startDate) {
      return false;
    }
    if (endDate && d.delivery_date > endDate) {
      return false;
    }
    return true;
  });

  // Filter payments based on date and shop
  const filteredPayments = payments.filter((p) => {
    if (startDate && p.payment_date < startDate) return false;
    if (endDate && p.payment_date > endDate) return false;
    if (selectedShopFilter !== "all") {
      const loom = looms.find((l) => String(l.id) === String(p.loom_id));
      if (!loom || String(loom.shop_id) !== String(selectedShopFilter)) {
        return false;
      }
    }
    return true;
  });

  // REQUIREMENT 27: OVERALL SUMMARY
  function getTakenTotal() {
    return filteredDeliveries.reduce(
      (total, delivery) =>
        total +
        (delivery.delivery_items || []).reduce(
          (sum, item) => sum + Number(item.total_taken || 0),
          0
        ),
      0
    );
  }

  function getDeliveredTotal() {
    return filteredDeliveries.reduce(
      (total, delivery) =>
        total +
        (delivery.delivery_items || []).reduce(
          (sum, item) => sum + Number(item.delivered_quantity || 0),
          0
        ),
      0
    );
  }

  function getPendingTotal() {
    return filteredDeliveries.reduce(
      (total, delivery) =>
        total +
        (delivery.delivery_items || []).reduce(
          (sum, item) => sum + Number(item.pending_quantity || 0),
          0
        ),
      0
    );
  }

  function getReturnedTotal() {
    return filteredDeliveries.reduce(
      (total, delivery) =>
        total +
        (delivery.delivery_items || []).reduce(
          (sum, item) => sum + Number(item.returned_quantity || 0),
          0
        ),
      0
    );
  }

  // REQUIREMENT 21: Shop wage: Delivered Quantity × Shop Wage Per Saree (completed deliveries only)
  function getTotalShopWage() {
    let total = 0;
    for (const delivery of filteredDeliveries) {
      if (delivery.status !== "completed") continue;
      for (const item of delivery.delivery_items || []) {
        const rate = Number(item.looms?.shop_wage_per_saree || 0);
        total += Number(item.delivered_quantity || 0) * rate;
      }
    }
    return total;
  }

  // REQUIREMENT 22: Worker wage: Delivered Quantity × Worker Wage Per Saree (completed deliveries only)
  function getTotalWorkerWage() {
    let total = 0;
    for (const delivery of filteredDeliveries) {
      if (delivery.status !== "completed") continue;
      for (const item of delivery.delivery_items || []) {
        const rate = Number(item.looms?.worker_wage_per_saree || 0);
        total += Number(item.delivered_quantity || 0) * rate;
      }
    }
    return total;
  }

  // REQUIREMENT 28: LOOM-WISE REPORT
  function getLoomReport(loomId) {
    let taken = 0;
    let delivered = 0;
    let pending = 0;
    let returned = 0;
    let shopWage = 0;
    let workerWage = 0;

    for (const delivery of filteredDeliveries) {
      for (const item of delivery.delivery_items || []) {
        if (String(item.loom_id) !== String(loomId)) continue;

        taken += Number(item.total_taken || 0);
        const d = Number(item.delivered_quantity || 0);
        const p = Number(item.pending_quantity || 0);
        const r = Number(item.returned_quantity || 0);

        delivered += d;
        pending += p;
        returned += r;

        if (delivery.status === "completed") {
          const sRate = Number(item.looms?.shop_wage_per_saree || 0);
          const wRate = Number(item.looms?.worker_wage_per_saree || 0);
          shopWage += d * sRate;
          workerWage += d * wRate;
        }
      }
    }

    // Payments made to this loom
    let advancePaid = 0;
    let weekEndPaid = 0;
    for (const p of filteredPayments) {
      if (String(p.loom_id) === String(loomId) && !p.is_void) {
        const amt = Number(p.amount || 0);
        if (p.payment_type === "advance") {
          advancePaid += amt;
        } else {
          weekEndPaid += amt;
        }
      }
    }
    const totalPaid = advancePaid + weekEndPaid;
    const balanceDue = workerWage - totalPaid;

    return {
      taken,
      delivered,
      pending,
      returned,
      shopWage,
      workerWage,
      advancePaid,
      weekEndPaid,
      totalPaid,
      balanceDue,
    };
  }

  // REQUIREMENT 29: SHOP-WISE REPORT
  function getShopReport(shopIdParam) {
    let taken = 0;
    let delivered = 0;
    let pending = 0;
    let returned = 0;
    let shopWage = 0;

    for (const delivery of filteredDeliveries) {
      if (String(delivery.shop_id) !== String(shopIdParam)) continue;

      for (const item of delivery.delivery_items || []) {
        taken += Number(item.total_taken || 0);
        const d = Number(item.delivered_quantity || 0);
        const p = Number(item.pending_quantity || 0);
        const r = Number(item.returned_quantity || 0);

        delivered += d;
        pending += p;
        returned += r;

        if (delivery.status === "completed") {
          const sRate = Number(item.looms?.shop_wage_per_saree || 0);
          shopWage += d * sRate;
        }
      }
    }

    return {
      taken,
      delivered,
      pending,
      returned,
      shopWage,
    };
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Generating business and wage reports...</p>
        </div>
      </div>
    );
  }

  const taken = getTakenTotal();
  const delivered = getDeliveredTotal();
  const pending = getPendingTotal();
  const returned = getReturnedTotal();

  const shopWage = getTotalShopWage();
  const workerWage = getTotalWorkerWage();
  const wageDifference = shopWage - workerWage; // REQUIREMENT 27: Do NOT call "profit"

  // Worker Payment aggregations
  const totalAdvancePaid = filteredPayments
    .filter((p) => !p.is_void && p.payment_type === "advance")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalWeekEndPaid = filteredPayments
    .filter((p) => !p.is_void && p.payment_type === "week_end")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalWorkerPayments = totalAdvancePaid + totalWeekEndPaid;
  const netWorkerBalance = workerWage - totalWorkerPayments;

  // Worker-wise settlement aggregation
  const workerSettlements = workers.map((worker) => {
    const workerLooms = looms.filter(
      (l) =>
        String(l.current_worker_id) === String(worker.id) ||
        String(l.workers?.id) === String(worker.id)
    );
    const loomIds = workerLooms.map((l) => String(l.id));

    let delQty = 0;
    let wageEarned = 0;

    for (const d of filteredDeliveries) {
      if (d.status !== "completed") continue;
      for (const item of d.delivery_items || []) {
        if (
          String(item.looms?.workers?.id) === String(worker.id) ||
          loomIds.includes(String(item.loom_id))
        ) {
          const q = Number(item.delivered_quantity || 0);
          const rate = Number(item.looms?.worker_wage_per_saree || 0);
          delQty += q;
          wageEarned += q * rate;
        }
      }
    }

    let advancePaid = 0;
    let weekEndPaid = 0;

    for (const p of filteredPayments) {
      if (String(p.worker_id) === String(worker.id) && !p.is_void) {
        const amt = Number(p.amount || 0);
        if (p.payment_type === "advance") {
          advancePaid += amt;
        } else {
          weekEndPaid += amt;
        }
      }
    }

    const totalPaid = advancePaid + weekEndPaid;
    const balanceDue = wageEarned - totalPaid;
    const loomDisplay =
      workerLooms.map((l) => `Loom ${l.loom_number}`).join(", ") || "-";

    return {
      workerId: worker.id,
      workerName: worker.worker_name,
      loomDisplay,
      delivered: delQty,
      wageEarned,
      advancePaid,
      weekEndPaid,
      totalPaid,
      balanceDue,
    };
  });

  // Export Comprehensive Report & Wage Settlement Bill as PDF
  function exportReportPDF() {
    try {
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const dateStr = new Date().toISOString().slice(0, 10);

      // Header Banner
      doc.setFillColor(30, 58, 138); // Deep Navy Blue
      doc.rect(0, 0, pageWidth, 22, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("POWER LOOM MANAGEMENT SYSTEM", 14, 9.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        "BUSINESS PERFORMANCE, WAGE ACCOUNTING & PAYMENT SETTLEMENT BILL",
        14,
        16.5
      );

      doc.setFontSize(8.5);
      doc.text(
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        pageWidth - 14,
        9.5,
        { align: "right" }
      );

      const shopObj = shops.find((s) => String(s.id) === String(selectedShopFilter));
      const shopLabel =
        selectedShopFilter === "all" ? "All Wholesale Shops" : (shopObj?.shop_name || "Shop");
      const dateRangeLabel =
        startDate || endDate ? `${startDate || "Start"} to ${endDate || "Present"}` : "All Dates";

      doc.text(
        `Shop: ${shopLabel} | Dates: ${dateRangeLabel}`,
        pageWidth - 14,
        16.5,
        { align: "right" }
      );

      let currentY = 26;

      // 1. Executive Summary Table
      doc.setTextColor(30, 58, 138);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text("1. Overall Financial & Delivery Performance", 14, currentY + 3);

      autoTable(doc, {
        startY: currentY + 5,
        head: [
          [
            "Sarees Delivered",
            "Shop Wage Earned",
            "Worker Wage Earned",
            "Wage Difference (Margin)",
            "Worker Payments Paid",
            "Outstanding Balance Due",
          ],
        ],
        body: [
          [
            `${delivered} Sarees`,
            `Rs. ${shopWage.toFixed(2)}`,
            `Rs. ${workerWage.toFixed(2)}`,
            `Rs. ${wageDifference.toFixed(2)}`,
            `Rs. ${totalWorkerPayments.toFixed(2)} (Adv: ${totalAdvancePaid.toFixed(0)}, W/E: ${totalWeekEndPaid.toFixed(0)})`,
            `Rs. ${netWorkerBalance.toFixed(2)}`,
          ],
        ],
        theme: "grid",
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 8.5,
          fontStyle: "bold",
          textColor: [15, 23, 42],
          halign: "center",
        },
        margin: { left: 14, right: 14 },
      });

      currentY = doc.lastAutoTable.finalY + 8;

      // 2. Loom-wise Performance & Wages Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 58, 138);
      doc.text("2. Loom-wise Production, Wages & Settlement Status", 14, currentY);

      const loomTableBody = looms.map((l) => {
        const rep = getLoomReport(l.id);
        const diff = rep.shopWage - rep.workerWage;
        return [
          `Loom ${l.loom_number}`,
          l.shops?.shop_name || "-",
          l.workers?.worker_name || "-",
          String(rep.taken),
          String(rep.delivered),
          String(rep.pending),
          String(rep.returned),
          `Rs. ${rep.shopWage.toFixed(2)}`,
          `Rs. ${rep.workerWage.toFixed(2)}`,
          `Rs. ${diff.toFixed(2)}`,
          `Rs. ${rep.totalPaid.toFixed(2)}`,
          `Rs. ${rep.balanceDue.toFixed(2)}`,
        ];
      });

      autoTable(doc, {
        startY: currentY + 2,
        head: [
          [
            "Loom",
            "Shop",
            "Worker",
            "Taken",
            "Delivered",
            "Pending",
            "Returned",
            "Shop Wage",
            "Worker Wage",
            "Margin",
            "Total Paid",
            "Balance Due",
          ],
        ],
        body: loomTableBody,
        theme: "striped",
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7.5,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 14, right: 14 },
      });

      currentY = doc.lastAutoTable.finalY + 8;
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 16;
      }

      // 3. Worker Wage Settlements Bill Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 58, 138);
      doc.text("3. Worker Wage Settlement Bill & Outstanding Dues", 14, currentY);

      const workerBillBody = workerSettlements.map((w) => [
        w.workerName,
        w.loomDisplay,
        `${w.delivered} Sarees`,
        `Rs. ${w.wageEarned.toFixed(2)}`,
        `Rs. ${w.advancePaid.toFixed(2)}`,
        `Rs. ${w.weekEndPaid.toFixed(2)}`,
        `Rs. ${w.totalPaid.toFixed(2)}`,
        `Rs. ${w.balanceDue.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY + 2,
        head: [
          [
            "Worker Name",
            "Assigned Loom(s)",
            "Delivered Sarees",
            "Wage Earned",
            "Advance Paid",
            "Week-End Paid",
            "Total Paid",
            "Outstanding Balance",
          ],
        ],
        body: workerBillBody,
        theme: "striped",
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7.5,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 14, right: 14 },
      });

      currentY = doc.lastAutoTable.finalY + 8;
      if (currentY > pageHeight - 45) {
        doc.addPage();
        currentY = 16;
      }

      // 4. Payment Transactions Log Table
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 58, 138);
      doc.text("4. Payment Transactions Audit Trail", 14, currentY);

      const paymentLogBody = filteredPayments.map((p) => [
        p.payment_date || "-",
        p.workers?.worker_name || "-",
        p.looms?.loom_number ? `Loom ${p.looms.loom_number}` : "-",
        p.payment_type === "advance" ? "Advance" : "Week End",
        p.payment_method?.toUpperCase() || "CASH",
        `Rs. ${Number(p.amount || 0).toFixed(2)}`,
        p.is_void ? "VOIDED" : "PAID",
        p.notes || "-",
      ]);

      autoTable(doc, {
        startY: currentY + 2,
        head: [
          [
            "Date",
            "Worker",
            "Loom",
            "Type",
            "Method",
            "Amount",
            "Status",
            "Notes",
          ],
        ],
        body: paymentLogBody.length > 0 ? paymentLogBody : [["No payment records in this range", "-", "-", "-", "-", "-", "-", "-"]],
        theme: "striped",
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7.5,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 14, right: 14, bottom: 15 },
        didDrawPage: (data) => {
          const totalPages = doc.getNumberOfPages();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text(
            "Power Loom ERP • Business Report & Wage Settlement Bill",
            14,
            pageHeight - 7
          );
          doc.text(
            `Page ${data.pageNumber} of ${totalPages}`,
            pageWidth - 14,
            pageHeight - 7,
            { align: "right" }
          );
        },
      });

      doc.save(`power_loom_report_bill_${dateStr}.pdf`);
    } catch (err) {
      console.error("Report PDF generation failed:", err);
      alert("Failed to generate PDF: " + (err.message || String(err)));
    }
  }

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">ANALYTICS &amp; LEDGER</span>
          <h2>Reports &amp; Wage Accounting</h2>
        </div>
        <div className="page-header-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={loadData}
            title="Refresh reports and payment data"
          >
            ↻ Refresh
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={exportReportPDF}
            title="Download comprehensive Business Report & Payment Settlement Bill as PDF"
          >
            ↓ Download Report &amp; Bill PDF
          </button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="content-card filter-card">
        <div className="report-filter-grid">
          <div className="form-field">
            <label>Filter by Shop</label>
            <select
              value={selectedShopFilter}
              onChange={(e) => setSelectedShopFilter(e.target.value)}
            >
              <option value="all">All Wholesale Shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.shop_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {(startDate || endDate || selectedShopFilter !== "all") && (
            <div className="filter-clear-btn-wrap">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSelectedShopFilter("all");
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* REQUIREMENT 27: OVERALL SUMMARY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Overall Delivery &amp; Wage Performance</h3>
            <p>
              Quantities and wages computed from deliveries across all active and completed runs.
            </p>
          </div>
        </div>

        <div className="report-summary-grid">
          <div className="report-stat-card">
            <span>TOTAL TAKEN</span>
            <strong>{taken}</strong>
            <small>Sarees loaded</small>
          </div>

          <div className="report-stat-card report-stat-success">
            <span>TOTAL DELIVERED</span>
            <strong>{delivered}</strong>
            <small>Accepted by shops</small>
          </div>

          <div className="report-stat-card report-stat-warning">
            <span>TOTAL PENDING</span>
            <strong>{pending}</strong>
            <small>Mistake / On hold</small>
          </div>

          <div className="report-stat-card report-stat-returned">
            <span>TOTAL RETURNED</span>
            <strong>{returned}</strong>
            <small>Back in stock</small>
          </div>

          <div className="report-stat-card report-money-card">
            <span>SHOP WAGE EARNED</span>
            <strong>₹{shopWage.toFixed(2)}</strong>
            <small>From delivered sarees</small>
          </div>

          <div className="report-stat-card report-money-card">
            <span>WORKER WAGE EARNED</span>
            <strong>₹{workerWage.toFixed(2)}</strong>
            <small>From delivered sarees</small>
          </div>

          <div className="report-stat-card report-difference-card">
            <span>WAGE DIFFERENCE</span>
            <strong>₹{wageDifference.toFixed(2)}</strong>
            <small>Shop wage − Worker wage (Excludes other business expenses)</small>
          </div>

          <div className="report-stat-card report-money-card">
            <span>TOTAL PAYMENTS MADE</span>
            <strong>₹{totalWorkerPayments.toFixed(2)}</strong>
            <small>Adv: ₹{totalAdvancePaid.toFixed(2)} • W/E: ₹{totalWeekEndPaid.toFixed(2)}</small>
          </div>

          <div className="report-stat-card report-stat-warning">
            <span>NET WORKER BALANCE DUE</span>
            <strong>₹{netWorkerBalance.toFixed(2)}</strong>
            <small>{netWorkerBalance >= 0 ? "Pending wage to pay" : "Advance surplus paid"}</small>
          </div>
        </div>
      </div>

      {/* REQUIREMENT 28: LOOM-WISE REPORT */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Loom-wise Report</h3>
            <p>Delivery quantities, shop earnings, worker earnings, and wage spread by loom.</p>
          </div>
          <div className="record-count">{looms.length} Looms</div>
        </div>

        {looms.length === 0 ? (
          <div className="empty-state">No looms available</div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>LOOM</th>
                  <th>SHOP</th>
                  <th>WORKER</th>
                  <th>TAKEN</th>
                  <th>DELIVERED</th>
                  <th>PENDING</th>
                  <th>RETURNED</th>
                  <th>SHOP WAGE</th>
                  <th>WORKER WAGE</th>
                  <th>WAGE DIFFERENCE</th>
                  <th>PAID</th>
                  <th>BALANCE DUE</th>
                </tr>
              </thead>
              <tbody>
                {looms.map((loom) => {
                  const rep = getLoomReport(loom.id);
                  const diff = rep.shopWage - rep.workerWage;

                  return (
                    <tr key={loom.id}>
                      <td>
                        <strong>Loom {loom.loom_number}</strong>
                      </td>
                      <td>
                        <span className="table-primary">{loom.shops?.shop_name || "-"}</span>
                      </td>
                      <td>{loom.workers?.worker_name || "-"}</td>
                      <td><strong>{rep.taken}</strong></td>
                      <td><span className="quantity-positive">{rep.delivered}</span></td>
                      <td><span className="quantity-pending">{rep.pending}</span></td>
                      <td><span className="quantity-returned">{rep.returned}</span></td>
                      <td><span className="money-value">₹{rep.shopWage.toFixed(2)}</span></td>
                      <td><span className="money-value secondary">₹{rep.workerWage.toFixed(2)}</span></td>
                      <td>
                        <strong className="color-green">₹{diff.toFixed(2)}</strong>
                      </td>
                      <td><span className="money-value">₹{rep.totalPaid.toFixed(2)}</span></td>
                      <td>
                        <strong className={rep.balanceDue > 0 ? "color-orange" : "color-green"}>
                          ₹{rep.balanceDue.toFixed(2)}
                        </strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REQUIREMENT 29: SHOP-WISE REPORT */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Shop-wise Report</h3>
            <p>Aggregated delivery totals and shop wages for each wholesale partner.</p>
          </div>
          <div className="record-count">{shops.length} Shops</div>
        </div>

        {shops.length === 0 ? (
          <div className="empty-state">No shops available</div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>SHOP</th>
                  <th>TAKEN</th>
                  <th>DELIVERED</th>
                  <th>PENDING</th>
                  <th>RETURNED</th>
                  <th>SHOP WAGE</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((shop) => {
                  const rep = getShopReport(shop.id);
                  return (
                    <tr key={shop.id}>
                      <td>
                        <div className="loom-name">
                          <span className="loom-number">{shop.shop_name?.charAt(0)?.toUpperCase()}</span>
                          <span className="table-primary">{shop.shop_name}</span>
                        </div>
                      </td>
                      <td><strong>{rep.taken}</strong></td>
                      <td><span className="quantity-positive">{rep.delivered}</span></td>
                      <td><span className="quantity-pending">{rep.pending}</span></td>
                      <td><span className="quantity-returned">{rep.returned}</span></td>
                      <td><span className="money-value">₹{rep.shopWage.toFixed(2)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* WORKER PAYMENT DETAILS & SETTLEMENT BILL SECTION */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Worker Wage Settlements &amp; Payment Ledger</h3>
            <p>Complete breakdown of wages earned, advances paid, week-end settlements, and balance dues.</p>
          </div>
          <div className="record-count">{workerSettlements.length} Workers</div>
        </div>

        {workerSettlements.length === 0 ? (
          <div className="empty-state">No workers registered</div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>WORKER</th>
                  <th>ASSIGNED LOOM(S)</th>
                  <th>SAREES DELIVERED</th>
                  <th>WAGE EARNED</th>
                  <th>ADVANCE PAID</th>
                  <th>WEEK-END PAID</th>
                  <th>TOTAL PAID</th>
                  <th>BALANCE DUE</th>
                </tr>
              </thead>
              <tbody>
                {workerSettlements.map((ws) => (
                  <tr key={ws.workerId}>
                    <td>
                      <strong>{ws.workerName}</strong>
                    </td>
                    <td>{ws.loomDisplay}</td>
                    <td>
                      <span className="quantity-positive">{ws.delivered}</span>
                    </td>
                    <td>
                      <span className="money-value">₹{ws.wageEarned.toFixed(2)}</span>
                    </td>
                    <td>₹{ws.advancePaid.toFixed(2)}</td>
                    <td>₹{ws.weekEndPaid.toFixed(2)}</td>
                    <td>
                      <strong className="money-value secondary">₹{ws.totalPaid.toFixed(2)}</strong>
                    </td>
                    <td>
                      <strong className={ws.balanceDue > 0 ? "color-orange" : "color-green"}>
                        ₹{ws.balanceDue.toFixed(2)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAYMENT TRANSACTIONS AUDIT TABLE */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Payment Transactions Log</h3>
            <p>Historical audit of all cash and GPay disbursements matching current date and shop filters.</p>
          </div>
          <div className="record-count">{filteredPayments.length} Payments</div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="empty-state">No payment records found for current filters</div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>WORKER</th>
                  <th>LOOM</th>
                  <th>TYPE</th>
                  <th>METHOD</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>NOTES</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.payment_date}</strong></td>
                    <td><span className="table-primary">{p.workers?.worker_name || "-"}</span></td>
                    <td>{p.looms?.loom_number ? `Loom ${p.looms.loom_number}` : "-"}</td>
                    <td>
                      <span className={`badge ${p.payment_type === "advance" ? "badge-warning" : "badge-info"}`}>
                        {p.payment_type === "advance" ? "Advance" : "Week End"}
                      </span>
                    </td>
                    <td>
                      <span>{p.payment_method?.toUpperCase()}</span>
                      {p.gpay_reference && (
                        <div className="muted-text-small">Ref: {p.gpay_reference}</div>
                      )}
                    </td>
                    <td>
                      <strong className="money-value">₹{Number(p.amount || 0).toFixed(2)}</strong>
                    </td>
                    <td>
                      <span className={`status-badge ${p.is_void ? "status-archived" : "status-completed"}`}>
                        {p.is_void ? "VOIDED" : "PAID"}
                      </span>
                    </td>
                    <td>{p.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REQUIREMENT 30: DELIVERY HISTORY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Delivery History</h3>
            <p>Historical log of all deliveries with loom and warp breakdowns.</p>
          </div>
          <div className="record-count">{filteredDeliveries.length} Records</div>
        </div>

        {filteredDeliveries.length === 0 ? (
          <div className="empty-state">No deliveries matching filter criteria</div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>SHOP</th>
                  <th>LOOM(S)</th>
                  <th>WARP(S)</th>
                  <th>TAKEN</th>
                  <th>DELIVERED</th>
                  <th>PENDING</th>
                  <th>RETURNED</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeliveries.map((del) => {
                  const delItems = del.delivery_items || [];
                  const loomsList = delItems.map((i) => `Loom ${i.looms?.loom_number || i.loom_id}`).join(", ");
                  const warpsList = delItems.map((i) => i.warps?.warp_id).join(", ");
                  const tTaken = delItems.reduce((s, i) => s + Number(i.total_taken || 0), 0);
                  const tDel = delItems.reduce((s, i) => s + Number(i.delivered_quantity || 0), 0);
                  const tPen = delItems.reduce((s, i) => s + Number(i.pending_quantity || 0), 0);
                  const tRet = delItems.reduce((s, i) => s + Number(i.returned_quantity || 0), 0);

                  return (
                    <tr key={del.id}>
                      <td><strong>{del.delivery_date}</strong></td>
                      <td><span className="table-primary">{del.shops?.shop_name || "-"}</span></td>
                      <td>{loomsList || "-"}</td>
                      <td><span className="warp-badge">{warpsList || "-"}</span></td>
                      <td><strong>{tTaken}</strong></td>
                      <td><span className="quantity-positive">{tDel}</span></td>
                      <td><span className="quantity-pending">{tPen}</span></td>
                      <td><span className="quantity-returned">{tRet}</span></td>
                      <td>
                        <span className={`status-badge ${del.status === "completed" ? "status-completed" : "status-pending"}`}>
                          {del.status === "completed" ? "COMPLETED" : "PRE-DELIVERY"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REQUIREMENT 31: WARP HISTORY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Warp History</h3>
            <p>Never overwritten; records every warp cycle, expected yield, and completion dates.</p>
          </div>
          <div className="record-count">{warps.length} Warps</div>
        </div>

        {warps.length === 0 ? (
          <div className="empty-state">No warp records found</div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>WARP ID</th>
                  <th>LOOM</th>
                  <th>SHOP</th>
                  <th>UDAL COLOUR</th>
                  <th>BORDER COLOUR</th>
                  <th>DESIGN</th>
                  <th>EXPECTED</th>
                  <th>START DATE</th>
                  <th>END DATE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {warps.map((w) => {
                  let status = "Active";
                  if (w.archived) status = "Archived";
                  else if (w.end_date) status = "Completed";

                  return (
                    <tr key={w.id}>
                      <td><span className="warp-badge">{w.warp_id}</span></td>
                      <td>Loom {w.looms?.loom_number || w.loom_id}</td>
                      <td><span className="table-primary">{w.shops?.shop_name || "-"}</span></td>
                      <td>{w.udal_colour}</td>
                      <td>{w.border_colour}</td>
                      <td>{w.design_name || "Standard"}</td>
                      <td><strong>{w.expected_sarees}</strong></td>
                      <td>{w.start_date || "-"}</td>
                      <td>{w.end_date || <span className="muted-text">Ongoing</span>}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BUSINESS RULES & ACCOUNTING PRINCIPLES */}
      <div className="info-card">
        <div className="info-card-icon">ℹ</div>
        <div>
          <h3>Power Loom ERP Accounting Principles</h3>
          <p>
            • <strong>Shop Wage:</strong> Earned strictly on delivered sarees accepted by the shop.
            <br />
            • <strong>Worker Wage:</strong> Credited to the weaver strictly on delivered sarees.
            <br />
            • <strong>Pending Sarees:</strong> Saree kept by shop due to defect/mistake. Does NOT generate shop or worker wage.
            <br />
            • <strong>Returned Sarees:</strong> Rejected sarees brought back to the house. Do not generate wages, and automatically return to available stock for future redelivery.
            <br />
            • <strong>Wage Difference:</strong> Shop wage minus worker wage. This represents gross margin, not net profit (operating electricity, maintenance, and administrative expenses are separate).
          </p>
        </div>
      </div>
    </div>
  );
}

export default Reports;