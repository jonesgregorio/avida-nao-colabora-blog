const fs = require('fs'), path = require('path')
const sql = fs.readFileSync(path.join(__dirname, 'kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations/022_subscriptions_email.sql'), 'utf8')
fetch('https://api.supabase.com/v1/projects/lejvvhzluggyxlfwfoxl/database/query', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer SUPABASE_TOKEN_REMOVED', 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
}).then(r => r.text()).then(t => console.log('Resultado:', t)).catch(e => console.error('Erro:', e))
