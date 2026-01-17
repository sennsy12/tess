-- Pricing System Migration
-- Created: 2026-01-17
-- Description: Adds customer groups, price lists, and price rules tables

-- ============================================
-- CUSTOMER GROUPS
-- ============================================
CREATE TABLE IF NOT EXISTS customer_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default groups
INSERT INTO customer_group (name, description) VALUES
    ('Standard', 'Default customer tier - standard pricing'),
    ('VIP', 'High-value customers with premium discounts'),
    ('Wholesale', 'Bulk buyers with volume-based discounts')
ON CONFLICT (name) DO NOTHING;

-- Link customers to groups (nullable = Standard tier)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kunde' AND column_name = 'customer_group_id'
    ) THEN
        ALTER TABLE kunde ADD COLUMN customer_group_id INTEGER REFERENCES customer_group(id);
    END IF;
END $$;

-- ============================================
-- PRICE LISTS
-- ============================================
CREATE TABLE IF NOT EXISTS price_list (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    priority INTEGER DEFAULT 0,  -- Higher number = takes precedence
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRICE RULES
-- ============================================
CREATE TABLE IF NOT EXISTS price_rule (
    id SERIAL PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_list(id) ON DELETE CASCADE,
    
    -- Scope selectors (NULL = applies to all in that dimension)
    varekode VARCHAR(50),                                      -- Specific product
    varegruppe VARCHAR(50),                                    -- Product category
    kundenr VARCHAR(50),                                       -- Specific customer
    customer_group_id INTEGER REFERENCES customer_group(id),   -- Customer tier
    
    -- Quantity threshold
    min_quantity INTEGER DEFAULT 1,
    
    -- Discount type (exactly one should be non-null)
    discount_percent DECIMAL(5,2),   -- e.g., 15.00 = 15% off
    fixed_price DECIMAL(12,2),       -- Override unit price
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure exactly one discount type is set
    CONSTRAINT chk_discount_type CHECK (
        (discount_percent IS NOT NULL AND fixed_price IS NULL) OR
        (discount_percent IS NULL AND fixed_price IS NOT NULL)
    )
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_price_rule_varekode ON price_rule(varekode);
CREATE INDEX IF NOT EXISTS idx_price_rule_varegruppe ON price_rule(varegruppe);
CREATE INDEX IF NOT EXISTS idx_price_rule_kundenr ON price_rule(kundenr);
CREATE INDEX IF NOT EXISTS idx_price_rule_customer_group ON price_rule(customer_group_id);
CREATE INDEX IF NOT EXISTS idx_price_rule_price_list ON price_rule(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_active ON price_list(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_list_validity ON price_list(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_kunde_customer_group ON kunde(customer_group_id);

-- ============================================
-- ROLLBACK COMMANDS (for reference)
-- ============================================
-- To completely remove the pricing system, run:
-- DROP TABLE IF EXISTS price_rule CASCADE;
-- DROP TABLE IF EXISTS price_list CASCADE;
-- ALTER TABLE kunde DROP COLUMN IF EXISTS customer_group_id;
-- DROP TABLE IF EXISTS customer_group CASCADE;
