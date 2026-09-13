ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- RLS for storage objects: avatars bucket (public read, owner write) and chat-attachments (owner only)
CREATE POLICY "Avatar images are publicly viewable" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Users manage own avatar" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users manage own chat attachments" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text) WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);