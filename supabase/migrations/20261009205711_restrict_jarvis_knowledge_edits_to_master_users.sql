/*
# Restrict Bob Knowledge Base edits to Master users

1. Purpose
- Make the app's main `user_profiles.role = 'master'` the only authority that can change Bob's Knowledge Base.
- Keep Knowledge Base reading available to active Bob users.

2. Modified table
- `public.jarvis_knowledge`: replace the prior manager/admin edit permission with separate Master-only INSERT, UPDATE, and DELETE policies.
- Existing knowledge entries and columns are unchanged.

3. Security changes
- The edit policies verify the signed-in user's role directly in `user_profiles`.
- Bob's separate `jarvis_staff.role` values no longer grant Knowledge Base editing access.
- The existing read policy remains limited to active Bob users.

4. Important notes
- The Bob server already requires the app Master role before accepting requests.
- This database rule provides a second protection layer for direct authenticated database access.
*/

DROP POLICY IF EXISTS "managers edit knowledge" ON public.jarvis_knowledge;
DROP POLICY IF EXISTS "masters insert knowledge" ON public.jarvis_knowledge;
DROP POLICY IF EXISTS "masters update knowledge" ON public.jarvis_knowledge;
DROP POLICY IF EXISTS "masters delete knowledge" ON public.jarvis_knowledge;

CREATE POLICY "masters insert knowledge"
ON public.jarvis_knowledge
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
  )
);

CREATE POLICY "masters update knowledge"
ON public.jarvis_knowledge
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
  )
);

CREATE POLICY "masters delete knowledge"
ON public.jarvis_knowledge
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
  )
);