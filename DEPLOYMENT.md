# 🚀 Automated Deployment Guide: Vercel + Render

This guide walks you through deploying **Computational Entropy Lab** to production with:
- **Frontend**: Vercel (serverless)
- **Backend**: Render (containerized)
- **Database**: PostgreSQL on Render

**Total Time**: ~30-40 minutes

---

## Phase 1: Setup PostgreSQL on Render (10 min)

### Step 1.1: Create Render Account
- Go to [render.com](https://render.com)
- Sign up with GitHub (easier)

### Step 1.2: Create PostgreSQL Database
1. Click **"New"** → **"PostgreSQL"**
2. Fill in details:
   - **Name**: `comp-ent-db`
   - **Database**: `entropy_lab` (default)
   - **Region**: Pick closest to your users
3. Click **"Create Database"**
4. Wait 2-3 minutes for creation

### Step 1.3: Copy Database URL
- Once created, you'll see the **Internal Database URL**
- Copy it: `postgresql://user:password@host:5432/database`
- **Save this somewhere safe** ✅

---

## Phase 2: Migrate Your SQLite Data to PostgreSQL (10 min)

### Step 2.1: Install pgloader
- Download from [pgloader.io](https://pgloader.io) (Windows binary)
- Or via Chocolatey: `choco install pgloader`

### Step 2.2: Migrate Data
```bash
pgloader sqlite:///c:\Users\fkr77\Downloads\comp_ent\backend\data\entropy_lab.db postgresql://user:password@host:5432/entropy_lab
```

### Step 2.3: Verify Migration
- In Render dashboard, click your database
- Click **"Query"** → Run: `SELECT COUNT(*) FROM measurements;`
- Should show **225** (your current data count) ✅

---

## Phase 3: Deploy Backend to Render (5 min)

### Step 3.1: Create Web Service
1. Render Dashboard → **"New"** → **"Web Service"**
2. Connect your GitHub repo: `https://github.com/febinrenu/comp_entropy.git`
3. Configuration:
   - **Name**: `comp-ent-api`
   - **Branch**: `master`
   - **Root Directory**: `backend/` (leave empty if using root)
   - **Environment**: `Python 3.10`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000`
   - **Plan**: Free (sufficient for testing)

### Step 3.2: Add Environment Variables
Click **"Environment"** and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://user:password@host:5432/entropy_lab` |
| `SECRET_KEY` | Generate a random 32+ char key (e.g., `openssl rand -hex 32`) |
| `DEBUG` | `false` |
| `PORT` | `8000` |
| `ALLOWED_ORIGINS` | (leave blank, will add after frontend deploys) |

### Step 3.3: Deploy
- Click **"Create Web Service"**
- Wait 3-5 minutes for build & deploy
- Once done, you'll get URL: `https://comp-ent-api.onrender.com` ✅

---

## Phase 4: Deploy Frontend to Vercel (3 min)

### Step 4.1: Create Vercel Project
1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import your GitHub repo: `https://github.com/febinrenu/comp_entropy.git`

### Step 4.2: Configure
- **Project Name**: `comp-ent`
- **Framework**: `Create React App`
- **Root Directory**: `frontend/`
- **Build Command**: `npm run build`
- **Output Directory**: `build`

### Step 4.3: Add Environment Variables
Before deploying, add:

| Key | Value |
|-----|-------|
| `REACT_APP_API_URL` | `https://comp-ent-api.onrender.com/api` |

### Step 4.4: Deploy
- Click **"Deploy"**
- Wait 1-2 minutes
- You'll get URL: `https://comp-ent.vercel.app` ✅

---

## Phase 5: Connect Frontend to Backend (2 min)

### Step 5.1: Update Render CORS
1. Render Dashboard → `comp-ent-api` → **"Environment"**
2. Update `ALLOWED_ORIGINS`:
   ```
   https://comp-ent.vercel.app,https://www.comp-ent.vercel.app
   ```
3. Click **"Save"** → Service redeploys automatically

### Step 5.2: Test the Connection
1. Visit `https://comp-ent.vercel.app`
2. Open browser DevTools (F12)
3. Check **Console** for errors
4. Dashboard should load with data ✅

---

## Phase 6: Verify Everything Works (5 min)

### Checklist:
- [ ] Frontend loads without errors: `https://comp-ent.vercel.app`
- [ ] Dashboard displays stats
- [ ] Energy consumption chart shows historical data
- [ ] Can navigate between pages
- [ ] API calls don't have CORS errors (check DevTools Console)
- [ ] Metrics and data display correctly

### If Something Breaks:
**Check Backend Logs**:
- Render Dashboard → `comp-ent-api` → **"Logs"**
- Look for errors related to database or CORS

**Check Frontend Logs**:
- Browser DevTools → **"Console"** tab
- Look for failed API calls

**Check Database Connection**:
- Render Dashboard → Database → **"Query"**
- Run: `SELECT COUNT(*) FROM experiments;` (should show >0)

---

## Optional: Custom Domain

1. **Vercel**: 
   - Project Settings → **"Domains"**
   - Add your domain (e.g., `app.example.com`)
   - Update Render CORS accordingly

2. **Render**:
   - Web Service → **"Settings"**
   - Add Custom Domain (e.g., `api.example.com`)

---

## Monitoring & Updates

### Automatic Redeployment
- Push to `master` branch → Both Vercel & Render auto-redeploy 🎉

### View Logs
- **Vercel**: Deployments tab
- **Render**: Live logs in dashboard

### Scale Up (Paid)
- Go from Free → Pro tier for better performance
- Both platforms have easy upgrade paths

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 404 on frontend | Check `REACT_APP_API_URL` env var in Vercel |
| CORS errors | Update `ALLOWED_ORIGINS` in Render |
| Database connection fails | Verify `DATABASE_URL` on Render |
| Frontend won't load | Check Vercel Logs tab for build errors |
| Data not showing | Run `SELECT COUNT(*) FROM measurements;` in psql |

---

## Success! 🎉

Your app is now live with:
- ✅ Production database (PostgreSQL)
- ✅ Scalable backend (Render)
- ✅ Fast frontend hosting (Vercel)
- ✅ Automatic deployments from GitHub
- ✅ All historical data preserved

**Frontend**: https://comp-ent.vercel.app  
**Backend**: https://comp-ent-api.onrender.com  
**GitHub**: https://github.com/febinrenu/comp_entropy

---

## Need Help?

Check Render & Vercel documentation:
- Render: https://render.com/docs
- Vercel: https://vercel.com/docs
- PostgreSQL: https://www.postgresql.org/docs/

