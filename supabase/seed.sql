-- Seed data for zones
INSERT INTO zones (id, name, risk, temp, humidity, wind, last_update) VALUES
  ('z1', 'La Ligua',      'NORMAL',     28.5, 45.2, 25.0, NOW() - INTERVAL '2 minutes'),
  ('z2', 'Petorca',       'SIN_DATOS',  NULL, NULL, NULL, NULL),
  ('z3', 'Viña del Mar',  'NORMAL',     22.3, 68.0, 15.2, NOW() - INTERVAL '3 minutes'),
  ('z4', 'Valparaíso',    'CRITICO',    41.2, 18.5, 62.0, NOW() - INTERVAL '5 minutes'),
  ('z5', 'Quilpué',       'SIN_DATOS',  NULL, NULL, NULL, NULL),
  ('z6', 'Villa Alemana', 'PREVENTIVO', 35.1, 36.8, 42.3, NOW() - INTERVAL '1 minute'),
  ('z7', 'Casablanca',    'PREVENTIVO', 34.8, 32.1, 38.5, NOW() - INTERVAL '4 minutes'),
  ('z8', 'San Antonio',   'SIN_DATOS',  NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
