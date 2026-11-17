# CodeVault

Static portfolio for HTML/CSS/JS projects, designed for GitHub Pages.

## Deploy
1. Create a GitHub repository (recommended: `codevault`).
2. Upload all files from this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, then Save.
5. Open the Pages URL shown in Settings → Pages.

## Admin uploads
Open the deployed site → **Админ-панель**. Create a GitHub fine-grained personal access token restricted to this repository with **Contents: Read and write**. Enter owner, repository, branch, and token in the panel. The token is kept in the current page's JavaScript memory and is not saved to localStorage. Upload `.html` or `.zip` files (max 20 MB). The app writes project files and `projects.json` to the repository; Pages will rebuild automatically.

## Important security and architecture notes
- GitHub Pages is static hosting. It does not provide server-side authentication, private file storage, or a secure admin backend.
- The admin panel is only a convenience gate around a GitHub token. Anyone with the token can write to the configured repository. Use a fine-grained token limited to this single repository, revoke it after use if desired, and never share it.
- Anything deployed to a public GitHub Pages URL is public. HTML source delivered to a browser can be inspected and copied. The license is a legal notice, not technical copy protection.
- If the uploaded HTML contains linked CSS/JS/assets, upload a ZIP instead; this starter catalog stores ZIP archives for download but does not automatically unpack them into a live preview.
- For a genuinely private admin area, use server-side authentication and storage (for example, a backend service) rather than GitHub Pages alone.
