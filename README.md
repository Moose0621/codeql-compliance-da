<div align="center">

🛡️

# Enterprise CodeQL Security Dashboard

A comprehensive security compliance dashboard for managing and monitoring CodeQL workflow dispatches across GitHub repositories to meet FedRAMP audit requirements with on-demand scanning capabilities and GitHub organization integration.

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

:star: If you like this project, star it on GitHub — it helps a lot!

[Overview](#overview) • [Features](#features) • [Getting started](#getting-started) • [Run the application](#run-the-application) • [Usage](#usage) • [Architecture](#architecture)

![Screenshot of the CodeQL Security Dashboard](docs/dashboard-preview.png)

</div>

## Overview

The **Enterprise CodeQL Security Dashboard** streamlines security compliance by providing real-time management and monitoring of CodeQL workflows across your GitHub organization. Built specifically to meet **FedRAMP audit requirements**, this application enables on-demand security scanning with comprehensive audit trails and compliance reporting.

This dashboard integrates directly with the GitHub API to:
- **Discover repositories** with CodeQL workflows automatically
- **Dispatch on-demand scans** via GitHub workflow dispatch API
- **Track security findings** in real-time from GitHub Code Scanning alerts
- **Generate compliance reports** for FedRAMP and enterprise auditing
- **Maintain audit trails** with complete scan history and workflow correlation

<div align="center">
  <img src="docs/architecture-overview.png" alt="Application architecture" width="640px" />
</div>

The application consists of:

- A **React 19** web application with TypeScript and Tailwind CSS for the enterprise-grade user interface
- **GitHub API integration** using Octokit for repository management and CodeQL workflow dispatch
- **Real-time status tracking** with automatic scan result updates
- **Compliance reporting** with PDF, CSV, and JSON export capabilities
- **Local storage persistence** via GitHub Spark hooks for configuration and audit data

> [!TIP]
> This application requires only a GitHub Personal Access Token to get started - no additional infrastructure setup needed.

## Features

- **GitHub Organization Integration**: Secure authentication with Personal Access Token and real-time repository discovery
- **Repository Management**: Automatic detection of CodeQL-enabled repositories with workflow dispatch capabilities
- **On-Demand Scanning**: Trigger live CodeQL scans via GitHub API with real-time progress monitoring
- **Security Visualization**: Display live security alerts categorized by severity (Critical, High, Medium, Low, Note)
- **Audit Trail Dashboard**: Complete historical view of scan requests with GitHub workflow correlation
- **Compliance Reporting**: Generate FedRAMP-ready reports in multiple formats (PDF, CSV, JSON)
- **Real-time Updates**: Automatic status updates and scan result synchronization
- **Enterprise Security**: Token validation, rate limiting awareness, and permission-based access control

## Getting started

There are multiple ways to get started with this project. The quickest way is to clone the repository and run it locally.

### Prerequisites

You need the following tools to work on your local machine:

- [Node.js 18+](https://nodejs.org/download/)
- [Git](https://git-scm.com/downloads)
- **GitHub Personal Access Token** with these scopes:
  - `repo` - Full repository access
  - `security_events` - Read security events
  - `actions:read` - Read GitHub Actions workflows
  - `metadata:read` - Read repository metadata

### Use your local environment

Then you can get the project code:

1. **Fork** the project to create your own copy of this repository
2. Clone your forked repository:

   ```bash
   git clone <your-repo-url>
   cd codeql-compliance-da
   ```

3. Install the dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open your browser to `http://localhost:5173`

### (Optional) System configuration via environment variables

If you prefer not to enter your GitHub token through the UI (or you are running in an environment where the original Spark KV storage hook was unreliable), you can pre-configure the connection using a local environment file. The app now uses a resilient localStorage-backed persistence layer by default, with environment variables as an optional override:

1. Create a file named `.env.local` in the project root (it's already ignored by `.gitignore` via the `*.local` pattern).
2. Add the following variables (do NOT commit this file):

   ```bash
   VITE_GITHUB_TOKEN=ghp_your_pat_here
   VITE_GITHUB_ORG=your-org-name
   ```

3. Restart the dev server (`npm run dev`). The application will detect these values and mark the GitHub connection as established. The Setup tab will display the connection as “environment managed” and disable manual edits until you remove the variables.

> [!CAUTION]
> Storing long‑lived PATs in local `.env.local` is convenient but still sensitive. Prefer fine‑scoped tokens and rotate regularly. For production deployments use a secure secret manager rather than embedding values at build time.

## Run the application

### Local development

After installation, you can start the application:

```bash
npm run dev
```

This will start the Vite development server on `http://localhost:5173`.

### Production build

To create a production build:

```bash
npm run build
```

The built application will be in the `dist` folder, ready for deployment to any static hosting service.

### Available scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Code quality
npm run lint         # Run ESLint
npm run optimize     # Optimize dependencies
```

## Usage

### Setting up GitHub connection

1. **Generate Personal Access Token**:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Create a new token with the required scopes listed in [Prerequisites](#prerequisites)

2. **Configure the dashboard**:
   - Navigate to the "Setup" tab in the application
   - Enter your GitHub Personal Access Token
   - Enter your organization name
   - Click "Connect" to verify the connection

3. **Start scanning**:
   - The dashboard will automatically load all repositories with CodeQL workflows
   - Use the "Request Scan" button on any repository card to dispatch on-demand scans
   - Monitor scan progress and results in real-time

### Managing compliance reports

- **View audit trail**: Navigate to the "Audit Trail" tab to see all scan requests and their status
- **Export reports**: Use the "Export Report" button to generate compliance documentation
- **Monitor security metrics**: The "Security Analytics" tab provides visual charts of findings across all repositories

> [!IMPORTANT]
> **FedRAMP Compliance**: All repositories must have CodeQL workflows with `workflow_dispatch` triggers enabled. The dashboard automatically validates this requirement and provides clear indicators for compliance status.

## Architecture

```text
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components (Radix UI)
│   ├── AuditTrail.tsx   # Audit trail visualization
│   ├── ExportDialog.tsx # Compliance report generation
│   ├── GitHubConnection.tsx # GitHub authentication
│   ├── RepositoryCard.tsx   # Repository management
│   └── SecurityChart.tsx    # Security metrics visualization
├── hooks/               # Custom React hooks
├── lib/                 # Core utilities and services
│   ├── export-utils.ts  # Compliance report generation
│   ├── github-service.ts # GitHub API integration
│   └── utils.ts         # General utilities
├── types/               # TypeScript definitions
└── styles/              # CSS and theme files
```

### Technology stack

- **Frontend**: React 19 with TypeScript and Vite
- **UI Components**: Radix UI with Tailwind CSS
- **State Management**: React hooks with GitHub Spark persistence
- **GitHub Integration**: Octokit REST API client
- **Charts**: Recharts for security metrics visualization
- **Notifications**: Sonner for real-time user feedback

### GitHub API integration

The application integrates with several GitHub APIs:

- **Organizations API**: Repository discovery and metadata
- **Actions API**: Workflow dispatch and run status tracking
- **Code Scanning API**: Security alert retrieval and analysis
- **Repository API**: Workflow file detection and validation

## Security and compliance

### FedRAMP requirements

This dashboard is designed to meet federal compliance standards:

- **Scan frequency**: Supports on-demand and scheduled scanning
- **Audit trails**: Complete request and response logging
- **Documentation**: Automated compliance report generation
- **Response time**: Sub-3-minute scan dispatch and result tracking

### Security features

- **Token management**: Secure local storage with validation
- **Rate limiting**: Automatic backoff and retry logic
- **Permission validation**: Required scope verification
- **Error handling**: Clear messaging for access and permission issues

---

Built with ❤️ for enterprise security compliance

## 🌟 Features

### 🔗 GitHub Organization Integration

- **Secure Authentication**: Connect to GitHub organizations using Personal Access Token authentication
- **Real-time Repository Management**: Automatic repository discovery and management via GitHub API
- **Permission Validation**: Comprehensive access verification and error handling for invalid tokens

### 📊 Repository Management

- **Live Repository Detection**: Display repositories from connected GitHub organization with CodeQL workflow detection
- **Scan Status Tracking**: Real-time visibility into CodeQL scan readiness and current status
- **Workflow Integration**: Automatic detection of repositories with `workflow_dispatch` CodeQL workflows

### 🚀 On-Demand Scan Dispatch

- **Live CodeQL Scanning**: Trigger CodeQL scans via GitHub workflow dispatch API with real-time status tracking  
- **FedRAMP Compliance**: Meet compliance requirements for immediate security scanning capability
- **Progress Monitoring**: Track scan progress and automatically update results in dashboard

### 📈 Security Visualization

- **Live Security Alerts**: Display CodeQL security alerts and findings from GitHub Code Scanning API
- **Risk Assessment**: Categorized security findings by severity (Critical, High, Medium, Low, Note)
- **Compliance Reporting**: Visual charts and metrics for audit documentation

### 📋 Audit Trail Dashboard

- **Historical Tracking**: Complete view of all scan dispatch requests with GitHub workflow correlation
- **Compliance Documentation**: Maintain FedRAMP-ready audit trails with real workflow data
- **Export Capabilities**: Generate compliance reports in PDF, CSV, and JSON formats

## �️ Tech Stack

- **Frontend**: React 19 + TypeScript
- **UI Framework**: Tailwind CSS + Radix UI components
- **Build Tool**: Vite 6.x
- **State Management**: React hooks + Local Storage via `@github/spark`
- **Data Visualization**: Recharts for security metrics
- **GitHub Integration**: Octokit + GitHub REST API
- **Notifications**: Sonner for real-time toast notifications

## 🚀 Getting Started

### Prerequisites (recap)

- Node.js 18+ and npm/yarn
- GitHub Personal Access Token with the following scopes:
  - `repo` - Full repository access
  - `security_events` - Read security events
  - `actions:read` - Read GitHub Actions workflows
  - `metadata:read` - Read repository metadata

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/codeql-compliance-da.git
   cd codeql-compliance-da
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start development server**

   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173`

### Configuration

1. **GitHub Setup Tab**: Navigate to the "Setup" tab in the dashboard
2. **Enter Credentials**:
   - GitHub Personal Access Token
   - Organization name
3. **Verify Connection**: The system will validate permissions and establish connection
4. **Repository Discovery**: Repositories will be automatically loaded and displayed

#### Environment-managed mode

When `VITE_GITHUB_TOKEN` and `VITE_GITHUB_ORG` are present at build/runtime, the GitHub connection is initialized automatically and UI inputs are disabled. Remove or change the variables and restart the server to switch back to manual entry.

### Storage persistence

The dashboard stores configuration (token metadata, org, timestamps) in `localStorage` under the key `github-config`. Sensitive values (the token itself) are only kept client-side. For production hardening you should:

- Prefer short-lived fine-scoped tokens or GitHub App installations
- Consider introducing a backend proxy to exchange a short opaque session key for the PAT
- Rotate tokens regularly and clear `localStorage` on logout events

## 📱 Usage

### Setting Up GitHub Connection

1. **Generate Personal Access Token**:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Create token with required scopes (see Prerequisites)

2. **Connect Organization**:
   - Enter token and organization name in Setup tab
   - System validates permissions and loads repositories

### Managing Repositories

- **View Repositories**: All CodeQL-enabled repositories are displayed with current scan status
- **Dispatch Scans**: Click "Request Scan" to trigger on-demand CodeQL analysis
- **Monitor Progress**: Real-time status updates show scan progression
- **View Results**: Security findings are automatically populated after scan completion

### Compliance Reporting

- **Audit Trail**: Track all scan requests with timestamps and results
- **Export Reports**: Generate compliance reports in multiple formats
- **Real-time Metrics**: Dashboard shows current security posture across all repositories

## 🏗️ Project Structure

```text
src/
├── components/           # Reusable UI components
│   ├── ui/              # Radix UI component library
│   ├── AuditTrail.tsx   # Audit trail component
│   ├── ExportDialog.tsx # Report export functionality
│   ├── GitHubConnection.tsx # GitHub authentication
│   ├── RepositoryCard.tsx   # Repository display card
│   └── SecurityChart.tsx    # Security metrics visualization
├── hooks/               # Custom React hooks
├── lib/                 # Utility libraries
│   ├── export-utils.ts  # Report generation utilities
│   ├── github-service.ts # GitHub API integration
│   └── utils.ts         # General utilities
├── types/               # TypeScript type definitions
├── styles/              # CSS and theme files
└── App.tsx              # Main application component
```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run optimize     # Optimize dependencies

# Utilities
npm run kill         # Kill process on port 5000
```

## 🎨 Design System

The dashboard follows enterprise-grade design principles with a professional color scheme:

- **Primary**: Deep Blue (`oklch(0.4 0.15 240)`) - Conveys trust and security
- **Accent**: Alert Orange (`oklch(0.65 0.18 45)`) - For actions requiring attention
- **Typography**: Inter font family for technical precision and readability
- **Components**: Consistent 16px base spacing with accessible contrast ratios

## 🔐 Security & Compliance

### FedRAMP Requirements

- Real-time security scanning capability
- Comprehensive audit trails with workflow correlation
- Export capabilities for compliance documentation
- Enterprise-grade authentication and authorization

### API Security

- Token validation and error handling
- Rate limiting awareness with exponential backoff
- Secure token storage in browser localStorage
- Permission-based feature access

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. **Check the Issues**: Look through existing GitHub issues
2. **Create an Issue**: Describe your problem with steps to reproduce
3. **Documentation**: Review the Project Requirements Document (PRD.md)

## 🎯 Roadmap

- [ ] **Webhook Integration**: Real-time scan completion notifications
- [ ] **Advanced Filtering**: Repository filtering by language, size, activity
- [ ] **Custom Workflows**: Support for custom CodeQL configurations
- [ ] **Team Management**: Multi-user access and role-based permissions
- [ ] **Integration APIs**: REST API for external tool integration

---

## Built with ❤️ for enterprise security compliance
