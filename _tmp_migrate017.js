const https = require('https');
const fs = require('fs');

const sql = fs.readFileSync(
  'C:/Users/jones/avida-nao-colabora-blog/kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations/017_fix_admin_profiles_rls.sql',
  'utf8'
);

const body = JSON.stringify({ query: sql });
const options = {
  hostname: 'api.supabase.com',
  path: '/v1/projects/lejvvhzluggyxlfwfoxl/database/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN,
    'Content-Length': Buffer.byteLength(body),
  }
};
const req = https.request(options, res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Status:', res.statusCode, '\nBody:', data));
});
req.on('error', e => console.error(e));
req.write(body);
req.end();
