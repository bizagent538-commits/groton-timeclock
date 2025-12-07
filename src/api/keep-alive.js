# Keep-Alive Setup Instructions
## What This Does
Pings your Supabase database once per day at noon (12:00 PM UTC) to prevent it from pausing due to inactivity on the free tier

## Files Included

1. **`api/keep-alive.js`** - The serverless function that pings Supabase
2. **`vercel.json`** - Configuration for the daily cron job

## Setup Steps

### Step 1: Add Files to Your Project

Copy these files to your project:

```
your-project/
├── api/
│   └── keep-alive.js      ← NEW FILE
├── vercel.json            ← NEW FILE (or merge with existing)
├── src/
│   └── App.jsx
└── package.json
```

**If you already have a `vercel.json` file:**
- Open your existing `vercel.json`
- Add the `"crons"` section to it
- Don't create a duplicate file

### Step 2: Deploy to Vercel

```bash
# Add the new files
git add api/keep-alive.js vercel.json

# Commit
git commit -m "Add keep-alive cron to prevent Supabase pausing"

# Push to deploy
git push origin main
```

Or use Vercel CLI:
```bash
vercel --prod
```

### Step 3: Enable Cron Jobs in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Cron Jobs**
4. You should see: `/api/keep-alive` scheduled for `0 12 * * *`
5. Make sure it's **enabled** (toggle should be on)

### Step 4: Test It Works

**Manual test:**
1. Visit: `https://your-project.vercel.app/api/keep-alive`
2. You should see:
   ```json
   {
     "status": "success",
     "message": "Database is active",
     "timestamp": "2025-01-17T12:00:00.000Z"
   }
   ```

**Check logs:**
1. Vercel Dashboard → Your Project → Logs
2. Look for "Keep-alive ping successful"

### Step 5: Verify Cron Runs Daily

- Check Vercel logs the next day
- Should see automatic ping at 12:00 PM UTC
- Vercel will email you if it fails

## Schedule Details

**Current schedule:** `0 12 * * *`
- Runs at **12:00 PM UTC** (noon) every day
- That's 7:00 AM EST or 4:00 AM PST

**To change the time:**
Edit `vercel.json` and change the cron expression:
- `0 0 * * *` = Midnight UTC
- `0 6 * * *` = 6:00 AM UTC
- `0 18 * * *` = 6:00 PM UTC
- `0 */12 * * *` = Every 12 hours

Use https://crontab.guru to help create schedules.

## Monitoring

### How to Know It's Working:

1. **Vercel Logs**
   - Go to Vercel Dashboard → Logs
   - Filter by `/api/keep-alive`
   - Should see daily entries

2. **Supabase Dashboard**
   - Check your project status
   - Should always say "Active" (never "Paused")

3. **Manual Check**
   - Visit the endpoint in your browser
   - Should return success message

### If It Stops Working:

**Check 1: Is the cron enabled?**
- Vercel Dashboard → Settings → Cron Jobs
- Make sure toggle is ON

**Check 2: Are there errors in logs?**
- Check Vercel logs for error messages
- Common issues:
  - Supabase key expired
  - Network timeout
  - Vercel cron quota exceeded (unlikely on paid plans)

**Check 3: Is Supabase still responding?**
- Test the endpoint manually
- If it returns an error, check Supabase dashboard

## Cost

- **Vercel Cron**: Free on Hobby plan (100 invocations/day limit)
- **Vercel Pro**: Unlimited cron jobs ($20/month if you upgrade)
- **This ping**: Uses 1 invocation per day = 30/month (well under limit)

## Disabling

If you upgrade to Supabase Pro or want to disable:

**Option 1: Remove from vercel.json**
```json
{
  "crons": []
}
```

**Option 2: Disable in Vercel Dashboard**
- Settings → Cron Jobs → Toggle OFF

**Option 3: Delete the file**
```bash
git rm api/keep-alive.js vercel.json
git commit -m "Remove keep-alive (no longer needed)"
git push
```

## Troubleshooting

### "Cron job not found"
- Make sure `vercel.json` is in the root of your project
- Redeploy after adding the file

### "405 Method Not Allowed"
- The endpoint only accepts GET requests
- Don't POST to it

### "Database ping failed"
- Check if Supabase project is active
- Verify API keys are correct
- Check Supabase dashboard for issues

### "Quota exceeded"
- Free Vercel plan has limits
- Upgrade to Pro or reduce frequency

## Security Notes

- The endpoint is public but harmless
- It only performs a read operation (count)
- No sensitive data exposed
- Can't modify or delete data
- API keys are in environment variables (secure)

## When to Remove This

You can safely remove the keep-alive ping when:
1. ✅ You upgrade to Supabase Pro ($25/month)
2. ✅ You move to self-hosted database
3. ✅ You switch to a different database provider

Until then, keep it running!

## Support

If you have issues:
1. Check Vercel logs
2. Check Supabase status page
3. Test the endpoint manually
4. Contact Vercel or Supabase support

---

**That's it! Your database will now stay active 24/7.** 🎉
