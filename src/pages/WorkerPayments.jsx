import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function WorkerPayments() {
  const [looms, setLooms] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [selectedLoom, setSelectedLoom] = useState("");
  const [selectedWorker, setSelectedWorker] = useState("");

  const [form, setForm] = useState({
    paymentDate: new Date().toISOString().split("T")[0],
    amount: "",
    paymentType: "week_end", // 'advance' | 'week_end'
    paymentMethod: "cash", // 'cash' | 'gpay'
    gpayReference: "",
    notes: "",
  });

  // Filter tabs
  const [filterTab, setFilterTab] = useState("all"); // 'all' | 'active' | 'voided'

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setPageLoading(true);
    await Promise.all([
      loadLooms(),
      loadWorkers(),
      loadPayments(),
      loadDeliveries(),
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
        worker_wage_per_saree,
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
      .select("id, worker_name, archived")
      .eq("archived", false)
      .order("worker_name");

    if (error) {
      console.error(error);
      return;
    }

    setWorkers(data || []);
  }

  async function loadPayments() {
    const { data, error } = await supabase
      .from("worker_payments")
      .select(`
        *,
        looms (
          id,
          loom_number
        ),
        workers (
          id,
          worker_name
        )
      `)
      .order("payment_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setPayments(data || []);
  }

  async function loadDeliveries() {
    const { data, error } = await supabase
      .from("delivery_items")
      .select(`
        loom_id,
        delivered_quantity,
        deliveries (
          status
        )
      `);

    if (error) {
      console.error(error);
      return;
    }

    setDeliveries(data || []);
  }

  function handleLoomChange(loomId) {
    setSelectedLoom(loomId);

    const loom = looms.find((item) => String(item.id) === String(loomId));
    if (loom?.current_worker_id) {
      setSelectedWorker(String(loom.current_worker_id));
    } else {
      setSelectedWorker("");
    }
  }

  function getLoomDeliveredSarees(loomId) {
    return deliveries
      .filter(
        (item) =>
          String(item.loom_id) === String(loomId) &&
          item.deliveries?.status === "completed"
      )
      .reduce((sum, item) => sum + Number(item.delivered_quantity || 0), 0);
  }

  // REQUIREMENT 24: VOIDED PAYMENTS EXCLUDED FROM PAID TOTAL
  function getLoomPaymentsTotal(loomId, workerId) {
    return payments
      .filter(
        (payment) =>
          String(payment.loom_id) === String(loomId) &&
          String(payment.worker_id) === String(workerId) &&
          !payment.voided
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  }

  function getWorkerSummary(loomId, workerId) {
    const loom = looms.find((item) => String(item.id) === String(loomId));

    if (!loom || !workerId) {
      return {
        delivered: 0,
        rate: 0,
        earned: 0,
        paid: 0,
        remaining: 0,
      };
    }

    const delivered = getLoomDeliveredSarees(loomId);
    const rate = Number(loom.worker_wage_per_saree || 0);
    const earned = delivered * rate;
    const paid = getLoomPaymentsTotal(loomId, workerId);
    const remaining = Math.max(earned - paid, 0);

    return {
      delivered,
      rate,
      earned,
      paid,
      remaining,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!selectedLoom) {
      alert("Please select a loom.");
      return;
    }

    if (!selectedWorker) {
      alert("Please select a worker.");
      return;
    }

    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      alert("Please enter a valid payment amount (> ₹0).");
      return;
    }

    // REQUIREMENT 23: GPAY REQUIRES GPAY REFERENCE
    if (form.paymentMethod === "gpay" && !form.gpayReference.trim()) {
      alert("GPay reference / transaction ID is required when payment method is GPay.");
      return;
    }

    const summary = getWorkerSummary(selectedLoom, selectedWorker);
    if (amount > summary.remaining) {
      const confirmPayment = window.confirm(
        `Calculated remaining balance is ₹${summary.remaining.toFixed(2)}.\n\n` +
        `You entered a payment of ₹${amount.toFixed(2)} (Advance / Overpayment).\n\n` +
        `Do you still want to record this payment?`
      );

      if (!confirmPayment) return;
    }

    setLoading(true);

    const { error } = await supabase.from("worker_payments").insert({
      loom_id: Number(selectedLoom),
      worker_id: Number(selectedWorker),
      payment_date: form.paymentDate,
      amount,
      payment_type: form.paymentType,
      payment_method: form.paymentMethod,
      gpay_reference:
        form.paymentMethod === "gpay" ? form.gpayReference.trim() : null,
      notes: form.notes.trim() || null,
      voided: false,
    });

    setLoading(false);

    if (error) {
      console.error(error);
      alert(`Failed to save worker payment:\n${error.message}`);
      return;
    }

    alert("Worker payment recorded successfully.");

    setForm({
      paymentDate: new Date().toISOString().split("T")[0],
      amount: "",
      paymentType: "week_end",
      paymentMethod: "cash",
      gpayReference: "",
      notes: "",
    });

    await loadPayments();
  }

  // REQUIREMENT 24: DO NOT PHYSICALLY DELETE PAYMENTS, MARK VOIDED
  async function voidPayment(payment) {
    if (payment.voided) return;

    const confirmed = window.confirm(
      `Void payment of ₹${Number(payment.amount).toFixed(2)} to ${payment.workers?.worker_name || "worker"}?\n\n` +
      `Voided payments are NOT deleted, but they are excluded from the worker's paid total.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("worker_payments")
      .update({ voided: true })
      .eq("id", payment.id);

    if (error) {
      console.error(error);
      alert(`Failed to void payment:\n${error.message}`);
      return;
    }

    alert("Payment marked as VOIDED.");
    await loadPayments();
  }

  async function deletePaymentPermanently(payment) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete this voided payment record of ₹${Number(payment.amount || 0).toFixed(2)} from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("worker_payments")
        .delete()
        .eq("id", payment.id);

      if (error) {
        console.error(error);
        alert("Failed to delete payment: " + error.message);
        return;
      }

      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      alert("Payment record permanently deleted from database.");
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
          <p>Loading worker payment balances...</p>
        </div>
      </div>
    );
  }

  const activePayments = payments.filter((p) => !p.voided);
  const voidedPayments = payments.filter((p) => p.voided);

  let displayedPayments = payments;
  if (filterTab === "active") displayedPayments = activePayments;
  else if (filterTab === "voided") displayedPayments = voidedPayments;

  const currentSummary = getWorkerSummary(selectedLoom, selectedWorker);

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">FINANCE</span>
          <h2>Worker Payments</h2>
        </div>

        <div className="page-heading-badge">
          <span>₹{activePayments.reduce((s, p) => s + Number(p.amount || 0), 0).toFixed(0)}</span>
          <small>Total Disbursed</small>
        </div>
      </div>

      {/* RECORD PAYMENT */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Record Worker Payment</h3>
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
                value={selectedLoom}
                onChange={(e) => handleLoomChange(e.target.value)}
                required
              >
                <option value="">Select Loom</option>
                {looms.map((l) => (
                  <option key={l.id} value={l.id}>
                    Loom {l.loom_number} ({l.shops?.shop_name || "No Shop"} — Wage: ₹{l.worker_wage_per_saree}/saree)
                  </option>
                ))}
              </select>
            </div>

            {/* WORKER */}
            <div className="form-field">
              <label>
                Worker <span className="required">*</span>
              </label>
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
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

            {/* PAYMENT TYPE */}
            <div className="form-field">
              <label>
                Payment Type <span className="required">*</span>
              </label>
              <select
                value={form.paymentType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, paymentType: e.target.value }))
                }
                required
              >
                <option value="week_end">Week-End Payment</option>
                <option value="advance">Advance</option>
              </select>
            </div>

            {/* PAYMENT METHOD */}
            <div className="form-field">
              <label>
                Payment Method <span className="required">*</span>
              </label>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, paymentMethod: e.target.value }))
                }
                required
              >
                <option value="cash">Cash</option>
                <option value="gpay">GPay (UPI)</option>
              </select>
            </div>

            {/* GPAY REFERENCE */}
            {form.paymentMethod === "gpay" && (
              <div className="form-field">
                <label>
                  GPay Reference / Transaction ID <span className="required">*</span>
                </label>
                <input
                  type="text"
                  value={form.gpayReference}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      gpayReference: e.target.value,
                    }))
                  }
                  placeholder="e.g. UPI / Ref No: 409123849120"
                  required
                />
              </div>
            )}

            {/* AMOUNT */}
            <div className="form-field">
              <label>
                Payment Amount <span className="required">*</span>
              </label>
              <div className="currency-input">
                <span>₹</span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="e.g. 1500.00"
                  required
                />
              </div>
            </div>

            {/* DATE */}
            <div className="form-field">
              <label>
                Payment Date <span className="required">*</span>
              </label>
              <input
                type="date"
                value={form.paymentDate}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    paymentDate: e.target.value,
                  }))
                }
                required
              />
            </div>

            {/* NOTES */}
            <div className="form-field">
              <label>Notes / Remarks</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Optional payment notes"
              />
            </div>
          </div>

          {/* LOOM-WISE BALANCE SUMMARY CARD */}
          {selectedLoom && selectedWorker && (
            <div className="payment-balance-card">
              <div className="balance-item">
                <span className="balance-label">DELIVERED SAREES</span>
                <strong>{currentSummary.delivered}</strong>
              </div>
              <div className="balance-item">
                <span className="balance-label">LOOM WAGE RATE</span>
                <strong>₹{currentSummary.rate.toFixed(2)}</strong>
              </div>
              <div className="balance-item">
                <span className="balance-label">TOTAL EARNED</span>
                <strong className="color-green">₹{currentSummary.earned.toFixed(2)}</strong>
              </div>
              <div className="balance-item">
                <span className="balance-label">ACTIVE PAID</span>
                <strong className="color-blue">₹{currentSummary.paid.toFixed(2)}</strong>
              </div>
              <div className="balance-item highlight">
                <span className="balance-label">REMAINING BALANCE</span>
                <strong className="color-orange">₹{currentSummary.remaining.toFixed(2)}</strong>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? "Recording..." : "Save Payment"}
            </button>
          </div>
        </form>
      </div>

      {/* PAYMENT HISTORY */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Payment Ledger & Audit History</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              All ({payments.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active ({activePayments.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "voided" ? "active" : ""}`}
              onClick={() => setFilterTab("voided")}
            >
              Voided ({voidedPayments.length})
            </button>
          </div>
        </div>

        {displayedPayments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧾</div>
            <h4>No {filterTab} payments found</h4>
            <p>Payments will appear here when recorded.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>WORKER</th>
                  <th>LOOM</th>
                  <th>TYPE</th>
                  <th>METHOD & REF</th>
                  <th>AMOUNT</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {displayedPayments.map((payment) => (
                  <tr key={payment.id} className={payment.voided ? "row-voided" : ""}>
                    <td>
                      <strong>{payment.payment_date}</strong>
                    </td>

                    <td>
                      <span className="table-primary">{payment.workers?.worker_name || "-"}</span>
                    </td>

                    <td>
                      Loom {payment.looms?.loom_number || payment.loom_id}
                    </td>

                    <td>
                      <span className={`badge ${payment.payment_type === "advance" ? "badge-warning" : "badge-neutral"}`}>
                        {payment.payment_type === "advance" ? "Advance" : "Week-End"}
                      </span>
                    </td>

                    <td>
                      <div>
                        <span className="method-tag">
                          {payment.payment_method?.toUpperCase()}
                        </span>
                        {payment.gpay_reference && (
                          <div className="gpay-ref-text">Ref: {payment.gpay_reference}</div>
                        )}
                        {payment.notes && (
                          <div className="notes-text">{payment.notes}</div>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className={`money-value ${payment.voided ? "strikethrough" : ""}`}>
                        ₹{Number(payment.amount || 0).toFixed(2)}
                      </span>
                    </td>

                    <td>
                      <span className={`status-badge ${payment.voided ? "status-archived" : "status-active"}`}>
                        {payment.voided ? "VOIDED" : "ACTIVE"}
                      </span>
                    </td>

                    <td>
                      {!payment.voided ? (
                        <button
                          type="button"
                          className="danger-outline-button"
                          onClick={() => voidPayment(payment)}
                        >
                          Void
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="muted-text-small">Voided</span>
                          <button
                            type="button"
                            className="delete-row-btn"
                            title="Delete permanently from Supabase database"
                            onClick={() => deletePaymentPermanently(payment)}
                          >
                            🗑 Delete
                          </button>
                        </div>
                      )}
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