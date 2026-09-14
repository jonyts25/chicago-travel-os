-- Rename places.interest value 'wife' -> 'mercedes' and update CHECK constraint.

UPDATE public.places
SET interest = 'mercedes'
WHERE interest = 'wife';

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'places'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%interest%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.places DROP CONSTRAINT %I',
      constraint_record.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.places
  ADD CONSTRAINT places_interest_check
  CHECK (interest IS NULL OR interest IN ('jonathan', 'mercedes', 'both'));
