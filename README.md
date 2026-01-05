# Harada Flow - Role Deliverables Matrices

This app helps users create productivity and performance matrices for their roles, and generate AI-powered deliverables.

## Quick Start

### Running the app locally

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### ⚠️ Localhost Development

**Base44 doesn't allow configuring localhost**, so you have two options:

**Option 1: Mock Mode (For UI Development)**
- Add `?mock=true` to your URL: `http://localhost:5173?mock=true`
- Works without authentication, uses mock data
- ⚠️ **Changes are NOT saved to Base44** - local development only
- Perfect for UI development and testing

**Option 2: Use Base44 Preview URL**
- Access via: https://app.base44.com/apps/68682c1685e4902d2e91e89a/editor/preview
- Full functionality with real Base44 backend
- Uses code already deployed to Base44

**To Update the Real Base44 Website:**
- Edit code in Base44 Editor: https://app.base44.com/apps/68682c1685e4902d2e91e89a/editor
- Or deploy your local changes through Base44's deployment system

**👉 See [DEVELOPMENT.md](./DEVELOPMENT.md) for development guide.**  
**👉 See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.**

## Building the app

```bash
npm run build
```

## Features

- **Welcome Step**: Collect role information (job title, industry, company size)
- **Matrix Builder**: Generate and edit 8×8 productivity and performance matrices
- **Deliverable Creator**: Select deliverables and generate copy-paste prompts for LLMs

## Tech Stack

- React 18 + Vite
- Base44 SDK for backend/API
- Tailwind CSS + shadcn/ui components
- Framer Motion for animations
- React Query for data fetching

For more information and support, please contact Base44 support at app@base44.com.