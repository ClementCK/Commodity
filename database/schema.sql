-- Commodity Deal Tracker Database Schema
-- SQLite 3.x Compatible

-- Enable foreign key constraints (SQLite needs this explicitly)
PRAGMA foreign_keys = ON;

-- ============================================
-- TABLE: sources
-- Stores information about contacts who send deals
-- ============================================
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    reliability_rating INTEGER DEFAULT 3 CHECK(reliability_rating >= 1 AND reliability_rating <= 10),
    notes TEXT,
    total_deals INTEGER DEFAULT 0,
    successful_deals INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster source lookups by name
CREATE INDEX IF NOT EXISTS idx_sources_name ON sources(name);

-- ============================================
-- TABLE: deals
-- Stores all commodity trading deals
-- ============================================
CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Commodity information
    commodity_type TEXT NOT NULL,
    
    -- Source information
    source_name TEXT NOT NULL,
    source_reliability INTEGER CHECK(source_reliability >= 1 AND source_reliability <= 10),
    
    -- Deal details
    deal_text TEXT,
    price REAL,
    price_currency TEXT DEFAULT 'USD',
    quantity REAL,
    quantity_unit TEXT,
    origin_country TEXT,
    payment_method TEXT,
    shipping_terms TEXT,
    additional_notes TEXT,
    date_received DATE NOT NULL,
    
    -- Pipeline status
    status TEXT DEFAULT 'unassigned' CHECK(
        status IN (
            'unassigned', 
            'under_review', 
            'in_progress', 
            'done', 
            'closed_lost', 
            'on_hold', 
            'rejected'
        )
    ),
    
    -- AI scoring
    ai_score INTEGER CHECK(ai_score >= 0 AND ai_score <= 100),
    ai_reasoning TEXT,
    manual_score INTEGER CHECK(manual_score >= 0 AND manual_score <= 100),
    
    -- File attachment
    file_path TEXT,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to sources table
    FOREIGN KEY (source_name) REFERENCES sources(name) ON UPDATE CASCADE
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_commodity ON deals(commodity_type);
CREATE INDEX IF NOT EXISTS idx_deals_date ON deals(date_received DESC);
CREATE INDEX IF NOT EXISTS idx_deals_score ON deals(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_deals_source ON deals(source_name);

-- ============================================
-- TABLE: status_history
-- Tracks all status changes for deals
-- ============================================
CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    
    -- Foreign key to deals table
    FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
);

-- Index for faster status history lookups
CREATE INDEX IF NOT EXISTS idx_status_history_deal ON status_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_status_history_date ON status_history(changed_at DESC);

-- ============================================
-- TRIGGER: Update deals.updated_at on any change
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_deals_timestamp 
AFTER UPDATE ON deals
FOR EACH ROW
BEGIN
    UPDATE deals SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;

-- ============================================
-- TRIGGER: Auto-increment source deal counts
-- ============================================
CREATE TRIGGER IF NOT EXISTS increment_source_deals
AFTER INSERT ON deals
FOR EACH ROW
BEGIN
    UPDATE sources 
    SET total_deals = total_deals + 1 
    WHERE name = NEW.source_name;
END;

-- ============================================
-- TRIGGER: Update successful_deals when deal status changes to 'done'
-- ============================================
CREATE TRIGGER IF NOT EXISTS increment_successful_deals
AFTER UPDATE OF status ON deals
FOR EACH ROW
WHEN NEW.status = 'done' AND OLD.status != 'done'
BEGIN
    UPDATE sources 
    SET successful_deals = successful_deals + 1 
    WHERE name = NEW.source_name;
END;

-- ============================================
-- Insert some default/example sources for testing
-- ============================================
INSERT OR IGNORE INTO sources (name, reliability_rating, notes) VALUES
('Alan Kuk', 7, 'Ghana gold supplier, reliable contact since 2023'),
('Xue ', 4, 'Chinese copper trader, new contact'),
('Mat', 8, 'Brazilian iron ore exporter, very reliable');