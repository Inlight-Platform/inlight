DROP POLICY IF EXISTS "Users can update their own pending company requests"
  ON public.company_account_requests;

CREATE POLICY "Users can update their own pending company requests"
  ON public.company_account_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id AND status = 'pending')
  WITH CHECK (auth.uid() = requester_id AND status = 'pending');
