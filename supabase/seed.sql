-- Seed data for testing
-- Add some test nodes

INSERT INTO nodes (id, name, status, latitude, longitude) VALUES
('norwalk-ct', 'Norwalk, CT', 'active', 41.1177, -73.4082),
('little-falls-nj', 'Little Falls, NJ', 'active', 40.8684, -74.2082),
('test-node-1', 'Test Community 1', 'active', 40.7128, -74.0060)
ON CONFLICT (id) DO NOTHING;

-- Add some test zip codes
INSERT INTO zip_codes (zip, node_id, city, state, latitude, longitude) VALUES
('06850', 'norwalk-ct', 'Norwalk', 'CT', 41.1177, -73.4082),
('07424', 'little-falls-nj', 'Little Falls', 'NJ', 40.8684, -74.2082),
('10001', 'test-node-1', 'New York', 'NY', 40.7505, -73.9934)
ON CONFLICT (zip) DO NOTHING;