# Development Guide

## Running Locally

Since Base44 doesn't allow configuring localhost as an allowed origin, you have two options:

### Option 1: Use Mock Mode (Recommended for UI Development)

Mock mode allows you to develop and test the UI locally without Base44 authentication.

**To enable mock mode:**

1. Add `?mock=true` to your URL: `http://localhost:5173?mock=true`
2. Or set in browser console: `localStorage.setItem('base44_mock_mode', 'true')` then refresh

**Mock mode features:**
- ✅ Full UI functionality
- ✅ Mock data for matrices and deliverables
- ✅ No authentication required
- ⚠️ Data is not persisted (mock only)
- ⚠️ LLM calls return mock responses

**To disable mock mode:**
- Remove `?mock=true` from URL
- Or: `localStorage.removeItem('base44_mock_mode')` then refresh

### Option 2: Use Base44 Preview URL

For full functionality with real Base44 backend:

**Preview URL:** https://app.base44.com/apps/68682c1685e4902d2e91e89a/editor/preview

This uses Base44's hosting and includes:
- ✅ Real authentication
- ✅ Real data persistence
- ✅ Real LLM integrations
- ✅ Full Base44 functionality

## Development Workflow

1. **UI Development**: Use mock mode (`?mock=true`) for rapid UI iteration
   - ✅ Fast development without authentication
   - ✅ Test UI components and flows
   - ❌ Changes are **NOT** saved to Base44
   - ❌ Data is **NOT** persisted

2. **Integration Testing**: Use Base44 preview URL for testing real integrations
   - Access: https://app.base44.com/apps/68682c1685e4902d2e91e89a/editor/preview
   - ✅ Real Base44 backend
   - ✅ Real data persistence
   - ⚠️ Uses code deployed to Base44 (not your local changes)

3. **Deploying Changes**: To update the actual Base44 website
   - **Option A**: Edit directly in Base44 Editor
     - Go to: https://app.base44.com/apps/68682c1685e4902d2e91e89a/editor
     - Make changes in the Base44 editor
     - Changes are automatically saved and deployed
   
   - **Option B**: Sync local code to Base44 (if Base44 supports Git/File sync)
     - Check Base44 dashboard for "Sync" or "Deploy" options
     - May require connecting a Git repository
     - Or uploading files through Base44's interface

## Important Notes

⚠️ **Mock Mode is Local Only**
- Changes made in mock mode (`?mock=true`) are **NOT** saved to Base44
- Mock mode is for development/testing only
- To update the real Base44 website, you must deploy through Base44's system

✅ **To Update the Real Base44 Website**
- Edit code in Base44's editor, OR
- Deploy/sync your local code changes through Base44's deployment system

## Mock Mode Details

Mock mode provides:
- Mock user: `developer@example.com`
- Mock company data
- Mock matrix generation (8×8 structure)
- Mock deliverable prompts
- All UI components work normally

Data is stored in memory only and resets on page refresh.

