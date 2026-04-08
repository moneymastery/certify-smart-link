
CREATE OR REPLACE FUNCTION public.create_user_organization(
  _name text,
  _slug text,
  _owner_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _org_id uuid;
BEGIN
  IF auth.uid() IS DISTINCT FROM _owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO organizations (name, slug, owner_id)
  VALUES (_name, _slug, _owner_id)
  RETURNING id INTO _org_id;

  RETURN _org_id;
END;
$$;
