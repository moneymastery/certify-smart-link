# CertifyPro – Certificate Generation & Verification Platform

![CertifyPro](https://img.shields.io/badge/CertifyPro-v1.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Status](https://img.shields.io/badge/status-production--ready-brightgreen)

**CertifyPro** is a full-stack SaaS platform for organizations to create, issue, and verify digital certificates at scale — with QR-code verification, white-labeled branding, and bulk generation.

## ✨ Features

- **🏢 Multi-Organization Support** — Create and manage multiple organizations with role-based access (owner, admin, member)
- **🎨 Template Builder** — Drag-and-drop certificate designer with custom backgrounds, logos, signatures, seals, and dynamic text fields
- **📄 Bulk Certificate Generation** — Upload a CSV, map fields, and generate hundreds of PDF certificates in one click
- **🔍 QR Verification** — Every certificate gets a unique QR code linking to a public verification page — no login required
- **🏷️ White-Label Branding** — Verification pages display the issuing organization's name and logo
- **📦 Batch Management** — Track generation progress, download batches as ZIP, and manage certificate lifecycle
- **🔐 Authentication** — Email/password and Google OAuth sign-in with auto-confirm
- **📱 Responsive Design** — Fully functional on desktop and mobile devices

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5 |
| Styling | Tailwind CSS v3, shadcn/ui |
| Backend | Supabase (Auth, Database, Storage, Edge Functions) |
| PDF Generation | pdf-lib |
| QR Codes | qrcode |
| State Management | TanStack React Query |
| Routing | React Router v6 |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Supabase project (or use Lovable Cloud)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your Supabase URL and anon key

# Start development server
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |

## 📁 Project Structure

```
src/
├── components/
│   ├── dashboard/       # Dashboard-specific components (CSV upload, etc.)
│   ├── landing/         # Landing page sections (Hero, Features, FAQ, etc.)
│   └── ui/              # shadcn/ui component library
├── contexts/            # Auth context provider
├── hooks/               # Custom hooks (certificate generation, toast, etc.)
├── integrations/        # Supabase client & type definitions
├── lib/                 # Utilities (certificate PDF generator, helpers)
├── pages/               # Route pages (Dashboard, Login, Verify, etc.)
└── main.tsx             # App entry point
```

## 🔄 How It Works

1. **Sign Up** → Create an account with email or Google
2. **Create Organization** → Set up your org with name and optional logo
3. **Design Template** → Build a certificate template with the drag-and-drop builder
4. **Upload Recipients** → Import a CSV with recipient names, emails, and custom fields
5. **Generate Certificates** → Bulk-generate branded PDF certificates with unique QR codes
6. **Share & Verify** → Recipients scan the QR code to verify authenticity on a public page

## 🔐 Security

- Row-Level Security (RLS) on all database tables
- Organization-scoped data isolation
- Security-definer functions for cross-table access checks
- Anonymous verification without exposing private data

## 📜 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

Built with ❤️ using [Lovable](https://lovable.dev)
