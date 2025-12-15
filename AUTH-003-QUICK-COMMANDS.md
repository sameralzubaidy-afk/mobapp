# 🚀 AUTH-003 Quick Test Commands

## 1️⃣ Seed Database
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed_admin_config.sql
```

## 2️⃣ Install Admin Portal
```bash
cd p2p-kids-admin
npm install
```

## 3️⃣ Start Admin Portal
```bash
cd p2p-kids-admin
npm run dev
```
→ Opens at **http://localhost:3001**

## 4️⃣ Navigate to Config
Open browser: **http://localhost:3001/config**

## 5️⃣ Test SMS Rate Limit
1. Change `sms_rate_limit_per_hour` to **5**
2. Click **Save**
3. ✅ Should see success message

## 6️⃣ Verify in Database
```sql
SELECT key, value FROM admin_config WHERE key = 'sms_rate_limit_per_hour';
```

## 7️⃣ Check Audit Log
```sql
SELECT * FROM audit_logs WHERE action = 'UPDATE_CONFIG' ORDER BY created_at DESC LIMIT 1;
```

---

## 🎯 What to Look For

✅ Config page loads  
✅ Current values display  
✅ Can edit and save  
✅ Validation works (try negative number)  
✅ Success/error messages show  
✅ Stats update (Today Total, Last Hour, etc.)  
✅ Audit log captures changes  

---

## 📱 Test Pages
- Home: http://localhost:3001
- Config: http://localhost:3001/config
- (Future) Users: http://localhost:3001/users
- (Future) Audit Logs: http://localhost:3001/audit-logs
