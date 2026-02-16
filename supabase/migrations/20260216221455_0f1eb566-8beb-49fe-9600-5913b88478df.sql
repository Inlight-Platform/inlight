
-- Add owner_user_id to companies
ALTER TABLE public.companies ADD COLUMN owner_user_id UUID;

-- Set Annie Thomas as owner of Alab Theater
UPDATE public.companies 
SET owner_user_id = '01e6a49d-1453-4c9c-84a4-94ebfe8cbea4'
WHERE id = 'dca36794-be45-478e-ac2f-f6e8879492fc';

-- Allow owners to update their own company
CREATE POLICY "Company owners can update their company"
ON public.companies
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);
