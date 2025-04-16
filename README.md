# ROI Mailchimp Reporter

A desktop application built with Tauri, React, and TypeScript that helps track and analyze ROI from Mailchimp newsletter campaigns. The application allows users to generate reports based on newsletter performance metrics and manage advertiser tracking.

## Features

- **Campaign Reporting**: Generate detailed reports for AM/PM newsletters
- **Advertiser Management**: Track multiple advertisers and their campaign performance
- **Mailchimp Integration**: Direct integration with Mailchimp API
- **Export Options**: Download reports in Excel format
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/roi-mailchimp-reporter.git
cd roi-mailchimp-reporter
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your Mailchimp credentials:
```env
VITE_MAILCHIMP_API_KEY=your_api_key
VITE_MAILCHIMP_AUDIENCE_ID=your_audience_id
```

## Development

Start the development server:
```bash
npm run tauri dev
```

Build the application:
```bash
npm run tauri build
```

## Project Structure

```
src/
├── components/     # Reusable React components
├── pages/         # Main application pages
│   ├── RunReport.tsx    # Report generation page
│   ├── Reports.tsx      # Report history and management
│   └── Settings.tsx     # Application configuration
├── types/         # TypeScript type definitions
└── utils/         # Helper functions and utilities
```

## Configuration

### Mailchimp Settings
1. Navigate to the Settings page in the application
2. Enter your Mailchimp API Key and Audience ID
3. Add your advertisers

### Report Types
- AM Newsletter Reports
- PM Newsletter Reports
- Energy Newsletter Reports
- Health Care Newsletter Reports
- Breaking News Reports

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

[MIT License](LICENSE)
