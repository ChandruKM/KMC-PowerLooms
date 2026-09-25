import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Shops() {
  const [shops, setShops] = useState([]);
  const [looms, setLooms] = useState([]);

  // Form state
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Edit state
  const [editingShop, setEditingShop] = useState(null);
  const [editName, setEditName] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Tab filter
  const [filterTab, setFilterTab] = useState("active"); // 'active' | 'archived'

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    await Promise.all([loadShops(), loadLooms()]);
    setLoading(false);
  }

  async function loadShops() {
    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .order("shop_name");

    if (error) {
      console.error(error);
      alert("Failed to load shops: " + error.message);
    } else {
      setShops(data || []);
    }
  }

  async function loadLooms() {
    const { data, error } = await supabase
      .from("looms")
      .select("id, shop_id, loom_number, archived");

    if (error) {
      console.error(error);
      return;
    }

    setLooms(data || []);
  }

  async function addShop(e) {
    e.preventDefault();

    if (!shopName.trim()) {
      alert("Please enter shop name.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("shops").insert({
      shop_name: shopName.trim(),
      owner_name: ownerName.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      archived: false,
    });

    if (error) {
      console.error(error);
      alert(`Failed to add shop:\n${error.message}`);
    } else {
      alert("Shop added successfully.");
      setShopName("");
      setOwnerName("");
      setPhone("");
      setAddress("");
      await loadShops();
    }

    setSaving(false);
  }

  function startEditShop(shop) {
    setEditingShop(shop);
    setEditName(shop.shop_name || "");
    setEditOwner(shop.owner_name || "");
    setEditPhone(shop.phone || "");
    setEditAddress(shop.address || "");
  }

  function cancelEditShop() {
    setEditingShop(null);
  }

  async function saveEditShop(e) {
    e.preventDefault();
    if (!editingShop) return;

    if (!editName.trim()) {
      alert("Shop name cannot be empty.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from("shops")
      .update({
        shop_name: editName.trim(),
        owner_name: editOwner.trim() || null,
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
      })
      .eq("id", editingShop.id);

    if (error) {
      console.error(error);
      alert(`Failed to update shop:\n${error.message}`);
      setSaving(false);
      return;
    }

    alert("Shop updated successfully.");
    setEditingShop(null);
    await loadShops();
    setSaving(false);
  }

  async function archiveShop(id) {
    const confirmed = window.confirm(
      "Are you sure you want to archive this shop?\n\nHistorical references in deliveries and looms are safely preserved."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("shops")
      .update({ archived: true })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(`Failed to archive shop:\n${error.message}`);
      return;
    }

    await loadShops();
  }

  async function restoreShop(id) {
    const confirmed = window.confirm("Restore this shop to active status?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("shops")
      .update({ archived: false })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(`Failed to restore shop:\n${error.message}`);
      return;
    }

    await loadShops();
  }

  async function deleteShopPermanently(shop) {
    const confirmed = window.confirm(
      `Are you sure you want to PERMANENTLY delete Shop "${shop.shop_name}" from Supabase? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("shops")
        .delete()
        .eq("id", shop.id);

      if (error) {
        console.error(error);
        if (error.code === "23503" || error.message?.includes("foreign key")) {
          alert(
            `Cannot delete Shop "${shop.shop_name}" because it is linked to existing looms or delivery records. Please delete or reassign those records first.`
          );
        } else {
          alert("Failed to delete shop: " + error.message);
        }
        return;
      }

      setShops((prev) => prev.filter((s) => s.id !== shop.id));
      alert(`Shop "${shop.shop_name}" was deleted permanently from database.`);
    } catch (err) {
      console.error(err);
      alert("Unexpected error: " + err.message);
    }
  }

  function getLoomCount(shopId) {
    return looms.filter(
      (l) => String(l.shop_id) === String(shopId) && !l.archived
    ).length;
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-loading">
          <div className="loading-spinner"></div>
          <p>Loading shop information...</p>
        </div>
      </div>
    );
  }

  const activeShops = shops.filter((s) => !s.archived);
  const archivedShops = shops.filter((s) => s.archived);
  const displayedShops = filterTab === "active" ? activeShops : archivedShops;

  return (
    <div className="page-container">
      {/* PAGE HEADER */}
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">MANAGEMENT</span>
          <h2>Shops</h2>
        </div>

        <div className="page-heading-badge">
          <span>{activeShops.length}</span>
          <small>Active Shops</small>
        </div>
      </div>

      {/* ADD SHOP */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Add New Wholesale Shop</h3>
          </div>
        </div>

        <form onSubmit={addShop}>
          <div className="form-grid">
            <div className="form-field">
              <label>
                Shop Name <span className="required">*</span>
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. ABC Textiles"
                required
              />
            </div>

            <div className="form-field">
              <label>Owner / Contact Person</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
              />
            </div>

            <div className="form-field">
              <label>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>

            <div className="form-field">
              <label>Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12 Weaver Street, Textile Market"
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={saving}>
              {saving ? "Saving..." : "Add Shop"}
            </button>
          </div>
        </form>
      </div>

      {/* EDIT MODAL */}
      {editingShop && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <div>
                <h3>Edit Shop: {editingShop.shop_name}</h3>
                <p>Update shop details.</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={cancelEditShop}
              >
                ✕
              </button>
            </div>

            <form onSubmit={saveEditShop}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Shop Name <span className="required">*</span></label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Owner Name</label>
                    <input
                      type="text"
                      value={editOwner}
                      onChange={(e) => setEditOwner(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>Address</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={cancelEditShop}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SHOP LIST */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <h3>Wholesale Shop Directory</h3>
          </div>

          <div className="header-tab-group">
            <button
              type="button"
              className={`header-tab ${filterTab === "active" ? "active" : ""}`}
              onClick={() => setFilterTab("active")}
            >
              Active Shops ({activeShops.length})
            </button>
            <button
              type="button"
              className={`header-tab ${filterTab === "archived" ? "active" : ""}`}
              onClick={() => setFilterTab("archived")}
            >
              Archived ({archivedShops.length})
            </button>
          </div>
        </div>

        {displayedShops.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">◫</div>
            <h4>No {filterTab} shops found</h4>
            <p>
              {filterTab === "active"
                ? "Add your first wholesale shop using the form above."
                : "No shops are archived."}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="professional-table">
              <thead>
                <tr>
                  <th>SHOP NAME</th>
                  <th>OWNER</th>
                  <th>PHONE</th>
                  <th>ADDRESS</th>
                  <th>ACTIVE LOOMS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {displayedShops.map((shop) => {
                  const loomCount = getLoomCount(shop.id);
                  return (
                    <tr key={shop.id}>
                      <td>
                        <div className="loom-name">
                          <span className="loom-number">
                            {shop.shop_name?.charAt(0)?.toUpperCase() || "S"}
                          </span>
                          <span className="table-primary">{shop.shop_name}</span>
                        </div>
                      </td>
                      <td>{shop.owner_name || <span className="muted-text">Not provided</span>}</td>
                      <td>{shop.phone || <span className="muted-text">Not provided</span>}</td>
                      <td>{shop.address || <span className="muted-text">Not provided</span>}</td>
                      <td>
                        <span className="badge badge-neutral">
                          {loomCount} {loomCount === 1 ? "Loom" : "Looms"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          {!shop.archived ? (
                            <>
                              <button
                                type="button"
                                className="edit-button-small"
                                onClick={() => startEditShop(shop)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger-outline-button"
                                onClick={() => archiveShop(shop.id)}
                              >
                                Archive
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => restoreShop(shop.id)}
                              >
                                Restore
                              </button>
                              <button
                                type="button"
                                className="delete-row-btn"
                                title="Delete permanently from Supabase database"
                                onClick={() => deleteShopPermanently(shop)}
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

export default Shops;