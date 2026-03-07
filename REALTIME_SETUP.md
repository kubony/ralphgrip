# Realtime Setup Instructions

This document explains how to enable Supabase Realtime for the Worvk project.

## Database Migration

The migration file `supabase/migrations/006_enable_realtime.sql` needs to be applied to enable Realtime subscriptions.

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/cksfeafxhkrlcarsjvoz/sql
2. Click "New Query"
3. Paste the following SQL:

```sql
-- Enable Realtime for work_items table
ALTER PUBLICATION supabase_realtime ADD TABLE work_items;

-- Enable Realtime for comments table
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
```

4. Click "Run" to execute the query

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
cd /path/to/worvk
supabase db push
```

## Verification

After applying the migration, you can verify that Realtime is enabled:

1. Go to Database > Replication in your Supabase dashboard
2. Check that `work_items` and `comments` tables are listed under the `supabase_realtime` publication

## How Realtime Works in Worvk

The `useRealtimeWorkItems` hook subscribes to changes on the `work_items` table:

- **INSERT**: New work items are added to the local state
- **UPDATE**: Existing work items are updated with new data (including joins for tracker, status, assignee, reporter)
- **DELETE**: Work items are removed from the local state

The hook automatically:
- Syncs with server data when props change (from revalidatePath)
- Re-fetches full work item data with joins on INSERT/UPDATE
- Cleans up subscription on component unmount

## Testing

To test Realtime synchronization:

1. Open the same project in two different browser windows
2. Create/edit/delete a work item in one window
3. The changes should appear in the other window within 1-2 seconds

## Troubleshooting

If Realtime is not working:

1. Check that the migration was applied successfully
2. Verify environment variables are set correctly
3. Check browser console for connection errors
4. Ensure RLS policies allow the current user to read work_items
