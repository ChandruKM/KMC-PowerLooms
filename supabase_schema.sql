-- ============================================================================
-- POWER LOOM MANAGEMENT SYSTEM - POSTGRESQL SCHEMA (SUPABASE)
-- ============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. SHOPS TABLE
CREATE TABLE IF NOT EXISTS shops (
    id BIGSERIAL PRIMARY KEY,
    shop_name TEXT NOT NULL,
    owner_name TEXT,
    phone TEXT,
    address TEXT,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. WORKERS TABLE
CREATE TABLE IF NOT EXISTS workers (
    id BIGSERIAL PRIMARY KEY,
    worker_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. LOOMS TABLE
CREATE TABLE IF NOT EXISTS looms (
    id BIGSERIAL PRIMARY KEY,
    loom_number TEXT NOT NULL UNIQUE,
    shop_id BIGINT REFERENCES shops(id) ON DELETE RESTRICT,
    current_worker_id BIGINT REFERENCES workers(id) ON DELETE RESTRICT,
    shop_wage_per_saree NUMERIC(10, 2) NOT NULL DEFAULT 0,
    worker_wage_per_saree NUMERIC(10, 2) NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_shop_wage_greater CHECK (shop_wage_per_saree > worker_wage_per_saree),
    CONSTRAINT chk_worker_wage_positive CHECK (worker_wage_per_saree >= 0)
);

-- 4. WARPS TABLE
CREATE TABLE IF NOT EXISTS warps (
    id BIGSERIAL PRIMARY KEY,
    warp_id TEXT NOT NULL,
    loom_id BIGINT REFERENCES looms(id) ON DELETE RESTRICT,
    shop_id BIGINT REFERENCES shops(id) ON DELETE RESTRICT,
    udal_colour TEXT NOT NULL,
    border_colour TEXT NOT NULL,
    design_name TEXT,
    design_image_url TEXT,
    expected_sarees INTEGER NOT NULL CHECK (expected_sarees > 0),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. BOBINS TABLE
CREATE TABLE IF NOT EXISTS bobins (
    id BIGSERIAL PRIMARY KEY,
    bobin_id TEXT NOT NULL UNIQUE,
    loom_id BIGINT REFERENCES looms(id) ON DELETE RESTRICT,
    warp_id BIGINT REFERENCES warps(id) ON DELETE RESTRICT,
    bobin_colour TEXT NOT NULL,
    expected_sarees INTEGER NOT NULL CHECK (expected_sarees > 0),
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PRODUCTION ENTRIES TABLE
CREATE TABLE IF NOT EXISTS production_entries (
    id BIGSERIAL PRIMARY KEY,
    loom_id BIGINT REFERENCES looms(id) ON DELETE RESTRICT,
    worker_id BIGINT REFERENCES workers(id) ON DELETE RESTRICT,
    warp_id BIGINT REFERENCES warps(id) ON DELETE RESTRICT,
    bobin_id BIGINT REFERENCES bobins(id) ON DELETE RESTRICT,
    production_date DATE NOT NULL DEFAULT CURRENT_DATE,
    saree_quantity INTEGER NOT NULL CHECK (saree_quantity > 0),
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. DELIVERIES TABLE (TWO-STAGE PROCESS)
CREATE TABLE IF NOT EXISTS deliveries (
    id BIGSERIAL PRIMARY KEY,
    shop_id BIGINT REFERENCES shops(id) ON DELETE RESTRICT,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pre_delivery' CHECK (status IN ('pre_delivery', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. DELIVERY ITEMS (LOOM & WARP BREAKDOWN)
CREATE TABLE IF NOT EXISTS delivery_items (
    id BIGSERIAL PRIMARY KEY,
    delivery_id BIGINT REFERENCES deliveries(id) ON DELETE CASCADE,
    loom_id BIGINT REFERENCES looms(id) ON DELETE RESTRICT,
    warp_id BIGINT REFERENCES warps(id) ON DELETE RESTRICT,
    total_taken INTEGER NOT NULL CHECK (total_taken > 0),
    delivered_quantity INTEGER NOT NULL DEFAULT 0,
    pending_quantity INTEGER NOT NULL DEFAULT 0,
    returned_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. DELIVERY BOBIN ITEMS (BOBIN-LEVEL TRACKING)
CREATE TABLE IF NOT EXISTS delivery_bobin_items (
    id BIGSERIAL PRIMARY KEY,
    delivery_item_id BIGINT REFERENCES delivery_items(id) ON DELETE CASCADE,
    bobin_id BIGINT REFERENCES bobins(id) ON DELETE RESTRICT,
    saree_quantity INTEGER NOT NULL CHECK (saree_quantity > 0),
    delivered_quantity INTEGER NOT NULL DEFAULT 0,
    pending_quantity INTEGER NOT NULL DEFAULT 0,
    returned_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. WORKER PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS worker_payments (
    id BIGSERIAL PRIMARY KEY,
    loom_id BIGINT REFERENCES looms(id) ON DELETE RESTRICT,
    worker_id BIGINT REFERENCES workers(id) ON DELETE RESTRICT,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    payment_type TEXT NOT NULL CHECK (payment_type IN ('advance', 'week_end')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'gpay')),
    gpay_reference TEXT,
    notes TEXT,
    voided BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('loom_55', 'warp_completed', 'info')),
    loom_id BIGINT REFERENCES looms(id) ON DELETE SET NULL,
    warp_id BIGINT REFERENCES warps(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_looms_shop ON looms(shop_id);
CREATE INDEX IF NOT EXISTS idx_looms_worker ON looms(current_worker_id);
CREATE INDEX IF NOT EXISTS idx_warps_loom ON warps(loom_id);
CREATE INDEX IF NOT EXISTS idx_warps_active ON warps(loom_id) WHERE archived = FALSE AND end_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_bobins_warp ON bobins(warp_id);
CREATE INDEX IF NOT EXISTS idx_production_warp ON production_entries(warp_id);
CREATE INDEX IF NOT EXISTS idx_production_loom ON production_entries(loom_id);
CREATE INDEX IF NOT EXISTS idx_production_bobin ON production_entries(bobin_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_shop ON deliveries(shop_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_bobin_items_item ON delivery_bobin_items(delivery_item_id);
CREATE INDEX IF NOT EXISTS idx_worker_payments_worker ON worker_payments(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_payments_loom ON worker_payments(loom_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read) WHERE is_read = FALSE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allow authenticated users to manage data
-- ============================================================================
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE looms ENABLE ROW LEVEL SECURITY;
ALTER TABLE warps ENABLE ROW LEVEL SECURITY;
ALTER TABLE bobins ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_bobin_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow full access to all tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'shops', 'workers', 'looms', 'warps', 'bobins', 
            'production_entries', 'deliveries', 'delivery_items', 
            'delivery_bobin_items', 'worker_payments', 'notifications'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON %I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Full access policy" ON %I;', t);
        EXECUTE format('CREATE POLICY "Full access policy" ON %I FOR ALL USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;

-- ============================================================================
-- STORAGE BUCKET: design-images
-- Insert into storage.buckets if not exists
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('design-images', 'design-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for design-images bucket
DROP POLICY IF EXISTS "Public can view design images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload design images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update design images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads for design images" ON storage.objects;

CREATE POLICY "Allow public uploads for design images"
ON storage.objects FOR ALL
USING (bucket_id = 'design-images')
WITH CHECK (bucket_id = 'design-images');
