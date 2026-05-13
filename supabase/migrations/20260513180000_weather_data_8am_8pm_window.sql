-- Add 8am-8pm precipitation window to weather_data.
--
-- The full 24-hour `precipitation` column stays as-is (drives the
-- calendar tooltip, which is meant to read as a normal weather widget).
-- The new `precipitation_8am_8pm` column holds the sum of hourly
-- precipitation between local-time 8:00 and 19:00 inclusive. The
-- attendance-vs-weather analysis uses this windowed value so a heavy
-- overnight rain that cleared by morning no longer registers as a
-- "rainy practice day".
--
-- Existing rows are left with NULL on the new column; the page's
-- weather-cache logic treats any row missing the new value as stale
-- and refetches it from Open-Meteo's hourly endpoint on the next load.

ALTER TABLE public.weather_data
  ADD COLUMN IF NOT EXISTS precipitation_8am_8pm NUMERIC;
