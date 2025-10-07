# n8n-forge-api

> An extension framework for n8n to enable custom functionality and integrations

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18.x or higher
- **pnpm** v10.18.1 (specified in package.json)
- Basic knowledge of n8n workflow automation

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd n8n-forge-api
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```


## 📁 Project Structure

```
n8n-forge-api/
├── node_modules/       # Project dependencies
├── nodes/              # Custom node implementations (create this)
├── credentials/        # Custom credential types (create this)
├── package.json        # Project configuration and dependencies
├── pnpm-lock.yaml     # Locked dependency versions
└── README.md          # Project documentation
```

### Testing

```bash
pnpm test
```

*Note: Test configuration needs to be set up*

## 📦 Dependencies

- **n8n** (^1.114.3) - Workflow automation platform core

## 🔧 Configuration

Add configuration files as needed:
- `.env` for environment variables
- `tsconfig.json` for TypeScript compilation
- Custom node registration files

## 🚢 Deployment

### Local Development
```bash
# Run n8n with custom nodes
n8n start --tunnel
```

### Production
Follow n8n's [deployment guide](https://docs.n8n.io/hosting/) and ensure your custom nodes are properly included.

## 📚 Resources

- [n8n Documentation](https://docs.n8n.io/) - Official docs
- [Creating Nodes](https://docs.n8n.io/integrations/creating-nodes/) - Node development guide
- [n8n Community](https://community.n8n.io/) - Community forum
- [n8n GitHub](https://github.com/n8n-io/n8n) - Source code

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

ISC

