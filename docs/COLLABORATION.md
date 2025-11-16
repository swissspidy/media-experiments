# Temporary Collaboration Feature

## Overview

The Temporary Collaboration feature allows you to share a time-limited link that grants temporary access to edit a specific post without requiring the collaborator to have a WordPress account or login.

## How to Use

### Creating a Collaboration Link

1. **Open your post** in the block editor
2. **Save your post** (collaboration links can only be created for saved posts)
3. **Open the Document Settings** panel (right sidebar)
4. **Find the "Media Experiments" section** and expand it if needed
5. **Click "Share link"** under "Temporary collaboration"

### Sharing the Link

A modal will appear with:

- **QR Code**: Can be scanned with a mobile device
- **Shareable URL**: Can be copied and sent via email, chat, etc.
- **Capability Selection**: Choose what the collaborator can do:
  - ✓ Edit post content
  - ✓ Upload media files

### Capability Options

- **Edit post content**: Allows the temporary collaborator to edit the post text, add blocks, and modify the post structure
- **Upload media files**: Allows the temporary collaborator to upload images, videos, audio, and other media files

### Link Expiration

- Links automatically expire after **15 minutes**
- You can revoke access earlier by clicking "Close" in the sharing modal
- When you close the modal, you'll see a "Collaboration link revoked" notice

## Collaborator Experience

When someone accesses your collaboration link:

1. They are redirected to the block editor for your specific post
2. They can edit and/or upload based on the capabilities you granted
3. They only have access to that one specific post
4. Their access expires after 15 minutes

## Security

### Time Limits
- All collaboration sessions expire after 15 minutes
- Expired sessions are automatically cleaned up every 15 minutes via WordPress cron

### Scoped Access
- Collaborators only have access to the specific post you shared
- They cannot access other posts, pages, or admin areas
- Permissions are checked on every request

### No Persistent Accounts
- Temporary WordPress user accounts are created for collaborators
- These accounts are automatically deleted after the session expires
- Access is temporary and non-persistent; once the session expires, there's no residual access

### Capability Control
- You explicitly choose what capabilities to grant
- Capabilities are limited to editing and uploading
- Collaborators cannot delete, publish, or manage other aspects of the site

## Use Cases

### Quick Edits
Get feedback or edits from team members without creating user accounts:
```
Share link → Collaborator edits → Changes appear in your post
```

### Client Media Upload
Allow clients to upload media directly to their post:
```
Share link (upload only) → Client uploads photos → Media appears in post
```

### Event Collaboration
During live events, allow temporary contributors:
```
Share link → Contributors add content → Revoke after event
```

### Review & Feedback
Share work-in-progress content with reviewers:
```
Share link (edit only) → Reviewer adds comments/edits → Review complete
```

## Technical Details

### Architecture

**Backend Components**:
- Custom post type: `mexp-collab-request`
- REST API endpoint: `/wp/v2/collaboration-requests`
- Permission filter: `user_has_cap`
- Cron cleanup: `mexp_collaboration_requests_cleanup`

**Frontend Components**:
- React component: `CollaborationRequestControls`
- Modal with QR code generation
- Capability selection checkboxes

**Security Measures**:
- POST meta: `mexp_allowed_capabilities`
- Parent post: Stored in `post_parent`
- URL slug: Unique identifier via `uniqid()`

### REST API Endpoints

#### Create Collaboration Request
```
POST /wp/v2/collaboration-requests
{
  "status": "publish",
  "parent": <post_id>,
  "meta": {
    "mexp_allowed_capabilities": "edit_post,upload_files"
  }
}
```

#### Get Collaboration Request
```
GET /wp/v2/collaboration-requests/<slug>
```

#### Delete Collaboration Request
```
DELETE /wp/v2/collaboration-requests/<slug>
```

### Permission System

When a collaboration request is active, the `user_has_cap` filter:

1. Checks for `collaboration_request` query parameter
2. Validates the collaboration request exists and is not expired
3. Verifies the post being accessed matches the collaboration request's parent
4. Grants only the capabilities specified in `mexp_allowed_capabilities`
5. Always grants basic `read` and `read_post` capabilities

### Cleanup Process

The WordPress cron job `mexp_collaboration_requests_cleanup`:

1. Runs every 15 minutes
2. Finds all collaboration requests older than 15 minutes
3. Permanently deletes expired requests
4. Ensures no orphaned sessions remain active

## Troubleshooting

### "Share link" button doesn't appear
- Make sure you've saved your post first
- Only saved posts can have collaboration links created

### Link doesn't work
- Check if the link has expired (15 minutes)
- Verify the post still exists
- Ensure the collaboration request wasn't manually deleted

### Collaborator can't edit
- Check which capabilities were granted
- Verify the link hasn't expired
- Confirm they're accessing the correct post

### Security concerns
- All sessions are time-limited (15 minutes maximum)
- Access is scoped to one specific post only
- No WordPress user accounts are created
- You can revoke access at any time by closing the modal

## Development

### Testing

Run the e2e tests:
```bash
npm run test:e2e -- collaboration-requests.spec.ts
```

### Extending

To add new capabilities:

1. Update `CAPABILITY_OPTIONS` in `modal.tsx`
2. Modify the permission filter in `functions.php`
3. Update documentation

## Related Features

- **Upload from another device**: Upload media without login (foundation for this feature)
- **Media recording**: Record media directly in the editor
- **Bulk optimization**: Optimize multiple media files at once

## Changelog

### Version 0.1.0
- Initial implementation of temporary collaboration
- QR code generation for easy mobile access
- Configurable capabilities (edit_post, upload_files)
- Automatic 15-minute expiration
- Cron-based cleanup
