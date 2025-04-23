# ScreenshotShareRewards

A cryptocurrency-powered screenshot and video sharing platform leveraging XNO blockchain technology for innovative content distribution and rewards.

## Features

- Upload and share screenshots and videos
- Real XNO blockchain integration for payments
- Client-side transaction processing (private keys never leave the browser)
- Self-sustained economic model (80/20 split model)
- Reward pool for content creators
- Secure wallet connection and management

## Technology Stack

- **Frontend**: React with TypeScript, Shadcn UI
- **Backend**: Node.js with Express
- **Blockchain**: XNO (Nano) cryptocurrency
- **Wallet Integration**: nanocurrency-web for client-side transactions
- **State Management**: React Query
- **Styling**: Tailwind CSS

## Self-Sustained Economic Model

The platform implements a self-sustained economic model:

1. **Initial Setup**: Starts with an initial reward pool of XNO
2. **Upvoting Mechanism**: 
   - 80% of upvote payment goes directly to content creator
   - 20% goes to the platform reward pool
3. **Daily Rewards**:
   - Content creators earn from the pool based on engagement
   - Rewards distributed daily based on content performance

## Security

- All private keys are processed client-side and never sent to the server
- Transactions are signed in the browser using nanocurrency-web
- Secure wallet connection with automatic session persistence

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see `.env.example`)
4. Run development server: `npm run dev`

## Environment Variables

The following environment variables are required:
- `RPC_KEY`: XNO RPC API key
- `POOL_PRIVATE_KEY`: Private key for the platform's reward pool wallet
- `PUBLIC_POOL_ADDRESS`: Public address of the reward pool
- `PUBLIC_KEY`: Public key for transaction verification

## License

[MIT](LICENSE)