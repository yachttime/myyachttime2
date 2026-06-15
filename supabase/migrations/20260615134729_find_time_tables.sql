
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name ILIKE '%time%'
ORDER BY table_name;
