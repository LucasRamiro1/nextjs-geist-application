-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    points DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    affiliate_code TEXT UNIQUE NOT NULL,
    referred_by BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_banned BOOLEAN NOT NULL DEFAULT false,
    last_interaction TIMESTAMP WITH TIME ZONE,
    is_admin BOOLEAN NOT NULL DEFAULT false
);

-- Create bot_settings table
CREATE TABLE IF NOT EXISTS bot_settings (
    id SERIAL PRIMARY KEY,
    logo_url TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bets table
CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    platform TEXT NOT NULL,
    game TEXT NOT NULL,
    bet_amount DECIMAL(10,2) NOT NULL,
    win_amount DECIMAL(10,2),
    loss_amount DECIMAL(10,2),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    duration DECIMAL(10,2) NOT NULL,
    proof_image TEXT,
    bet_type TEXT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by INTEGER REFERENCES users(id),
    approval_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create rewards table
CREATE TABLE IF NOT EXISTS rewards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    points DECIMAL(10,2) NOT NULL,
    code TEXT UNIQUE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create pending_approvals table
CREATE TABLE IF NOT EXISTS pending_approvals (
    id SERIAL PRIMARY KEY,
    bet_id INTEGER REFERENCES bets(id) NOT NULL,
    admin_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create group_analysis table
CREATE TABLE IF NOT EXISTS group_analysis (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    time_period INTEGER NOT NULL,
    data JSONB,
    is_public BOOLEAN NOT NULL DEFAULT false,
    access_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create analysis_periods table
CREATE TABLE IF NOT EXISTS analysis_periods (
    id SERIAL PRIMARY KEY,
    period_minutes INTEGER NOT NULL,
    cost_multiplier DECIMAL(3,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create broadcast_messages table
CREATE TABLE IF NOT EXISTS broadcast_messages (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target_users TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sent_by INTEGER REFERENCES users(id) NOT NULL,
    recipient_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0
);

-- Insert default bot settings
INSERT INTO bot_settings (logo_url) 
VALUES ('https://example.com/default-logo.png')
ON CONFLICT DO NOTHING;

-- Insert default analysis periods
INSERT INTO analysis_periods (period_minutes, cost_multiplier) 
VALUES 
    (30, 1.00),
    (60, 1.50),
    (120, 2.00),
    (240, 2.50),
    (480, 3.00)
ON CONFLICT DO NOTHING;

-- Insert default system settings
INSERT INTO system_settings (key, value) 
VALUES 
    ('min_bet_amount', '10.00'),
    ('max_bet_amount', '1000.00'),
    ('points_multiplier', '0.01'),
    ('affiliate_bonus', '0.05')
ON CONFLICT DO NOTHING;
