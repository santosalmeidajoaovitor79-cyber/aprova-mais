-- Permite ao usuário apagar o próprio histórico de chat por tópico (nova conversa, estilo ChatGPT).
create policy "topic_messages_delete_own"
  on public.topic_messages for delete
  to authenticated
  using (auth.uid() = user_id);
