import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260828010000_support_attachments_private_storage.sql', import.meta.url), 'utf8')
const existingSchema = readFileSync(new URL('../supabase/migrations/016_support_users_admin_improvements.sql', import.meta.url), 'utf8')
const helper = readFileSync(new URL('../src/lib/supportAttachments.ts', import.meta.url), 'utf8')
const supportPage = readFileSync(new URL('../src/components/SupportPage.tsx', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../src/components/SupportTicketDetail.tsx', import.meta.url), 'utf8')
const adminPage = readFileSync(new URL('../src/components/admin/AdminSuportePage.tsx', import.meta.url), 'utf8')
const adminAttachments = readFileSync(new URL('../src/components/admin/AdminSupportAttachmentsPanel.tsx', import.meta.url), 'utf8')
const submitContact = readFileSync(new URL('../supabase/functions/submit-contact-ticket/index.ts', import.meta.url), 'utf8')

test('schema existente já possui metadados de anexos em ticket_messages', () => {
  assert.match(existingSchema, /ADD COLUMN IF NOT EXISTS attachments JSONB/)
})

test('Storage de suporte é privado, limitado e aceita somente imagens seguras ou PDF', () => {
  assert.match(migration, /'support-attachments'/)
  assert.match(migration, /false,\s*5242880/)
  assert.match(migration, /image\/jpeg/)
  assert.match(migration, /image\/png/)
  assert.match(migration, /image\/webp/)
  assert.match(migration, /application\/pdf/)
  assert.doesNotMatch(migration, /public\s*=\s*true/)
})

test('RLS do Storage prende arquivo ao dono do ticket e preserva histórico fechado', () => {
  assert.match(migration, /support_attachments_user_select/)
  assert.match(migration, /support_attachments_user_insert/)
  assert.match(migration, /support_attachments_user_delete/)
  assert.match(migration, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/)
  assert.match(migration, /st\.id::text = \(storage\.foldername\(name\)\)\[2\]/)
  assert.match(migration, /st\.user_id = auth\.uid\(\)/)
  assert.match(migration, /st\.status NOT IN \('resolved', 'closed'\)/)
  assert.match(migration, /support_attachments_admin_select[\s\S]*public\.is_admin\(\)/)
})

test('helper limita quantidade e tamanho, evita overwrite e nunca cria URL pública', () => {
  assert.match(helper, /MAX_SUPPORT_ATTACHMENTS = 3/)
  assert.match(helper, /MAX_SUPPORT_ATTACHMENT_BYTES = 5 \* 1024 \* 1024/)
  assert.match(helper, /upsert: false/)
  assert.match(helper, /\.download\(attachment\.path\)/)
  assert.match(helper, /remove\(uploadedPaths\)/)
  assert.doesNotMatch(helper, /getPublicUrl/)
  assert.doesNotMatch(helper, /createSignedUrl/)
})

test('usuário pode anexar na abertura e recebe aviso não destrutivo se só o anexo falhar', () => {
  assert.match(supportPage, /SupportAttachmentPicker/)
  assert.match(supportPage, /uploadSupportAttachments\(user\.id, ticketId, files\)/)
  assert.match(supportPage, /attachments: uploaded/)
  assert.match(supportPage, /removeSupportAttachments\(uploaded\)/)
  assert.match(supportPage, /O chamado foi criado, mas não foi possível anexar os arquivos/)
})

test('respostas do usuário persistem e exibem anexos com rollback em falha', () => {
  assert.match(detail, /select\('id, ticket_id, sender_id, sender_role, content, is_internal, created_at, attachments'\)/)
  assert.match(detail, /attachments: uploaded/)
  assert.match(detail, /removeSupportAttachments\(uploaded\)/)
  assert.match(detail, /SupportAttachmentPicker/)
  assert.match(detail, /SupportAttachmentList/)
})

test('Admin possui visão própria dos anexos e baixa pelo mesmo fluxo privado', () => {
  assert.match(adminPage, /AdminSupportAttachmentsPanel/)
  assert.match(adminAttachments, /\.not\('attachments', 'is', null\)/)
  assert.match(adminAttachments, /SupportAttachmentList/)
  assert.match(adminAttachments, /Chamado #/)
})

test('endpoint autenticado devolve somente o próprio ticket_id e não exige contato duplicado', () => {
  const authLookup = submitContact.indexOf('auth.getUser(token)')
  const anonymousContactGate = submitContact.indexOf('if (!user && !contactName && !contactEmail)')
  assert.ok(authLookup >= 0)
  assert.ok(anonymousContactGate > authLookup)
  assert.match(submitContact, /ticket_id: user \? insertedTicket\.id : undefined/)
  assert.match(submitContact, /\.select\('id'\)\.single\(\)/)
})
