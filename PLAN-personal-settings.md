# Personal Settings Page - Implementation Plan

## Overview

Add a personal settings/profile page accessible to all users (from regular users to Super Admins). This follows SaaS best practices for user account management.

---

## Features to Include

### 1. Profile Information
| Field | Editable | Notes |
|-------|----------|-------|
| Name | Yes | User's display name |
| Email | Yes* | *Requires current password to change |
| Job Title | Yes | Pre-fills into deliverable forms |
| Profile Avatar | Optional | Could be initials-based or upload |

### 2. Security / Password Management
| Feature | Description |
|---------|-------------|
| Change Password | Current password + new password + confirm |
| Password Requirements | Display: min 8 chars, complexity rules |
| Last Password Changed | Show date for awareness |
| Password Strength Meter | Visual feedback on new password |

### 3. Account Information (Read-only)
| Field | Purpose |
|-------|---------|
| Role | USER / DEPT_ADMIN / COMPANY_ADMIN / SUPER_ADMIN |
| Organization | Company they belong to (if any) |
| Department | Department they belong to (if any) |
| Account Created | Registration date |
| Last Login | Session tracking |
| Account Status | Active / Trial / etc. |

### 4. Session Management (Best Practice)
| Feature | Description |
|---------|-------------|
| Active Sessions | List devices/browsers currently logged in |
| Logout All Devices | End all sessions except current |
| Session History | Optional: Recent login locations/times |

### 5. Notification Preferences (Future Enhancement)
| Setting | Options |
|---------|---------|
| Email Notifications | On/Off for various events |
| Deliverable Reminders | Weekly digest, etc. |

---

## UI/UX Design

### Access Points
1. **Header User Menu** - Add dropdown menu with "Settings" option
2. **Direct URL** - `/settings` or `/profile`

### Page Layout (Tabbed Interface)
```
┌─────────────────────────────────────────────────────┐
│  ⚙️ Account Settings                                │
├─────────────────────────────────────────────────────┤
│  [Profile] [Security] [Sessions] [Preferences]      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Profile Tab:                                       │
│  ┌─────────────────────────────────────────────┐   │
│  │ Avatar    Name: [John Smith_________]       │   │
│  │  (JS)     Email: [john@company.com__]       │   │
│  │           Job Title: [Software Engineer]    │   │
│  │                                             │   │
│  │           [Save Changes]                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Account Info (read-only card):                    │
│  ┌─────────────────────────────────────────────┐   │
│  │ Role: Company Admin                         │   │
│  │ Organization: Acme Corp                     │   │
│  │ Department: Engineering                     │   │
│  │ Member since: Jan 15, 2025                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Profile & Password (MVP)

**Frontend:**
1. Create `/src/pages/Settings.jsx` - Main settings page with tabs
2. Create `/src/components/settings/ProfileTab.jsx` - Name, email, job title
3. Create `/src/components/settings/SecurityTab.jsx` - Change password
4. Update `Layout.jsx` - Add user menu dropdown with Settings link
5. Add route in `src/pages/index.jsx`

**Backend:**
1. `PATCH /api/auth/me` - Already exists, update to handle email change
2. `POST /api/auth/change-password` - New endpoint for password change
   - Requires: currentPassword, newPassword
   - Validates current password before allowing change

### Phase 2: Session Management

**Frontend:**
1. Create `/src/components/settings/SessionsTab.jsx`
   - List active sessions
   - "Logout all other devices" button

**Backend:**
1. `GET /api/auth/sessions` - List user's active sessions
2. `DELETE /api/auth/sessions` - Logout all other sessions
3. `DELETE /api/auth/sessions/:id` - Logout specific session

**Database:**
- Session model already exists with userAgent, ipAddress, createdAt

### Phase 3: Enhanced Security (Future)

1. **Two-Factor Authentication (2FA)**
   - TOTP-based (Google Authenticator, etc.)
   - Backup codes
   - New DB fields: `twoFactorSecret`, `twoFactorEnabled`, `backupCodes`

2. **Login History / Audit Log**
   - Track login attempts (success/failure)
   - IP address, user agent, timestamp
   - New model: `LoginHistory`

---

## Files to Create/Modify

### New Files
| File | Description |
|------|-------------|
| `src/pages/Settings.jsx` | Main settings page |
| `src/components/settings/ProfileTab.jsx` | Profile editing |
| `src/components/settings/SecurityTab.jsx` | Password management |
| `src/components/settings/SessionsTab.jsx` | Session management |
| `src/components/common/UserMenu.jsx` | Header dropdown menu |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/Layout.jsx` | Replace logout button with user menu dropdown |
| `src/pages/index.jsx` | Add /settings route |
| `src/api/apiClient.js` | Add changePassword, getSessions, deleteSessions methods |
| `server/src/routes/auth.js` | Add change-password, sessions endpoints |
| `server/src/services/auth.service.js` | Add changePassword, listSessions, deleteSessions functions |

---

## API Endpoints

### Change Password
```
POST /api/auth/change-password
Body: { currentPassword, newPassword }
Response: { success: true, message: "Password changed successfully" }
Errors:
  - 400: Current password is incorrect
  - 400: New password doesn't meet requirements
```

### List Sessions
```
GET /api/auth/sessions
Response: {
  data: [
    {
      id: "session-id",
      userAgent: "Chrome on macOS",
      ipAddress: "192.168.1.1",
      createdAt: "2025-01-15T10:30:00Z",
      lastUsedAt: "2025-01-15T14:20:00Z",
      isCurrent: true
    }
  ]
}
```

### Logout Other Sessions
```
DELETE /api/auth/sessions
Response: { success: true, count: 3 } // Number of sessions terminated
```

### Logout Specific Session
```
DELETE /api/auth/sessions/:id
Response: { success: true }
```

---

## Security Considerations

### Password Change
- Require current password for all sensitive changes
- Rate limit password change attempts
- Send email notification when password is changed
- Invalidate all other sessions after password change (optional)

### Email Change
- Require current password
- Consider: Send verification email to new address
- Consider: Send notification to old address

### Session Management
- Don't expose full session tokens in API responses
- Mark "current session" clearly
- Consider geographic/device-based anomaly detection

---

## User Menu Design

Replace the current logout button with a dropdown:

```jsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <Button variant="ghost">
      <User className="w-4 h-4 mr-2" />
      {currentUser.name || currentUser.email}
      <ChevronDown className="w-4 h-4 ml-2" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>
      <User className="w-4 h-4 mr-2" />
      {currentUser.email}
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem asChild>
      <Link to="/settings">
        <Settings className="w-4 h-4 mr-2" />
        Account Settings
      </Link>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleLogout}>
      <LogOut className="w-4 h-4 mr-2" />
      Sign Out
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Verification Plan

### Phase 1 Testing
1. Navigate to /settings
2. Edit name → saves correctly
3. Edit job title → saves correctly
4. Edit email → requires password, saves correctly
5. Change password:
   - Wrong current password → error
   - Weak new password → error
   - Valid change → success, can login with new password

### Phase 2 Testing
1. Login from multiple browsers
2. View sessions → shows all active sessions
3. Current session is marked
4. "Logout all other devices" → other sessions terminated
5. Check other browsers → redirected to login

---

## Estimated Effort

| Phase | Components | Priority |
|-------|------------|----------|
| Phase 1 | Profile + Password | High (MVP) |
| Phase 2 | Session Management | Medium |
| Phase 3 | 2FA + Audit Log | Low (Future) |

---

## Questions to Consider

1. **Email change verification**: Should changing email require verification of the new address?
2. **Password change notification**: Send email when password is changed?
3. **Session invalidation**: Automatically logout all sessions when password changes?
4. **Profile picture**: Include avatar upload or use initials-based avatars?
5. **Notification preferences**: Include in MVP or defer?

---

## Recommendation

Start with **Phase 1** (Profile + Password) as it covers the essential user needs. The UI is straightforward and the backend changes are minimal. Phase 2 (Sessions) adds valuable security features and can follow quickly. Phase 3 (2FA) is a larger undertaking that can be planned separately.
