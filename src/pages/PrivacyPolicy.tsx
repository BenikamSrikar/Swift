import VoltsNavbar from '@/components/VoltsNavbar';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <VoltsNavbar />
      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 text-foreground/80 space-y-6">
        <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
        
        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">1. Introduction</h2>
          <p>
            Welcome to SWIFT Connect. Your privacy is our priority. This Privacy Policy explains how we handle your data when you use our peer-to-peer file transfer service. Since our service is built around WebRTC, your files are transferred directly between peers and are never stored on our servers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">2. Data We Collect</h2>
          <p>We collect minimal data required to operate the service:</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><strong>Account Data:</strong> We use Google OAuth for authentication. We securely store your email address, name, and profile picture URL.</li>
            <li><strong>Transfer History:</strong> We maintain a log of your file transfer metadata (filename, size, recipient/sender name, and timestamps) for your personal reference. The actual files are never logged or stored.</li>
            <li><strong>Session Data:</strong> Temporary connection metadata (like WebRTC signals) required to establish a peer-to-peer connection. This data is dropped when the session ends.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">3. Google Drive Integration</h2>
          <p>For files exceeding 25MB, SWIFT Connect utilizes your Google Drive to facilitate the transfer.</p>
          <ul className="list-disc pl-6 mt-2 space-y-2">
            <li><strong>Requested Scopes:</strong> We request the `https://www.googleapis.com/auth/drive.file` scope. This gives us access to see, edit, create, and delete <strong>only the specific files</strong> that SWIFT Connect uploads. We cannot access your existing personal Drive files.</li>
            <li><strong>Usage:</strong> The file is uploaded to the sender's Drive. We then automatically share it (read-only) with the specific receiver's email address.</li>
            <li><strong>Auto-Cleanup:</strong> To protect your storage quotas, SWIFT Connect automatically deletes the uploaded file from your Google Drive one hour after the transfer is initiated.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">4. Data Sharing</h2>
          <p>
            We do not sell, rent, or share your personal data with third parties. File transfers happen directly between the sender and receiver. If Google Drive is used, the file is shared strictly between you and your chosen recipient via Google's secure permission system.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-3">5. Your Consent</h2>
          <p>
            By using SWIFT Connect and logging in via Google, you consent to this Privacy Policy. You can revoke our access to your Google account at any time via your Google Account Permissions settings.
          </p>
        </section>

        <p className="pt-8 text-sm text-muted-foreground border-t mt-12">
          Last updated: {new Date().toLocaleDateString()}
        </p>
      </main>
    </div>
  );
}
