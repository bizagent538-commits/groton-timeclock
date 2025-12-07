// Keep-alive endpoint to prevent Supabase from pausing
// This runs once per day to keep the database active

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gvfaxuzoisjjbootvcqu.supabase.co';
  const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2ZmF4dXpvaXNqamJvb3R2Y3F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMzc4NjYsImV4cCI6MjA3ODgxMzg2Nn0.a9LDduCQCMfHX6L4Znnticljxi4iKE5tyzschDfS1-I';

  try {
    // Simple query to wake up the database
    const response = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=count`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const timestamp = new Date().toISOString();
    
    if (response.ok) {
      console.log(`[${timestamp}] Keep-alive ping successful`);
      return res.status(200).json({
        status: 'success',
        message: 'Database is active',
        timestamp
      });
    } else {
      console.error(`[${timestamp}] Keep-alive ping failed:`, response.status);
      return res.status(response.status).json({
        status: 'error',
        message: 'Failed to ping database',
        timestamp
      });
    }
  } catch (error) {
    console.error('Keep-alive error:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

4. Click **Commit changes**

---

## ✅ After Committing:

Wait 1-2 minutes for Vercel to deploy, then test:
```
https://groton-timeclock.vercel.app/api/keep-alive
