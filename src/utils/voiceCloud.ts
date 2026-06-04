/**
 * Supabase Storage sync for voice-note audio. Files live in the private
 * `voice-notes` bucket at "<userId>/<visitId>"; RLS restricts each user to
 * their own folder. IndexedDB ([[voiceStore]]) remains the local cache; this
 * module mirrors blobs to the cloud so notes follow the rep across devices.
 */
import { supabase } from '../lib/supabase'

const BUCKET = 'voice-notes'
const objectPath = (userId: string, visitId: string) => `${userId}/${visitId}`

export async function uploadVoiceNote(userId: string, visitId: string, blob: Blob): Promise<void> {
  await supabase.storage.from(BUCKET).upload(objectPath(userId, visitId), blob, {
    upsert: true,
    contentType: blob.type || 'audio/webm',
  })
}

export async function deleteVoiceNoteCloud(userId: string, visitId: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([objectPath(userId, visitId)])
}

/** visitIds currently stored in the cloud for this user. */
export async function listVoiceNotes(userId: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId)
  if (error || !data) return []
  return data.map(f => f.name)
}

export async function downloadVoiceNote(userId: string, visitId: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(objectPath(userId, visitId))
  if (error || !data) return null
  return data
}
