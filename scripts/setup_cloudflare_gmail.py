"""Optional: copy EXISTING local Gmail OAuth credentials to Cloudflare Pages secrets.
Never prints tokens. Requires `npx wrangler login` and a created Pages project.
This script is run on the USER'S computer only, not distributed with any secrets.
"""
import json
import subprocess
from pathlib import Path

folder=Path.home()/'.vehicleai'
client_path=folder/'google_oauth_client.json'
token_path=folder/'gmail_token.json'
client=json.loads(client_path.read_text(encoding='utf-8'))['installed']
token=json.loads(token_path.read_text(encoding='utf-8'))
project=input('Cloudflare Pages project name [vehicleai-browser]: ').strip() or 'vehicleai-browser'
sender=input('Authorized sending Gmail address: ').strip()
owner=input('Owner notification Gmail address [same sender]: ').strip() or sender
if not sender or '@' not in sender: raise SystemExit('Valid Gmail sender required')
if not token.get('refresh_token'): raise SystemExit('No refresh_token in gmail_token.json. Run the Gmail OAuth authorization test again to obtain an offline refresh token.')
secrets={'GMAIL_CLIENT_ID':client['client_id'],'GMAIL_CLIENT_SECRET':client['client_secret'],
    'GMAIL_REFRESH_TOKEN':token['refresh_token'],'SENDER_EMAIL':sender,'OWNER_EMAIL':owner}
print('Will securely set the following secrets; values will NOT be printed:', ', '.join(secrets))
answer=input('Proceed? (yes): ').strip().lower()
if answer!='yes': raise SystemExit('Cancelled')
for key,value in secrets.items():
    cmd=['npx','--yes','wrangler','pages','secret','put',key,'--project-name',project]
    if __import__('os').name=='nt':cmd[0]='npx.cmd'
    subprocess.run(cmd,input=value+'\n',text=True,check=True)
    print(key+': configured')
print('Done. Redeploy Cloudflare Pages. NEVER share OAuth JSON, tokens or screenshots of them.')
