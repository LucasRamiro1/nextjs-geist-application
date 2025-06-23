-- Add isAdmin column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Create bot_settings table
CREATE TABLE IF NOT EXISTS bot_settings (
    id SERIAL PRIMARY KEY,
    logo_url TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default bot settings
INSERT INTO bot_settings (logo_url) 
VALUES ('https://example.com/default-logo.png')
ON CONFLICT DO NOTHING;
