# Power Loom Management System (ERP)

A complete, production-grade Power Loom Management ERP system built for saree weaving enterprises. The application directly interfaces with Supabase (PostgreSQL, Authentication, and Storage) from a React 19 + Vite frontend.

---

## 🏭 Core Business Workflow

```
WHOLESALE SHOP
      ↓  (Provides warp yarn, bobins & specifications)
POWER LOOM
      ↓  (1 active warp & design at a time; loom-wise shop & worker rates)
SAREE PRODUCTION
      ↓  (Produced sarees stored at house stock per bobin)
STAGE 1: PRE-DELIVERY
      ↓  (Reserve house stock, specify bobin breakdown, status: pre_delivery)
SHOP INSPECTION
      ↓  (Shop checks each saree: Delivered / Pending / Returned)
STAGE 2: DELIVERY RESULT
      ↓  (Enforces Delivered + Pending + Returned = Taken; status: completed)
FINANCIAL SETTLEMENT
      ├─ Shop Wage   = Delivered × Shop Rate
      ├─ Worker Wage = Delivered × Worker Rate
      └─ Wage Diff   = Shop Wage - Worker Wage (not labeled "profit")
WORKER PAYMENTS
      └─ Advances & Week-end settlements (Cash/GPay, Void support, full audit trail)
```

---

## 📌 Key Business Rules & Logic

1. **Loom Configuration**:
   - Each loom can have **only one active warp/design** at a time.
   - A single worker can operate multiple looms.
   - Wage rates are maintained **loom-wise** (`shop_wage_per_saree > worker_wage_per_saree`).
2. **Dynamic Warps & Bobins**:
   - Variable expected saree counts (e.g. 75, 80, 100). Never hardcoded.
   - Warp design images uploaded directly to the Supabase Storage bucket `design-images`.
3. **Automated 55-Saree Alert & Completion**:
   - When cumulative production for an active warp reaches **55 sarees**, an automated attention alert is generated:
     > *"Loom [X] reached 55 sarees. Prepare the next empty roll and bobin for [Shop]."*
   - When production reaches or exceeds `expected_sarees`, the warp is automatically completed and its `end_date` is stamped with the actual completion date.
4. **House Stock Calculation**:
   - `Available = Produced - Delivered - Pending + Returned`
   - Sarees in active `pre_delivery` dispatches are reserved.
   - Returned sarees automatically re-enter available stock for future deliveries.
5. **Two-Stage Delivery Workflow**:
   - **Stage 1 (Pre-Delivery)**: Before visiting the shop, stock is validated and reserved. Bobin breakdown is recorded (e.g. B-1: 15, B-2: 5; Taken: 20). Status is `pre_delivery` with Delivered=0, Pending=0, Returned=0.
   - **Stage 2 (Delivery Result)**: Upon return from the shop, the same record is completed. Strictly enforces `Delivered + Pending + Returned = Bobin Taken` for every bobin.
6. **Pending vs Returned Sarees**:
   - **Pending**: Shop keeps the saree due to a mistake/alteration. Does **NOT** generate shop wage or worker wage. Kept in delivery history and reports. Never converted automatically to Delivered.
   - **Returned**: Saree is sent back to the house. Does **NOT** generate wages. Re-enters available stock.
7. **Worker Payments & Ledger**:
   - Supports **Advance** and **Week-End** payments via **Cash** or **GPay** (mandatory GPay reference).
   - Erroneous payments are marked **VOIDED** to preserve the financial audit trail without destructive deletion.
8. **Dashboard Statistics**:
   - Clean, focused ERP dashboard displaying strictly:
     1. Total Looms
     2. Warps Near 55
     3. Last Delivery Date
     4. Sarees Delivered in Latest Completed Delivery

---

## 🗄️ Database Architecture (`supabase_schema.sql`)

The application uses 11 relational tables with foreign keys, checks, and Row Level Security:

1. `shops` — Wholesale saree shops/dealers
2. `workers` — Weavers and operators
3. `looms` — Power looms with loom-wise wage configurations
4. `warps` — Warp rolls, design specs, images, and target capacities
5. `bobins` — Bobin rolls linked to warps and looms
6. `production_entries` — Daily saree production logged by loom, warp, and bobin
7. `deliveries` — Two-stage delivery orders
8. `delivery_items` — Loom & warp breakdown per delivery
9. `delivery_bobin_items` — Bobin-level breakdown per delivery item
10. `worker_payments` — Ledger for advances, settlements, and void records
11. `notifications` — Real-time alerts for the 55-saree threshold and warp completions

---

## 🚀 Setup & Execution

### 1. Database Setup
1. Open your [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor**.
3. Open `supabase_schema.sql` from this repository, paste its contents into the editor, and click **Run**.
4. The schema creates all 11 tables, constraints, indexes, RLS policies, and registers the `design-images` storage bucket.

### 2. Environment Variables
Create or verify `.env.local` in `power-loom-app/`:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

### 3. Running Locally
```bash
# Navigate to the app directory
cd power-loom-app

# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build for production
npm run build
```

---

## 📱 Navigation Modules
- **Overview**: Dashboard
- **Management**: Looms, Shops, Workers
- **Operations**: Warps, Bobins, Production, Delivery
- **Finance & Reports**: Worker Payments, Reports, Total History
- **System**: Notifications, Settings

---

## 📜 Total History (Material & Saree Movement Ledger)
The **Total History** module provides an end-to-end audit ledger tracking every single movement of materials and sarees throughout the enterprise lifecycle:
1. **Incoming**: Raw warp rolls and bobins received from wholesale shops with target saree capacities.
2. **Production**: Sarees woven by weavers on power looms and stored at house stock.
3. **Delivered to Shop**: Finished sarees dispatched, inspected, and accepted by shops.
4. **Pending**: Sarees kept on hold at the shop due to minor mistakes or alterations.
5. **Returned**: Sarees returned by shops to the house, returning to available stock.
6. **Available**: Real-time ready balance of house inventory by loom, warp, and bobin.

**Features**:
- Interactive top summary metric cards with instant 1-click filter activation.
- Multi-dimensional filtering by **Date Range**, **Shop**, **Loom**, **Warp**, **Bobin**, and **Movement Type**.
- Free-text search across all movement attributes.
- One-click **CSV Export** for accounting and audit compliance.
