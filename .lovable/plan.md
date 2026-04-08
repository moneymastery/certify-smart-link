

## Problem

The app is completely blocked because **INSERT into `organizations` returns 403** (RLS violation). This happens on every page load (Dashboard, GenerateCertificates, TemplateBuilder) since they all try to auto-create an organization when none exists.

The RLS INSERT policy `WITH CHECK (auth.uid() = owner_id)` should theoretically work, but it fails in practice. This is likely a platform-level JWT validation issue with the ES256 tokens where `auth.uid()` doesn't resolve correctly during the INSERT check.

## Solution

Create a **SECURITY DEFINER database function** `create_user_organization` that handles org creation and membership atomically, bypassing RLS. Then update all three pages to call this function via `supabase.rpc()` instead of direct `.insert()`.

## Plan

### Step 1: Database migration
Create a new `create_user_organization` function:
```sql
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
  -- Check caller is the owner
  IF auth.uid() IS DISTINCT FROM _owner_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO organizations (name, slug, owner_id)
  VALUES (_name, _slug, _owner_id)
  RETURNING id INTO _org_id;

  RETURN _org_id;
END;
$$;
```

### Step 2: Update `GenerateCertificates.tsx`
Replace the direct `.insert()` on organizations (lines 67-71) with:
```ts
const { data: newOrgId, error } = await supabase.rpc('create_user_organization', {
  _name: 'My Organization',
  _slug: slug,
  _owner_id: user.id,
});
org = { id: newOrgId, name: 'My Organization' };
```

### Step 3: Update `TemplateBuilder.tsx`
Same change -- replace `.insert()` on organizations with `supabase.rpc('create_user_organization', ...)`.

### Step 4: Update `Dashboard.tsx`
Same pattern for the org creation logic (if it exists there).

---

**Technical details:** The `SECURITY DEFINER` function runs as the DB owner, bypassing RLS. It still validates `auth.uid() = _owner_id` inside the function body for security. The existing `auto_add_org_owner` trigger will still fire, adding the user as an org member automatically.

