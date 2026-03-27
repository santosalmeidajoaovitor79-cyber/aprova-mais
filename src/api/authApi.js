export function signUp(supabase, { email, password, options }) {
  return supabase.auth.signUp({ email, password, options });
}

export function signInWithPassword(supabase, email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function updateUserMetadata(supabase, data) {
  return supabase.auth.updateUser({ data });
}

export function signOut(supabase) {
  return supabase.auth.signOut();
}
